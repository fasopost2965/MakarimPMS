import { parseMrzFromText } from './mrz-parser';

// Réimplémentation indépendante de l'algorithme de chiffre de contrôle ICAO
// 9303 (poids [7,3,1] cycliques, '<'=0, chiffres=valeur, lettres=position+10)
// — sert uniquement à fabriquer des chaînes MRZ synthétiques valides pour ce
// test, jamais importée de mrz-parser.ts : un test qui réutiliserait
// l'implémentation testée pour construire ses propres données ne serait pas
// discriminant.
const WEIGHTS = [7, 3, 1];
function charValue(c: string): number {
  if (c === '<') return 0;
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  return c.charCodeAt(0) - 65 + 10;
}
function checkDigit(s: string): string {
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += charValue(s[i]) * WEIGHTS[i % 3];
  return String(sum % 10);
}

function buildTd3(): string {
  const numero = 'AB1234567';
  const nationalite = 'MAR';
  const naissance = '850615';
  const sexe = 'F';
  const expiration = '300101';
  const personalNumber = '<'.repeat(14);

  const line1 = ('P<MAR' + 'ELALAOUI<<FATIMA<ZAHRA').padEnd(44, '<');
  const line2 =
    numero +
    checkDigit(numero) +
    nationalite +
    naissance +
    checkDigit(naissance) +
    sexe +
    expiration +
    checkDigit(expiration) +
    personalNumber +
    checkDigit(personalNumber) +
    '0';

  expect(line1).toHaveLength(44);
  expect(line2).toHaveLength(44);
  return `SIGNALEMENT\n${line1}\n${line2}\n`;
}

function buildTd1(): string {
  const docNumber = 'CD9876543';
  const naissance = '920310';
  const sexe = 'M';
  const expiration = '320310';
  const nationalite = 'MAR';

  const line1 =
    'ID' + 'MAR' + docNumber + checkDigit(docNumber) + '<'.repeat(15);
  const line2 =
    naissance +
    checkDigit(naissance) +
    sexe +
    expiration +
    checkDigit(expiration) +
    nationalite +
    '<'.repeat(11) +
    '0';
  const line3 = 'BENALI<<YOUSSEF'.padEnd(30, '<');

  expect(line1).toHaveLength(30);
  expect(line2).toHaveLength(30);
  expect(line3).toHaveLength(30);
  return `ROYAUME DU MAROC\n${line1}\n${line2}\n${line3}\n`;
}

describe('parseMrzFromText', () => {
  it('parses a valid TD3 (passeport) MRZ with correct check digits', () => {
    const result = parseMrzFromText(buildTd3());
    expect(result.formatDetecte).toBe('TD3_PASSEPORT');
    expect(result.numeroPiece).toBe('AB1234567');
    expect(result.nom).toBe('ELALAOUI');
    expect(result.prenom).toBe('FATIMA ZAHRA');
    expect(result.nationalite).toBe('MAR');
    expect(result.dateNaissance).toBe('1985-06-15');
    expect(result.sexe).toBe('F');
    expect(result.dateExpiration).toBe('2030-01-01');
    expect(result.checksumValide).toBe(true);
  });

  it('parses a valid TD1 (CIN biométrique) MRZ with correct check digits', () => {
    const result = parseMrzFromText(buildTd1());
    expect(result.formatDetecte).toBe('TD1_CIN');
    expect(result.numeroPiece).toBe('CD9876543');
    expect(result.nom).toBe('BENALI');
    expect(result.prenom).toBe('YOUSSEF');
    expect(result.nationalite).toBe('MAR');
    expect(result.dateNaissance).toBe('1992-03-10');
    expect(result.sexe).toBe('M');
    expect(result.dateExpiration).toBe('2032-03-10');
    expect(result.checksumValide).toBe(true);
  });

  // Preuve de rigueur sabotage/restore (CLAUDE.md — règle non-négociable
  // pour toute assertion qualifiée de discriminante) : un chiffre de
  // contrôle corrompu (simulant une erreur OCR) doit faire échouer
  // checksumValide SANS empêcher l'extraction des champs — c'est le
  // comportement volontairement consultatif de ce parseur (jamais bloquant,
  // la réception doit relire l'affichage). Sabotage : on altère le chiffre
  // de contrôle de date de naissance ; restore : le test valide bien que le
  // champ reste extrait malgré checksumValide=false.
  it('still extracts fields but flags checksumValide=false when a check digit is corrupted', () => {
    const lines = buildTd3().split('\n');
    const line2 = lines[2];
    // Corrompt le chiffre de contrôle de la date de naissance (position 19)
    // en le remplaçant par un chiffre différent (garanti différent car
    // computeCheckDigit ne peut renvoyer que 0-9 — on prend le suivant
    // modulo 10).
    const sabotagedDigit = String((Number(line2[19]) + 1) % 10);
    lines[2] = line2.slice(0, 19) + sabotagedDigit + line2.slice(20);
    const result = parseMrzFromText(lines.join('\n'));
    expect(result.formatDetecte).toBe('TD3_PASSEPORT');
    expect(result.checksumValide).toBe(false);
    expect(result.nom).toBe('ELALAOUI');
    expect(result.numeroPiece).toBe('AB1234567');
  });

  it('returns a null result when no MRZ-like lines are present', () => {
    const result = parseMrzFromText(
      'Ceci est une note manuscrite quelconque.\nSans rapport.',
    );
    expect(result.formatDetecte).toBeNull();
    expect(result.checksumValide).toBe(false);
    expect(result.numeroPiece).toBeNull();
  });
});
