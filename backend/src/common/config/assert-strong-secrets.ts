// Valeurs de développement documentées dans backend/.env.example — jamais
// acceptables en production, où un secret JWT prévisible permettrait de
// forger des tokens d'accès valides pour n'importe quel utilisateur.
const DEFAULT_SECRETS: Record<string, string> = {
  JWT_ACCESS_SECRET: 'dev-access-secret-change-me',
  JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me',
};

// Exécutée avant NestFactory.create() (voir main.ts) : ne s'applique qu'en
// production pour ne pas casser le poste de dev local ni la CI, qui
// utilisent volontairement les valeurs de backend/.env.example.
export function assertStrongSecrets(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const weakVars = Object.entries(DEFAULT_SECRETS)
    .filter(([envVar, defaultValue]) => process.env[envVar] === defaultValue)
    .map(([envVar]) => envVar);

  if (weakVars.length > 0) {
    throw new Error(
      `Démarrage refusé (NODE_ENV=production) : ${weakVars.join(', ')} ` +
        `utilise encore la valeur par défaut de backend/.env.example. ` +
        `Génère un secret aléatoire (ex. openssl rand -base64 48) et ` +
        `injecte-le via un gestionnaire de secrets réel.`,
    );
  }
}
