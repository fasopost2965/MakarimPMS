import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DiffViewerProps {
  before: unknown;
  after: unknown;
  className?: string;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Visualiseur avant/après (dette Lot 0, docs/frontend-plan/
// COMPOSANTS_PARTAGES_MANQUANTS.md — "diff-viewer"). Remplace deux blocs
// JSON bruts indépendants (CH-015, AuditPage.tsx) — qui obligeaient à
// comparer soi-même les deux blocs pour repérer un changement — par une
// vraie comparaison champ par champ, valeurs inchangées reléguées au
// second plan. Se replie sur un affichage JSON brut à deux colonnes si
// avant/après ne sont pas tous deux des objets à plat (valeur primitive,
// tableau, null des deux côtés) — cas non observé dans AuditLog à ce jour
// mais pas exclu pour un futur consommateur.
export function DiffViewer({ before, after, className }: DiffViewerProps) {
  if (!isPlainRecord(before) && !isPlainRecord(after)) {
    return (
      <div className={cn('grid grid-cols-1 gap-2 sm:grid-cols-2', className)}>
        <pre className="bg-muted overflow-x-auto rounded p-2 text-xs">
          {formatValue(before)}
        </pre>
        <pre className="bg-muted overflow-x-auto rounded p-2 text-xs">
          {formatValue(after)}
        </pre>
      </div>
    );
  }

  const beforeRecord = isPlainRecord(before) ? before : {};
  const afterRecord = isPlainRecord(after) ? after : {};
  const keys = Array.from(
    new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]),
  ).sort();

  return (
    <div className={cn('rounded-md border', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Champ</TableHead>
            <TableHead>Avant</TableHead>
            <TableHead>Après</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((key) => {
            const beforeVal = beforeRecord[key];
            const afterVal = afterRecord[key];
            const changed =
              JSON.stringify(beforeVal) !== JSON.stringify(afterVal);
            return (
              <TableRow key={key}>
                <TableCell
                  className={cn(
                    'font-mono text-xs',
                    !changed && 'text-muted-foreground',
                  )}
                >
                  {key}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-xs',
                    changed
                      ? 'text-destructive line-through'
                      : 'text-muted-foreground',
                  )}
                >
                  {formatValue(beforeVal)}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-xs',
                    changed
                      ? 'text-success font-medium'
                      : 'text-muted-foreground',
                  )}
                >
                  {formatValue(afterVal)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
