import { loadEncryptionKey } from '../crypto/field-encryption';

// Valeurs de développement documentées dans backend/.env.example — jamais
// acceptables en production, où un secret JWT prévisible permettrait de
// forger des tokens d'accès valides pour n'importe quel utilisateur.
// ENCRYPTION_KEY (CH-004) suit la même règle : conserver la clé de dev en
// production rendrait Guest.pieceIdentite déchiffrable par quiconque a lu ce
// dépôt (la valeur est publique).
const DEFAULT_SECRETS: Record<string, string> = {
  JWT_ACCESS_SECRET: 'dev-access-secret-change-me',
  JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me',
  ENCRYPTION_KEY: 'AqPFDtHd7Jqqh9wQnh/7ArvxgNAOK3o3sgodMRH8khw=',
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

// CH-004 — contrairement aux secrets JWT ci-dessus (n'importe quelle chaîne
// non vide fonctionne, faible ou forte), ENCRYPTION_KEY doit décoder en
// exactement 32 octets pour qu'AES-256-GCM fonctionne : sans elle, aucune
// lecture/écriture de Guest n'est possible. Vérifiée dans TOUS les
// environnements (pas seulement en production) — échec rapide et lisible au
// bootstrap plutôt qu'une erreur de déchiffrement profonde au premier appel
// à GuestsService. loadEncryptionKey() est la même fonction que celle
// utilisée par guest-encryption.extension.ts : une seule source de vérité
// pour le format de la clé.
export function assertEncryptionKeyConfigured(): void {
  loadEncryptionKey(process.env.ENCRYPTION_KEY);
}
