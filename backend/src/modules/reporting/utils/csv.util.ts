// Sérialisation CSV minimale (BR-REP-001 : format CSV obligatoire pour
// l'intégration externe). Pas de dépendance ajoutée — RFC 4180 basique
// (échappement guillemets/virgules/retours à la ligne) suffisant pour des
// exports tabulaires simples. PDF/Excel volontairement hors périmètre de ce
// sprint (voir SPRINT_13.md §6).
// Volontairement restreint aux types déjà stringifiables sans ambiguïté —
// aux appelants de convertir explicitement Decimal/Date en amont
// (toString()/toISOString()) plutôt que de leur faire confiance ici.
type CsvValue = string | number | boolean | null | undefined;

function escapeCsvField(value: CsvValue): string {
  const str = value == null ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: Array<Array<CsvValue>>): string {
  const lines = [headers.map(escapeCsvField).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(','));
  }
  return lines.join('\r\n');
}
