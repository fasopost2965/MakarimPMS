import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
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
import { Tabs, TabsList, TabsPanel, TabsTrigger } from '@/components/ui/tabs';
import { toastManager } from '@/components/ui/toast';
import {
  addRestaurantCharge,
  getDailyReport,
  listStaysInHouse,
  updateRestaurantCharge,
} from '../api';
import type {
  RestaurantDailyReportRoom,
  RestaurantStayInHouse,
} from '../types';

type RestaurantView = 'sejours' | 'rapport';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// F11 (docs/modules/restaurant.md, RD-025) — intercepte le flux papier
// « le restaurant envoie un ticket à la réception » : le compte
// RESTAURATEUR saisit directement la note restaurant sur le séjour
// concerné, sans validation réception intermédiaire (RD-F11-01). Deux vues
// (même convention que StockPage) : séjours en cours pour ajouter une note,
// rapport du jour pour la double vérification a posteriori (jamais
// bloquante, RestaurantService.getDailyReport).
export function RestaurantPage() {
  const [stays, setStays] = useState<RestaurantStayInHouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<RestaurantView>('sejours');
  const [chargingStay, setChargingStay] =
    useState<RestaurantStayInHouse | null>(null);

  const [reportDate, setReportDate] = useState(todayIso());
  const [report, setReport] = useState<RestaurantDailyReportRoom[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [correctingCharge, setCorrectingCharge] = useState<{
    stayId: number;
    charge: RestaurantDailyReportRoom['charges'][number];
  } | null>(null);

  const refetchStays = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setStays(await listStaysInHouse());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  const refetchReport = useCallback(async (date: string) => {
    setReportLoading(true);
    setReportError(null);
    try {
      setReport(await getDailyReport(date));
    } catch (err) {
      setReportError(
        err instanceof Error ? err.message : 'Erreur de chargement',
      );
    } finally {
      setReportLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetchStays();
  }, [refetchStays]);

  useEffect(() => {
    if (view !== 'rapport') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetchReport(reportDate);
  }, [view, reportDate, refetchReport]);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {loadError && <p className="text-destructive text-sm">{loadError}</p>}

      <Tabs
        value={view}
        onValueChange={(v) => v && setView(v as RestaurantView)}
        className="flex flex-1 flex-col gap-4"
      >
        <TabsList className="w-fit">
          <TabsTrigger value="sejours">Séjours en cours</TabsTrigger>
          <TabsTrigger value="rapport">Rapport du jour</TabsTrigger>
        </TabsList>

        <TabsPanel value="sejours">
          {loading ? (
            <p className="text-muted-foreground text-sm">Chargement…</p>
          ) : stays.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aucun séjour en cours actuellement.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {stays.map((stay) => (
                <div
                  key={stay.stayId}
                  className="flex flex-col gap-2 rounded-md border p-3"
                >
                  <p className="text-sm font-medium">
                    Chambre {stay.roomNumber}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {stay.guestName}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Départ prévu :{' '}
                    {new Date(stay.checkoutDate).toLocaleDateString('fr-FR')}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-fit"
                    onClick={() => setChargingStay(stay)}
                  >
                    Ajouter une note
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsPanel>

        <TabsPanel value="rapport" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 sm:w-64">
            <Label htmlFor="reportDate">Date</Label>
            <Input
              id="reportDate"
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
          </div>

          {reportError && (
            <p className="text-destructive text-sm">{reportError}</p>
          )}

          {reportLoading ? (
            <p className="text-muted-foreground text-sm">Chargement…</p>
          ) : report.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aucune note restaurant enregistrée ce jour-là.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {report.map((room) => (
                <div
                  key={room.stayId}
                  className="flex flex-col gap-2 rounded-md border p-3"
                >
                  <p className="text-sm font-medium">
                    Chambre {room.roomNumber}
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {room.charges.map((charge) => (
                      <li
                        key={charge.id}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span
                          className={
                            charge.annulee
                              ? 'text-muted-foreground line-through'
                              : ''
                          }
                        >
                          {charge.libelle} — {charge.montant} MAD
                        </span>
                        <span className="flex items-center gap-1.5">
                          {charge.annulee ? (
                            <Badge variant="secondary">Annulée</Badge>
                          ) : (
                            <button
                              type="button"
                              className="text-primary hover:underline"
                              onClick={() =>
                                setCorrectingCharge({
                                  stayId: room.stayId,
                                  charge,
                                })
                              }
                            >
                              Corriger
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </TabsPanel>
      </Tabs>

      <Dialog
        open={chargingStay !== null}
        onOpenChange={(next) => !next && setChargingStay(null)}
      >
        <DialogContent>
          {chargingStay && (
            <AddChargeForm
              stay={chargingStay}
              onClose={() => setChargingStay(null)}
              onDone={async () => {
                setChargingStay(null);
                await refetchStays();
                if (view === 'rapport') await refetchReport(reportDate);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={correctingCharge !== null}
        onOpenChange={(next) => !next && setCorrectingCharge(null)}
      >
        <DialogContent>
          {correctingCharge && (
            <CorrectChargeForm
              charge={correctingCharge.charge}
              onClose={() => setCorrectingCharge(null)}
              onDone={async () => {
                setCorrectingCharge(null);
                await refetchReport(reportDate);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AddChargeFormProps {
  stay: RestaurantStayInHouse;
  onClose: () => void;
  onDone: () => void;
}

function AddChargeForm({ stay, onClose, onDone }: AddChargeFormProps) {
  const [libelle, setLibelle] = useState('');
  const [montant, setMontant] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = libelle.trim() && Number(montant) > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await addRestaurantCharge({
        stayId: stay.stayId,
        libelle,
        montant,
        commentaire: commentaire || undefined,
      });
      toastManager.add({
        title: 'Note restaurant ajoutée',
        description: `Chambre ${stay.roomNumber} — ${libelle}, ${montant} MAD`,
        type: 'success',
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Note restaurant — Chambre {stay.roomNumber} ({stay.guestName})
        </DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="libelle">Libellé</Label>
          <Input
            id="libelle"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Ex. Dîner du 30/07 — 2 couverts"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="montant">Montant (MAD)</Label>
          <Input
            id="montant"
            type="number"
            min="0.01"
            step="0.01"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="commentaire">Commentaire (optionnel)</Label>
          <Input
            id="commentaire"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
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
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? 'Enregistrement…' : 'Ajouter au folio'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

interface CorrectChargeFormProps {
  charge: RestaurantDailyReportRoom['charges'][number];
  onClose: () => void;
  onDone: () => void;
}

// RD-F11-02 — jamais de mutation directe : le motif justifie l'écart avec
// la note initiale (annulation soft + recréation côté backend), même
// discipline que la correction de ligne de folio EXTRA (BillingTabContent).
function CorrectChargeForm({
  charge,
  onClose,
  onDone,
}: CorrectChargeFormProps) {
  const [libelle, setLibelle] = useState(charge.libelle);
  const [montant, setMontant] = useState(charge.montant);
  const [commentaire, setCommentaire] = useState('');
  const [motif, setMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = libelle.trim() && Number(montant) > 0 && motif.length >= 10;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateRestaurantCharge(charge.id, {
        libelle,
        montant,
        commentaire: commentaire || undefined,
        motif,
      });
      toastManager.add({
        title: 'Note restaurant corrigée',
        description: `${libelle} — ${montant} MAD`,
        type: 'success',
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Corriger la note — {charge.libelle}</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="correctLibelle">Libellé</Label>
          <Input
            id="correctLibelle"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="correctMontant">Montant (MAD)</Label>
          <Input
            id="correctMontant"
            type="number"
            min="0.01"
            step="0.01"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="correctCommentaire">Commentaire (optionnel)</Label>
          <Input
            id="correctCommentaire"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="correctMotif">
            Motif de la correction (≥ 10 caractères)
          </Label>
          <Input
            id="correctMotif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. Erreur de saisie sur le montant initial"
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
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? 'Enregistrement…' : 'Corriger'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
