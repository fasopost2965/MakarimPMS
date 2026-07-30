import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toastManager } from '@/components/ui/toast';
import { listRooms } from '../../reservations/api';
import type { Room } from '../../reservations/types';
import {
  listMovements,
  listStockItems,
  manualStockOut,
  replenishStock,
} from '../api';
import type { StockItem, StockMovement } from '../types';

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// Inventaire (docs/modules/stock.md ; refonte visuelle batch 3 design
// handoff, Stock.dc.html) : page unique à sections empilées (KPI, articles,
// journal des mouvements), remplace l'ancien commutateur d'onglets Articles/
// Mouvements — même convention que HrPage/GuestsPage. Consultation des
// niveaux (avec badge d'alerte sous seuil, BR-STK-002), réassort manuel,
// historique des mouvements. Le décompte automatique du kit d'accueil au
// ménage validé (BR-STK-001) n'a pas d'action manuelle — il se produit côté
// backend.
export function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replenishingItem, setReplenishingItem] = useState<StockItem | null>(
    null,
  );
  const [sortingOutItem, setSortingOutItem] = useState<StockItem | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);

  const kpi = useMemo(() => {
    const sousSeuil = items.filter((i) => i.sousSeuilAlerte).length;
    const entreesAujourdhui = movements
      .filter((m) => m.typeMouvement === 'ENTREE' && isToday(m.createdAt))
      .reduce((sum, m) => sum + m.quantite, 0);
    const sortiesAujourdhui = movements
      .filter((m) => m.typeMouvement === 'SORTIE' && isToday(m.createdAt))
      .reduce((sum, m) => sum + m.quantite, 0);
    return {
      total: items.length,
      sousSeuil,
      entreesAujourdhui,
      sortiesAujourdhui,
    };
  }, [items, movements]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [itemsData, movementsData, roomsData] = await Promise.all([
        listStockItems(),
        listMovements(),
        listRooms(),
      ]);
      setItems(itemsData);
      setMovements(movementsData);
      setRooms(roomsData);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  return (
    <div className="flex h-full flex-col gap-5 overflow-auto p-6">
      {loadError && <p className="text-destructive text-sm">{loadError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3">
            <div className="flex flex-col gap-2 rounded-lg border p-4">
              <span className="text-muted-foreground text-[10.5px] font-bold tracking-wide uppercase">
                Articles suivis
              </span>
              <span className="text-2xl font-bold tracking-tight">
                {kpi.total}
              </span>
            </div>
            <div
              className={`flex flex-col gap-2 rounded-lg border p-4 ${
                kpi.sousSeuil > 0 ? 'border-destructive/40' : ''
              }`}
            >
              <span
                className={`text-[10.5px] font-bold tracking-wide uppercase ${
                  kpi.sousSeuil > 0
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}
              >
                Sous seuil critique
              </span>
              <span
                className={`text-2xl font-bold tracking-tight ${
                  kpi.sousSeuil > 0 ? 'text-destructive' : ''
                }`}
              >
                {kpi.sousSeuil}
              </span>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border p-4">
              <span className="text-muted-foreground text-[10.5px] font-bold tracking-wide uppercase">
                Entrées aujourd'hui
              </span>
              <span className="text-success text-2xl font-bold tracking-tight">
                {kpi.entreesAujourdhui}
              </span>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border p-4">
              <span className="text-muted-foreground text-[10.5px] font-bold tracking-wide uppercase">
                Sorties aujourd'hui
              </span>
              <span className="text-2xl font-bold tracking-tight">
                {kpi.sortiesAujourdhui}
              </span>
            </div>
          </div>

          <div className="bg-card overflow-hidden rounded-lg border">
            <div className="border-b px-4.5 py-3.5">
              <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                Articles en stock
              </span>
            </div>
            <div className="overflow-x-auto">
              <div className="bg-muted/60 text-muted-foreground grid min-w-[720px] grid-cols-[110px_minmax(150px,2fr)_90px_70px_70px_90px_100px_150px] gap-2 px-4.5 py-2 text-[11px] font-bold">
                <span>Code</span>
                <span>Libellé</span>
                <span>Disponible</span>
                <span>Seuil</span>
                <span>Unité</span>
                <span>Kit accueil</span>
                <span>Statut</span>
                <span className="text-right">Action</span>
              </div>
              {items.length === 0 ? (
                <p className="text-muted-foreground px-4.5 py-3 text-sm">
                  Aucun article.
                </p>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="grid min-w-[720px] grid-cols-[110px_minmax(150px,2fr)_90px_70px_70px_90px_100px_150px] items-center gap-2 border-t px-4.5 py-2.5 text-sm"
                  >
                    <span className="text-muted-foreground truncate font-mono text-xs">
                      {item.code}
                    </span>
                    <span className="truncate">{item.libelle}</span>
                    <span>{item.quantiteDisponible}</span>
                    <span>{item.seuilAlerte}</span>
                    <span className="text-muted-foreground text-xs">
                      {item.uniteMesure}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {item.kitAccueil ? 'Oui' : 'Non'}
                    </span>
                    <Badge
                      variant={item.sousSeuilAlerte ? 'destructive' : 'success'}
                      className="w-fit"
                    >
                      {item.sousSeuilAlerte ? 'Sous seuil' : 'OK'}
                    </Badge>
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        className="text-primary text-xs font-semibold hover:underline"
                        onClick={() => setReplenishingItem(item)}
                      >
                        Réassort
                      </button>
                      <button
                        type="button"
                        className="text-primary text-xs font-semibold hover:underline"
                        onClick={() => setSortingOutItem(item)}
                      >
                        Sortie
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-card overflow-hidden rounded-lg border">
            <div className="border-b px-4.5 py-3.5">
              <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                Journal des mouvements
              </span>
            </div>
            <div className="overflow-x-auto">
              <div className="bg-muted/60 text-muted-foreground grid min-w-[720px] grid-cols-[130px_90px_minmax(0,1fr)_90px_minmax(0,1fr)] gap-2 px-4.5 py-2 text-[11px] font-bold">
                <span>Date</span>
                <span>Type</span>
                <span>Article</span>
                <span>Quantité</span>
                <span>Motif</span>
              </div>
              {movements.length === 0 ? (
                <p className="text-muted-foreground px-4.5 py-3 text-sm">
                  Aucun mouvement.
                </p>
              ) : (
                movements.map((m) => (
                  <div
                    key={m.id}
                    className="grid min-w-[720px] grid-cols-[130px_90px_minmax(0,1fr)_90px_minmax(0,1fr)] items-center gap-2 border-t px-4.5 py-2.5 text-sm"
                  >
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(m.createdAt).toLocaleString('fr-FR')}
                    </span>
                    <Badge
                      variant={
                        m.typeMouvement === 'ENTREE' ? 'success' : 'outline'
                      }
                      className="w-fit"
                    >
                      {m.typeMouvement === 'ENTREE' ? 'Entrée' : 'Sortie'}
                    </Badge>
                    <span className="text-muted-foreground truncate">
                      {m.stockItem?.libelle ?? `Article #${m.stockItemId}`}
                    </span>
                    <span className="font-mono">
                      {m.typeMouvement === 'ENTREE' ? '+' : '−'}
                      {m.quantite}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {m.motif}
                      {m.room ? ` — Chambre ${m.room.numero}` : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      <Dialog
        open={replenishingItem !== null}
        onOpenChange={(next) => !next && setReplenishingItem(null)}
      >
        <DialogContent>
          {replenishingItem && (
            <ReplenishForm
              item={replenishingItem}
              onClose={() => setReplenishingItem(null)}
              onDone={async () => {
                setReplenishingItem(null);
                await refetch();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={sortingOutItem !== null}
        onOpenChange={(next) => !next && setSortingOutItem(null)}
      >
        <DialogContent>
          {sortingOutItem && (
            <ManualStockOutForm
              item={sortingOutItem}
              rooms={rooms}
              onClose={() => setSortingOutItem(null)}
              onDone={async () => {
                setSortingOutItem(null);
                await refetch();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ReplenishFormProps {
  item: StockItem;
  onClose: () => void;
  onDone: () => void;
}

function ReplenishForm({ item, onClose, onDone }: ReplenishFormProps) {
  const [quantite, setQuantite] = useState('');
  const [referenceFournisseur, setReferenceFournisseur] = useState('');
  const [motif, setMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = quantite && Number(quantite) > 0 && motif;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await replenishStock({
        stockItemId: item.id,
        quantite: Number(quantite),
        motif,
        referenceFournisseur: referenceFournisseur || undefined,
      });
      // CH-032 (Lot B3) — auparavant silencieux (le dialogue se fermait
      // sans confirmation) ; EXIGENCES_UX.md : « une confirmation dit ce
      // qui s'est passé ».
      toastManager.add({
        title: 'Réassort enregistré',
        description: `+${quantite} ${item.uniteMesure} — ${item.libelle}`,
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
        <DialogTitle>Réassort — {item.libelle}</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quantite">Quantité reçue ({item.uniteMesure})</Label>
          <Input
            id="quantite"
            type="number"
            min="1"
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="referenceFournisseur">
            Référence fournisseur (bon de livraison)
          </Label>
          <Input
            id="referenceFournisseur"
            value={referenceFournisseur}
            onChange={(e) => setReferenceFournisseur(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="motif">Motif</Label>
          <Input
            id="motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. Livraison hebdomadaire fournisseur habituel"
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
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

interface ManualStockOutFormProps {
  item: StockItem;
  rooms: Room[];
  onClose: () => void;
  onDone: () => void;
}

// CH-039/CH-052 (docs/execution/PLAN_FRONTEND_PARITE_ADMIN.md §2) — sortie
// manuelle : réfection de chambre (roomId choisi), consommation minibar, ou
// constat de perte/casse/péremption (roomId laissé sur « Aucune »). Motif
// toujours obligatoire (BR-STK-003), même rigueur que ReplenishForm.
function ManualStockOutForm({
  item,
  rooms,
  onClose,
  onDone,
}: ManualStockOutFormProps) {
  const [quantite, setQuantite] = useState('');
  const [roomId, setRoomId] = useState<string>('NONE');
  const [motif, setMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = quantite && Number(quantite) > 0 && motif.length >= 10;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await manualStockOut({
        stockItemId: item.id,
        quantite: Number(quantite),
        motif,
        roomId: roomId === 'NONE' ? undefined : Number(roomId),
      });
      toastManager.add({
        title: 'Sortie enregistrée',
        description: `−${quantite} ${item.uniteMesure} — ${item.libelle}`,
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
        <DialogTitle>Sortie manuelle — {item.libelle}</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sortieQuantite">
            Quantité sortie ({item.uniteMesure})
          </Label>
          <Input
            id="sortieQuantite"
            type="number"
            min="1"
            max={item.quantiteDisponible}
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            required
          />
          <span className="text-muted-foreground text-xs">
            Disponible : {item.quantiteDisponible} {item.uniteMesure}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sortieChambre">
            Chambre concernée (optionnel — laisser vide pour une perte/casse)
          </Label>
          <Select value={roomId} onValueChange={(v) => v && setRoomId(v)}>
            <SelectTrigger id="sortieChambre">
              <SelectValue placeholder="Aucune (perte/casse/péremption)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">
                Aucune (perte/casse/péremption)
              </SelectItem>
              {rooms.map((room) => (
                <SelectItem key={room.id} value={String(room.id)}>
                  Chambre {room.numero}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sortieMotif">Motif (≥ 10 caractères)</Label>
          <Input
            id="sortieMotif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. Réfection chambre — linge envoyé en buanderie"
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
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
