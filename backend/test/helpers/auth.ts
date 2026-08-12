import request from 'supertest';
import { App } from 'supertest/types';

// Mot de passe commun à tous les comptes de seed (voir prisma/seed.ts,
// DEV_PASSWORD) — utilisé uniquement dans les tests e2e contre la base de
// développement/CI, jamais une vraie base de production.
const SEED_PASSWORD = 'Password123!';

export const SEED_USERS = {
  admin: 'admin@makarim.test',
  reception: 'reception@makarim.test',
  gouvernante: 'gouvernante@makarim.test',
  comptable: 'comptable@makarim.test',
  maintenance: 'maintenance@makarim.test',
  rh: 'rh@makarim.test',
} as const;

// CH-026(e) — POST /auth/login ne renvoie plus les jetons dans le corps de
// la réponse (docs/security/CH-026E_NOTE_CONCEPTION_COOKIES_HTTPONLY.md) :
// extrait la valeur du cookie httpOnly makarim_access_token depuis l'en-tête
// Set-Cookie plutôt que res.body.accessToken. JwtAccessStrategy accepte
// toujours Authorization: Bearer en parallèle (double extracteur) — les
// centaines d'appels e2e existants via authedRequest() restent inchangés.
export function extractCookieValue(
  setCookieHeaders: string[] | undefined,
  name: string,
): string {
  const header = setCookieHeaders?.find((c) => c.startsWith(`${name}=`));
  if (!header) {
    throw new Error(
      `Cookie "${name}" absent de la réponse de connexion (Set-Cookie: ${JSON.stringify(setCookieHeaders)}).`,
    );
  }
  return header.split(';', 1)[0].slice(name.length + 1);
}

// Connecte un utilisateur de seed et renvoie son access token — chaque
// suite e2e appelle ceci dans beforeAll pour obtenir un token avant
// d'exercer les routes protégées (JwtAuthGuard + PermissionsGuard sont
// globaux depuis le module core 5.1/5.2, voir AppModule).
export async function loginAs(
  server: App,
  role: keyof typeof SEED_USERS,
): Promise<string> {
  const res = await request(server).post('/api/auth/login').send({
    email: SEED_USERS[role],
    motDePasse: SEED_PASSWORD,
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(
      `Échec de connexion du compte de seed "${role}" (statut ${res.status}) : ${JSON.stringify(res.body)}`,
    );
  }
  return extractCookieValue(
    res.headers['set-cookie'] as string[] | undefined,
    'makarim_access_token',
  );
}

// B0.4A — connecte un utilisateur de seed via le login mobile à portée
// réduite (F9, scope "mobile-housekeeping"). Contrairement à loginAs(),
// AuthService.loginMobile() renvoie l'accessToken directement dans le corps
// JSON (pas de cookie httpOnly — voir mobile-api.ts frontend, "sans refresh
// token").
export async function loginMobileAs(
  server: App,
  role: keyof typeof SEED_USERS,
): Promise<string> {
  const res = await request(server)
    .post('/api/mobile/housekeeping/login')
    .send({
      email: SEED_USERS[role],
      motDePasse: SEED_PASSWORD,
    });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(
      `Échec de connexion mobile du compte de seed "${role}" (statut ${res.status}) : ${JSON.stringify(res.body)}`,
    );
  }
  return (res.body as { accessToken: string }).accessToken;
}

// Wrapper supertest qui attache automatiquement l'en-tête Authorization —
// évite de répéter .set('Authorization', ...) sur chaque appel dans les
// suites de tests.
export function authedRequest(server: App, token: string) {
  const auth = (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`);
  return {
    get: (url: string) => auth(request(server).get(url)),
    post: (url: string) => auth(request(server).post(url)),
    patch: (url: string) => auth(request(server).patch(url)),
    delete: (url: string) => auth(request(server).delete(url)),
  };
}
