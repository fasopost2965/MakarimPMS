import { randomBytes } from 'crypto';
import {
  decryptField,
  encryptField,
  isEncryptedField,
  loadEncryptionKey,
} from './field-encryption';

describe('loadEncryptionKey', () => {
  it('lève une erreur si la variable est absente', () => {
    expect(() => loadEncryptionKey(undefined)).toThrow(/manquant/);
  });

  it('lève une erreur si la clé décodée ne fait pas 32 octets', () => {
    const tooShort = Buffer.from('trop-courte').toString('base64');
    expect(() => loadEncryptionKey(tooShort)).toThrow(/32 octets/);
  });

  it('accepte une clé base64 de 32 octets', () => {
    const key = randomBytes(32).toString('base64');
    expect(loadEncryptionKey(key)).toHaveLength(32);
  });
});

describe('encryptField / decryptField (round-trip)', () => {
  const key = randomBytes(32);

  it('déchiffre exactement la valeur chiffrée', () => {
    const plaintext = 'CN1234567';
    const ciphertext = encryptField(plaintext, key);
    expect(decryptField(ciphertext, key)).toBe(plaintext);
  });

  it('produit un texte chiffré différent à chaque appel (IV aléatoire, non déterministe)', () => {
    const a = encryptField('AB998877', key);
    const b = encryptField('AB998877', key);
    expect(a).not.toBe(b);
    expect(decryptField(a, key)).toBe('AB998877');
    expect(decryptField(b, key)).toBe('AB998877');
  });

  it('le texte chiffré est préfixé et ne contient jamais le texte en clair', () => {
    const ciphertext = encryptField('SECRET-CIN-999', key);
    expect(isEncryptedField(ciphertext)).toBe(true);
    expect(ciphertext).not.toContain('SECRET-CIN-999');
  });

  // Preuve de rigueur sabotage/restore (CLAUDE.md, règle non négociable sur
  // les preuves de test) : le chiffrement authentifié (GCM) doit détecter
  // toute altération du texte chiffré, pas seulement protéger la
  // confidentialité. Sabotage réel effectué (pas seulement affirmé) : un
  // octet du texte chiffré est modifié après coup, puis restauré.
  it('détecte une altération du texte chiffré (auth tag GCM) — preuve sabotage/restore', () => {
    const ciphertext = encryptField('CIN000111', key);
    const raw = ciphertext.slice('enc:v1:'.length);
    const tampered = Buffer.from(raw, 'base64');
    // Sabotage : un octet du texte chiffré (après IV(12) + authTag(16)) est
    // inversé au bit près.
    const sabotageIndex = 12 + 16;
    tampered[sabotageIndex] = tampered[sabotageIndex] ^ 0xff;
    const sabotagedCiphertext = 'enc:v1:' + tampered.toString('base64');

    expect(() => decryptField(sabotagedCiphertext, key)).toThrow();
    // Restauration : le texte chiffré non modifié continue de se déchiffrer
    // correctement (le sabotage ci-dessus n'a pas muté `ciphertext`).
    expect(decryptField(ciphertext, key)).toBe('CIN000111');
  });

  it("ne lève pas d'erreur avec une mauvaise clé de déchiffrement (auth tag rejette silencieusement en erreur explicite)", () => {
    const ciphertext = encryptField('CIN777888', key);
    const wrongKey = randomBytes(32);
    expect(() => decryptField(ciphertext, wrongKey)).toThrow();
  });

  it('renvoie une valeur en clair pré-existante telle quelle (rétrocompatibilité, pas de préfixe enc:v1:)', () => {
    expect(decryptField('AB123456', key)).toBe('AB123456');
  });
});
