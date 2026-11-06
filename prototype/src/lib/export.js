/* ------------------------------------------------------------------
 * Exports de rapports · CSV et Excel, en plus du PDF.
 *
 * Aucune dépendance externe (l'aperçu tourne sans CDN) :
 *  - CSV   : séparateur « ; » et BOM UTF-8, ouverture directe dans Excel FR ;
 *  - Excel : classeur SpreadsheetML 2003 (.xls), lisible par Excel, LibreOffice
 *            et Numbers, avec les nombres typés et l'en-tête en gras ;
 *  - PDF   : l'aperçu A4 de `ApercuDocument` + impression navigateur.
 *
 * Les trois sortent EXACTEMENT les mêmes lignes : c'est `Exports` qui reçoit
 * les colonnes et les lignes une seule fois et les distribue aux formats.
 * ------------------------------------------------------------------ */

function echapperCsv(valeur) {
  const txt = valeur === null || valeur === undefined ? '' : String(valeur);
  return /[";\n\r]/.test(txt) ? `"${txt.replace(/"/g, '""')}"` : txt;
}

export function versCsv(colonnes, lignes) {
  const entete = colonnes.map((c) => echapperCsv(c.label ?? c)).join(';');
  const corps = lignes.map((l) =>
    colonnes.map((c) => echapperCsv(typeof c.cle === 'function' ? c.cle(l) : l[c.cle ?? c])).join(';'),
  );
  return `\uFEFF${[entete, ...corps].join('\r\n')}\r\n`;
}

function echapperXml(valeur) {
  return String(valeur ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function versExcel(titre, colonnes, lignes) {
  const cellule = (valeur, style = '') => {
    const numerique = typeof valeur === 'number' && Number.isFinite(valeur);
    const type = numerique ? 'Number' : 'String';
    return `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="${type}">${echapperXml(
      numerique ? valeur : valeur ?? '',
    )}</Data></Cell>`;
  };

  const entete = colonnes.map((c) => cellule(c.label ?? c, 'entete')).join('');
  const corps = lignes
    .map(
      (l) =>
        `<Row>${colonnes
          .map((c) => cellule(typeof c.cle === 'function' ? c.cle(l) : l[c.cle ?? c]))
          .join('')}</Row>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="entete">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#003580" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${echapperXml(titre).slice(0, 31)}">
    <Table>
      <Row>${entete}</Row>
      ${corps}
    </Table>
  </Worksheet>
</Workbook>`;
}

// Déclenche le téléchargement. Un Blob évite les limites de longueur d'URL.
export function telecharger(nomFichier, contenu, mime) {
  const blob = new Blob([contenu], { type: mime });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exporterCsv(nomFichier, colonnes, lignes) {
  telecharger(`${nomFichier}.csv`, versCsv(colonnes, lignes), 'text/csv;charset=utf-8');
}

export function exporterExcel(nomFichier, titre, colonnes, lignes) {
  telecharger(
    `${nomFichier}.xls`,
    versExcel(titre, colonnes, lignes),
    'application/vnd.ms-excel;charset=utf-8',
  );
}
