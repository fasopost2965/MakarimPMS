import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MoneyDisplay } from '@/components/ui/money-display';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toastManager } from '@/components/ui/toast';
import { generateInvoice, listStaysFacturables } from '../api';
import type { StayFacturable } from '../types';

interface Props {
  from: string;
  to: string;
  search: string;
  refreshKey: number;
  canWrite: boolean;
  onGenerated: () => void;
}

// DESIGN-010 (mission §12) — onglet À facturer, depuis GET
// /stays/facturables uniquement (jamais une dérivation locale). Après
// génération, refetch : le séjour disparaît de cette vue (garde serveur —
// une facture EMISE existe désormais sur son folio) et le refresh global
// (onGenerated) rafraîchit les KPI et l'onglet Factures.
export function BillableStaysView({
  from,
  to,
  search,
  refreshKey,
  canWrite,
  onGenerated,
}: Props) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<StayFacturable[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [from, to, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    listStaysFacturables({
      from: from || undefined,
      to: to || undefined,
      page,
      limit: 50,
    })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setMeta({ total: res.meta.total, totalPages: res.meta.totalPages });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur de chargement');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, page, refreshKey, reloadTick]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${r.guest.nom} ${r.guest.prenom}`.toLowerCase().includes(q) ||
      r.room.numero.toLowerCase().includes(q) ||
      String(r.id).includes(q)
    );
  });

  async function handleGenerate(stay: StayFacturable) {
    const folioId = stay.folios[0]?.id;
    if (!folioId) return;
    setGeneratingId(stay.id);
    try {
      const invoice = await generateInvoice(folioId);
      toastManager.add({
        title: 'Facture générée',
        description: `Facture ${invoice.numero} — ${stay.guest.nom} ${stay.guest.prenom}.`,
        type: 'success',
      });
      setReloadTick((t) => t + 1);
      onGenerated();
    } catch (err) {
      toastManager.add({
        title: 'Erreur de génération',
        description: err instanceof Error ? err.message : 'Erreur inconnue',
        type: 'error',
      });
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">
        {meta.total} séjour{meta.total > 1 ? 's' : ''} à facturer
      </p>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Rien à facturer"
          description="Aucun séjour clôturé sans facture active pour la période sélectionnée."
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Séjour</TableHead>
                <TableHead>Chambre</TableHead>
                <TableHead>Départ réel</TableHead>
                <TableHead>Folio</TableHead>
                <TableHead className="text-right">Total facturable</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.guest.nom} {row.guest.prenom}
                  </TableCell>
                  <TableCell className="text-xs">#{row.id}</TableCell>
                  <TableCell>{row.room.numero}</TableCell>
                  <TableCell className="text-xs">
                    {row.dateCheckoutReelle
                      ? new Date(row.dateCheckoutReelle).toLocaleDateString(
                          'fr-FR',
                        )
                      : '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    #{row.folios[0]?.id ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyDisplay value={row.totalFacturable} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canWrite || generatingId === row.id}
                      title={
                        canWrite
                          ? undefined
                          : 'Permission requise : billing:write'
                      }
                      onClick={() => void handleGenerate(row)}
                    >
                      {generatingId === row.id
                        ? 'Génération…'
                        : 'Générer facture'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Précédent
          </Button>
          <span className="text-muted-foreground">
            Page {page} sur {meta.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </Button>
        </div>
      )}
    </div>
  );
}
