import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createPayment } from '../api';
import type { MoyenPaiement } from '../types';
import { getFolio } from '@/features/billing/api';
import type { FolioSummary } from '@/features/billing/types';

const MOYENS: MoyenPaiement[] = ['ESPECES', 'CARTE', 'VIREMENT', 'ACOMPTE'];

const MOYEN_LABEL: Record<MoyenPaiement, string> = {
  ESPECES: 'Espèces',
  CARTE: 'Carte',
  VIREMENT: 'Virement',
  ACOMPTE: 'Acompte',
};

interface Props {
  open: boolean;
  folioId: number;
  onClose: () => void;
  onRecorded: () => void;
}

// UX-001B — évite un solde négatif affiché (ex. -0.00 par arrondi) : le
// solde dû réel ne devient jamais négatif (computeSoldeDu, backend), mais
// un folio déjà réglé/trop réglé doit toujours s'afficher à 0.00, jamais
// en négatif côté agent.
function formatMontant(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return Math.max(n, 0).toFixed(2);
}

// Encaissement d'un règlement sur un folio (docs/modules/payments.md §4) —
// idempotencyKey générée côté client à l'ouverture du dialogue, pas à
// chaque frappe, pour qu'un double-clic sur "Enregistrer" ne crée jamais
// deux paiements distincts.
//
// UX-001B — l'agent n'a plus à se souvenir d'un solde vu sur un autre écran
// (StayDetailsDialog) : ce dialogue charge lui-même la synthèse de solde du
// folio (GET /folios/:id, champ `synthese` — seule source de vérité,
// jamais recalculée ici à partir des lignes) et préremplit le montant à
// encaisser avec le reste à payer (FIN-001/ADR-008), tout en laissant
// l'agent le réduire librement pour un paiement partiel.
export function RecordPaymentDialog({
  open,
  folioId,
  onClose,
  onRecorded,
}: Props) {
  const [moyen, setMoyen] = useState<MoyenPaiement>('ESPECES');
  const [montant, setMontant] = useState('');
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<FolioSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  // UX-001B — distinct de `error` (réservé aux échecs de POST /payments) :
  // un échec de chargement du solde ne doit jamais être confondu avec un
  // échec d'enregistrement, ni disparaître silencieusement derrière un
  // formulaire qui aurait l'air normal.
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Repart de zéro à chaque changement de folio/séjour : jamais de fuite
    // d'un montant/solde saisi ou chargé pour un folio précédent vers le
    // suivant (un dialogue ré-ouvert sur un autre séjour doit toujours
    // repartir d'un état vierge, jamais afficher un solde périmé).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingSummary(true);
    setSummary(null);
    setSummaryError(null);
    setMontant('');
    getFolio(folioId)
      .then((folio) => {
        if (cancelled || !folio.synthese) return;
        setSummary(folio.synthese);
        setMontant(formatMontant(folio.synthese.balanceTTC));
      })
      .catch((err) => {
        if (!cancelled) {
          // Jamais de solde affiché en cas d'échec de chargement : un faux
          // "0.00 MAD" laisserait croire à un séjour soldé alors que le
          // solde réel est simplement inconnu (dangereux — voir summary
          // resté `null` ci-dessus, jamais réécrit ici).
          setSummaryError(
            err instanceof Error
              ? err.message
              : 'Erreur de chargement du solde',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSummary(false);
      });
    return () => {
      cancelled = true;
    };
  }, [folioId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!montant) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPayment({ folioId, moyen, montant, idempotencyKey });
      onRecorded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encaisser un paiement</DialogTitle>
        </DialogHeader>

        {loadingSummary ? (
          <p className="text-muted-foreground text-sm">Chargement du solde…</p>
        ) : summaryError ? (
          <div
            role="alert"
            className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
          >
            <p className="font-medium">Impossible de charger le solde</p>
            <p>
              Le montant à encaisser n&apos;a pas été préempli. Vérifiez le
              solde manuellement avant de saisir un montant.
            </p>
          </div>
        ) : (
          summary && (
            <div className="grid grid-cols-3 gap-2 rounded-md border bg-gray-50 p-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase">
                  Total du séjour
                </p>
                <p className="font-mono font-medium">
                  {formatMontant(summary.totalChargesTTC)} MAD
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase">
                  Déjà payé
                </p>
                <p className="font-mono font-medium">
                  {formatMontant(summary.totalPaidTTC)} MAD
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase">
                  Reste à payer
                </p>
                <p className="font-mono font-semibold">
                  {formatMontant(summary.balanceTTC)} MAD
                </p>
              </div>
            </div>
          )
        )}

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="moyen">Moyen de paiement</Label>
            <Select
              value={moyen}
              onValueChange={(v) => v && setMoyen(v as MoyenPaiement)}
              items={MOYENS.map((m) => ({ value: m, label: MOYEN_LABEL[m] }))}
            >
              <SelectTrigger id="moyen" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOYENS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MOYEN_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="montant">Montant à encaisser (MAD)</Label>
            <Input
              id="montant"
              type="number"
              step="0.01"
              min="0.01"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={submitting || !montant}>
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
