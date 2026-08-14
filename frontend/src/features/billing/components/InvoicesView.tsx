import { useEffect, useState } from 'react';
import { Download, Printer, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import {
  downloadInvoicePdf,
  listInvoices,
  requestInvoiceDelivery,
} from '../api';
import type { InvoiceListItem } from '../types';

const STATUT_LABEL: Record<InvoiceListItem['statut'], string> = {
  EMISE: 'Émise',
  ANNULEE_PAR_AVOIR: 'Annulée par avoir',
};

const ALL = '__ALL__';

interface Props {
  from: string;
  to: string;
  search: string;
  refreshKey: number;
  onSelectInvoice: (invoiceId: number) => void;
  // DESIGN-010 (correction RBAC finale suite) — billing:send, permission
  // dédiée indépendante de billing:write, seule action write-adjacente de
  // cette vue (Télécharger/Voir/Imprimer restent des lectures pures, voir
  // seed.ts/BillingPage.tsx).
  canSend: boolean;
}

// DESIGN-010 (mission §11) — onglet Factures. La recherche texte
// (numéro/client/chambre) est appliquée côté client sur la page chargée :
// GET /invoices ne combine pas ces trois champs en une seule recherche
// plein texte (mission §3, filtres distincts uniquement) — limite connue,
// documentée plutôt que contournée par une fausse recherche globale.
export function InvoicesView({
  from,
  to,
  search,
  refreshKey,
  onSelectInvoice,
  canSend,
}: Props) {
  const [statutFilter, setStatutFilter] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<InvoiceListItem[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [from, to, statutFilter, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    listInvoices({
      from: from || undefined,
      to: to || undefined,
      statut:
        statutFilter === ALL
          ? undefined
          : (statutFilter as InvoiceListItem['statut']),
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
  }, [from, to, statutFilter, page, refreshKey]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.numero.toLowerCase().includes(q) ||
      `${r.folio.stay.guest.nom} ${r.folio.stay.guest.prenom}`
        .toLowerCase()
        .includes(q) ||
      r.folio.stay.room.numero.toLowerCase().includes(q) ||
      String(r.folio.stay.id).includes(q)
    );
  });

  async function handleDownload(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    setDownloadingId(id);
    try {
      await downloadInvoicePdf(id);
    } catch {
      // Erreur de téléchargement affichée globalement plus haut serait
      // trompeuse (elle ne concernerait qu'une ligne) — silencieux ici,
      // le bouton reprend son état normal (comportement identique à
      // BillingTabContent existant).
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleSend(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    setSendingId(id);
    try {
      await requestInvoiceDelivery(id);
    } catch {
      // Voir handleDownload — le résultat réel se consulte dans le journal
      // de notifications (mission §15).
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {meta.total} facture{meta.total > 1 ? 's' : ''}
        </p>
        <Select
          value={statutFilter}
          onValueChange={(v) => v && setStatutFilter(v)}
          items={[
            { value: ALL, label: 'Tous statuts' },
            { value: 'EMISE', label: 'Émise' },
            { value: 'ANNULEE_PAR_AVOIR', label: 'Annulée par avoir' },
          ]}
        >
          <SelectTrigger className="h-8 w-48 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous statuts</SelectItem>
            <SelectItem value="EMISE">Émise</SelectItem>
            <SelectItem value="ANNULEE_PAR_AVOIR">Annulée par avoir</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucune facture"
          description="Aucune facture ne correspond aux filtres actuels."
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° facture</TableHead>
                <TableHead>Date émission</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Séjour</TableHead>
                <TableHead>Chambre</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => onSelectInvoice(row.id)}
                >
                  <TableCell className="font-mono text-xs">
                    {row.numero}
                  </TableCell>
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
                  <TableCell className="text-right">
                    <MoneyDisplay value={row.montantTotal} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.statut === 'EMISE' ? 'success' : 'destructive'
                      }
                    >
                      {STATUT_LABEL[row.statut]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        title="Télécharger le PDF"
                        disabled={downloadingId === row.id}
                        onClick={(e) => void handleDownload(row.id, e)}
                      >
                        <Download className="size-3.5" />
                      </Button>
                      {canSend && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title="Envoyer par email/WhatsApp"
                          disabled={sendingId === row.id}
                          onClick={(e) => void handleSend(row.id, e)}
                        >
                          <Send className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        title="Voir / imprimer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectInvoice(row.id);
                        }}
                      >
                        <Printer className="size-3.5" />
                      </Button>
                    </div>
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
