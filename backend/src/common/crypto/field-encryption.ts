import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// CH-004 (docs/governance/REGISTRE_CHANTIERS.md) — chiffrement au repos de
// Guest.pieceIdentite. AES-256-GCM : chiffrement authentifié (détecte toute
// altération du texte chiffré, pas seulement la confidentialité), mode non
// déterministe par construction (IV aléatoire à chaque appel) — deux
// chiffrements du même numéro de pièce produisent des sorties différentes,
// ce qui empêche toute fuite d'égalité par simple comparaison du texte
// chiffré en base.
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
// Préfixe versionné : distingue une valeur déjà chiffrée par ce mécanisme
// d'une valeur en clair pré-existante (aucune migration forcée des données
// historiques — voir docs/governance/REGISTRE_DECISIONS.md, RD-006).
const PREFIX = 'enc:v1:';

export function loadEncryptionKey(rawKey: string | undefined): Buffer {
  if (!rawKey) {
    throw new Error(
      'ENCRYPTION_KEY manquant — requis pour chiffrer/déchiffrer Guest.pieceIdentite ' +
        '(CH-004). Génère une clé avec `openssl rand -base64 32` et renseigne-la ' +
        'dans backend/.env (voir backend/.env.example).',
    );
  }
  const key = Buffer.from(rawKey, 'base64');
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY invalide : doit décoder en ${KEY_LENGTH_BYTES} octets ` +
        `(base64 de 32 octets aléatoires, ex. \`openssl rand -base64 32\`), ` +
        `obtenu ${key.length} octet(s).`,
    );
  }
  return key;
}

export function isEncryptedField(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptField(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

// Rétrocompatible avec une valeur en clair pré-existante (pas de préfixe
// `enc:v1:`) : la renvoie telle quelle plutôt que d'échouer — une base
// contenant à la fois d'anciennes valeurs en clair et de nouvelles valeurs
// chiffrées reste lisible sans script de migration forcé.
export function decryptField(value: string, key: Buffer): string {
  if (!isEncryptedField(value)) {
    return value;
  }
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LENGTH_BYTES);
  const authTag = raw.subarray(
    IV_LENGTH_BYTES,
    IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES,
  );
  const ciphertext = raw.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
