// Parseur MRZ (Machine Readable Zone, norme ICAO 9303) — fonction pure, sans
// dépendance à l'OCR : prend le texte brut déjà extrait d'une image et tente
// d'y localiser puis décoder la zone MRZ. Supporte TD3 (passeport, 2 lignes
// de 44 caractères) et TD1 (CIN biométrique marocaine, 3 lignes de 30
// caractères) — les deux seuls formats concernés par TypePiece.CIN/PASSEPORT.
// Purement indicatif (F5, comme F3/F6) : la validation des chiffres de
// contrôle ICAO (checksumValide) n'est qu'un signal de confiance, jamais un
// blocage — un OCR imparfait peut faire échouer un chiffre de contrôle sans
// que les champs extraits soient pour autant inexploitables ; c'est à la
// réception de vérifier avant validation.

export type MrzFormat = 'TD3_PASSEPORT' | 'TD1_CIN';

export interface MrzResult {
  formatDetecte: MrzFormat | null;
  numeroPiece: string | null;
  nom: string | null;
  prenom: string | null;
  nationalite: string | null;
  dateNaissance: string | null;
  sexe: 'M' | 'F' | null;
  dateExpiration: string | null;
  checksumValide: boolean;
  lignesMrz: string[];
}

const EMPTY_RESULT: MrzResult = {
  formatDetecte: null,
  numeroPiece: null,
  nom: null,
  prenom: null,
  nationalite: null,
  dateNaissance: null,
  sexe: null,
  dateExpiration: null,
  checksumValide: false,
  lignesMrz: [],
};

const CHECK_WEIGHTS = [7, 3, 1];

function charValue(c: string): number {
  if (c === '<') return 0;
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 65 + 10;
  return 0;
}

function computeCheckDigit(input: string): number {
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    sum += charValue(input[i]) * CHECK_WEIGHTS[i % 3];
  }
  return sum % 10;
}

function checkDigitMatches(
  field: string,
  digitChar: string | undefined,
): boolean {
  if (!digitChar || !/^[0-9]$/.test(digitChar)) return false;
  return computeCheckDigit(field) === Number(digitChar);
}

// Bascule de siècle standard MRZ : une naissance ne peut pas être dans le
// futur, une expiration ne peut pas être un siècle en arrière — on tranche
// sur l'année courante à 2 chiffres, convention ICAO 9303 usuelle.
function parseMrzDate(yymmdd: string): string | null {
  if (!/^[0-9]{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const currentYY = new Date().getFullYear() % 100;
  const century = yy > currentYY + 10 ? 1900 : 2000;
  return `${century + yy}-${mm}-${dd}`;
}

function parseName(field: string): { nom: string; prenom: string } {
  const [surname, given] = field.split('<<');
  const clean = (s?: string) =>
    (s ?? '').replace(/</g, ' ').trim().replace(/\s+/g, ' ');
  return { nom: clean(surname), prenom: clean(given) };
}

// Repère, dans le texte OCR brut, les `expectedCount` dernières lignes dont
// la longueur (une fois débarrassée de tout caractère hors alphabet MRZ)
// approche `expectedLength` — la MRZ est toujours imprimée en bas du
// document. Chaque ligne retenue est ensuite normalisée (tronquée ou
// complétée par '<') à la longueur ICAO exacte : l'OCR ajoute/perd rarement
// des caractères ailleurs qu'en fin de ligne, donc cette normalisation
// n'altère pas la lecture positionnelle des champs.
function extractMrzLines(
  rawText: string,
  expectedLength: number,
  expectedCount: number,
): string[] {
  const candidates = rawText
    .split('\n')
    .map((line) => line.toUpperCase().replace(/[^A-Z0-9<]/g, ''))
    .filter((line) => line.length >= expectedLength - 6);

  const relevant = candidates.slice(-expectedCount);
  if (relevant.length !== expectedCount) return [];

  return relevant.map((line) =>
    line.length >= expectedLength
      ? line.slice(0, expectedLength)
      : line.padEnd(expectedLength, '<'),
  );
}

function parseTd3(lines: string[]): MrzResult {
  const [line1, line2] = lines;
  const { nom, prenom } = parseName(line1.slice(5, 44));

  const numeroField = line2.slice(0, 9);
  const naissanceRaw = line2.slice(13, 19);
  const expirationRaw = line2.slice(21, 27);
  const sexeChar = line2[20];

  return {
    formatDetecte: 'TD3_PASSEPORT',
    numeroPiece: numeroField.replace(/</g, '') || null,
    nom: nom || null,
    prenom: prenom || null,
    nationalite: line2.slice(10, 13).replace(/</g, '') || null,
    dateNaissance: parseMrzDate(naissanceRaw),
    sexe: sexeChar === 'M' || sexeChar === 'F' ? sexeChar : null,
    dateExpiration: parseMrzDate(expirationRaw),
    checksumValide:
      checkDigitMatches(numeroField, line2[9]) &&
      checkDigitMatches(naissanceRaw, line2[19]) &&
      checkDigitMatches(expirationRaw, line2[27]),
    lignesMrz: lines,
  };
}

function parseTd1(lines: string[]): MrzResult {
  const [line1, line2, line3] = lines;
  const { nom, prenom } = parseName(line3);

  const numeroField = line1.slice(5, 14);
  const naissanceRaw = line2.slice(0, 6);
  const expirationRaw = line2.slice(8, 14);
  const sexeChar = line2[7];

  return {
    formatDetecte: 'TD1_CIN',
    numeroPiece: numeroField.replace(/</g, '') || null,
    nom: nom || null,
    prenom: prenom || null,
    nationalite: line2.slice(15, 18).replace(/</g, '') || null,
    dateNaissance: parseMrzDate(naissanceRaw),
    sexe: sexeChar === 'M' || sexeChar === 'F' ? sexeChar : null,
    dateExpiration: parseMrzDate(expirationRaw),
    checksumValide:
      checkDigitMatches(numeroField, line1[14]) &&
      checkDigitMatches(naissanceRaw, line2[6]) &&
      checkDigitMatches(expirationRaw, line2[14]),
    lignesMrz: lines,
  };
}

export function parseMrzFromText(rawText: string): MrzResult {
  const td3Lines = extractMrzLines(rawText, 44, 2);
  if (td3Lines.length === 2 && td3Lines[0][0] === 'P') {
    return parseTd3(td3Lines);
  }

  const td1Lines = extractMrzLines(rawText, 30, 3);
  if (td1Lines.length === 3) {
    return parseTd1(td1Lines);
  }

  return EMPTY_RESULT;
}
