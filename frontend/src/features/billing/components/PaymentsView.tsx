import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MoneyDisplay } from '@/components/ui/money-display';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listPayments } from '@/features/payments/api';
import type { MoyenPaiement, PaymentListItem } from '@/features/payments/types';

const MOYEN_LABEL: Record<MoyenPaiement, string> = {
  ESPECES: 'Espèces',
  CARTE: 'Carte',
  VIREMENT: 'Virement',
  ACOMPTE: 'Acompte',
};

const ALL = '__ALL__';

interface Props {
  from: string;
  to: string;
  search: string;
  refreshKey: number;
}

// DESIGN-010 (mission §13) — onglet Paiements, registre paginé. Jamais de
// colonne "encaissé par" (Payment n'a pas de userId fiable — voir
// PaymentListItem, mission §4/§13).
export function PaymentsView({ from, to, search, refreshKey }: Props) {
  const [moyenFilter, setMoyenFilter] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PaymentListItem[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [from, to, moyenFilter, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    listPayments({
      from: from || undefined,
      to: to || undefined,
      moyen: moyenFilter === ALL ? undefined : (moyenFilter as MoyenPaiement),
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
  }, [from, to, moyenFilter, page, refreshKey]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${r.folio.stay.guest.nom} ${r.folio.stay.guest.prenom}`
        .toLowerCase()
        .includes(q) ||
      r.folio.stay.room.numero.toLowerCase().includes(q) ||
      (r.invoice?.numero.toLowerCase().includes(q) ?? false) ||
      String(r.folio.stay.id).includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {meta.total} paiement{meta.total > 1 ? 's' : ''}
        </p>
        <Select
          value={moyenFilter}
          onValueChange={(v) => v && setMoyenFilter(v)}
          items={[
            { value: ALL, label: 'Tous moyens' },
            ...Object.entries(MOYEN_LABEL).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous moyens</SelectItem>
            {Object.entries(MOYEN_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucun paiement"
          description="Aucun règlement ne correspond aux filtres actuels."
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Séjour</TableHead>
                <TableHead>Chambre</TableHead>
                <TableHead>Moyen</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Facture liée</TableHead>
                <TableHead>ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs">
                    {new Date(row.createdAt).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell>
                    {row.folio.stay.guest.nom} {row.folio.stay.guest.prenom}
                  </TableCell>
                  <TableCell className="text-xs">
                    #{row.folio.stay.id}
                  </TableCell>
                  <TableCell>{row.folio.stay.room.numero}</TableCell>
                  <TableCell>{MOYEN_LABEL[row.moyen]}</TableCell>
                  <TableCell className="text-right">
                    <MoneyDisplay value={row.montant} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.invoice?.numero ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    #{row.id}
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
