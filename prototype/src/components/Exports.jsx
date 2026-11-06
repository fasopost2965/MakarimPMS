// ------------------------------------------------------------------
// Barre d'export commune à tous les rapports.
//
// Une seule définition de colonnes et de lignes alimente les trois sorties :
// PDF (aperçu A4 imprimable), CSV et Excel. Les rapports qui n'ont pas
// d'aperçu A4 fournissent `onPdf` ; sans lui, le bouton est désactivé plutôt
// que de mentir sur ce qui est disponible.
// ------------------------------------------------------------------

import { FileSpreadsheet, Printer, Table2 } from 'lucide-react';
import { exporterCsv, exporterExcel } from '../lib/export';
import { cx, useToast } from './ui';

export function Exports({ nom, titre, colonnes, lignes, onPdf, compact = false, className = '' }) {
  const { push } = useToast();
  const vide = !lignes?.length;

  const base = cx(
    'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors',
    compact ? 'text-[11px]' : '',
  );
  const actif = 'border-line-strong bg-surface text-ink-2 hover:bg-mist-50';
  const inactif = 'border-line bg-mist-50 text-ink-3 cursor-not-allowed';

  const faire = (type) => {
    if (vide) {
      push('Rien à exporter sur ce périmètre.', 'info');
      return;
    }
    if (type === 'csv') {
      exporterCsv(nom, colonnes, lignes);
      push(`CSV généré · ${lignes.length} ligne(s).`, 'success');
    }
    if (type === 'excel') {
      exporterExcel(nom, titre ?? nom, colonnes, lignes);
      push(`Classeur Excel généré · ${lignes.length} ligne(s).`, 'success');
    }
  };

  return (
    <div className={cx('flex flex-wrap items-center gap-1.5', className)}>
      {onPdf && (
        <button
          type="button"
          onClick={onPdf}
          disabled={vide}
          className={cx(base, vide ? inactif : actif)}
          title="Aperçu A4 puis impression (PDF)"
        >
          <Printer className="size-3" /> PDF
        </button>
      )}
      <button
        type="button"
        onClick={() => faire('csv')}
        className={cx(base, vide ? inactif : actif)}
        title="Fichier CSV (séparateur point-virgule, UTF-8)"
      >
        <Table2 className="size-3" /> CSV
      </button>
      <button
        type="button"
        onClick={() => faire('excel')}
        className={cx(base, vide ? inactif : actif)}
        title="Classeur Excel (.xls, SpreadsheetML)"
      >
        <FileSpreadsheet className="size-3" /> Excel
      </button>
    </div>
  );
}
