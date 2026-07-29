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
import { Tabs, TabsList, TabsPanel, TabsTrigger } from '@/components/ui/tabs';
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

type StockView = 'articles' | 'mouvements';

// Inventaire (docs/modules/stock.md) : consultation des niveaux (avec badge
// d'alerte sous seuil, BR-STK-002), réassort manuel, historique des
// mouvements. Le décompte automatique du kit d'accueil au ménage validé
// (BR-STK-001) n'a pas d'action manuelle — il se produit côté backend.
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
  const [view, setView] = useState<StockView>('articles');

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
    <div className="flex h-full flex-col gap-4 p-6">
      {loadError && <p className="text-destructive text-sm">{loadError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : (
        <Tabs
          value={view}
          onValueChange={(v) => v && setView(v as StockView)}
          className="flex flex-1 flex-col gap-4"
        >
          <TabsList className="w-fit">
            <TabsTrigger value="articles">Articles</TabsTrigger>
            <TabsTrigger value="mouvements">Mouvements</TabsTrigger>
          </TabsList>

          <TabsPanel value="articles">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-md border p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{item.libelle}</p>
                    {item.sousSeuilAlerte && (
                      <Badge variant="destructive">Sous le seuil</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {item.code} — {item.quantiteDisponible} {item.uniteMesure}{' '}
                    (seuil {item.seuilAlerte})
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReplenishingItem(item)}
                    >
                      Réassort
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSortingOutItem(item)}
                    >
                      Sortie
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsPanel>

          <TabsPanel value="mouvements">
            {movements.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun mouvement.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Mouvement</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead>Article</TableHead>
                      <TableHead>Chambre</TableHead>
                      <TableHead>Motif</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleString('fr-FR')}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              m.typeMouvement === 'ENTREE'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {m.typeMouvement === 'ENTREE' ? 'Entrée' : 'Sortie'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {m.typeMouvement === 'ENTREE' ? '+' : '−'}
                          {m.quantite}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.stockItem?.libelle ?? `Article #${m.stockItemId}`}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.room ? `Chambre ${m.room.numero}` : '—'}
                        </TableCell>
                        <TableCell>{m.motif}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsPanel>
        </Tabs>
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
