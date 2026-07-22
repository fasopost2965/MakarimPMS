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
import { listMovements, listStockItems, replenishStock } from '../api';
import type { StockItem, StockMovement } from '../types';

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
  const [showMovements, setShowMovements] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [itemsData, movementsData] = await Promise.all([
        listStockItems(),
        listMovements(),
      ]);
      setItems(itemsData);
      setMovements(movementsData);
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium">Stock</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowMovements((v) => !v)}
        >
          {showMovements ? 'Voir les articles' : 'Voir les mouvements'}
        </Button>
      </div>

      {loadError && <p className="text-destructive text-sm">{loadError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : showMovements ? (
        <div className="flex flex-col gap-2">
          {movements.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun mouvement.</p>
          ) : (
            movements.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <div>
                  <p>
                    {m.typeMouvement === 'ENTREE' ? '+ ' : '− '}
                    {m.quantite} — article #{m.stockItemId}
                  </p>
                  <p className="text-muted-foreground text-xs">{m.motif}</p>
                </div>
                <span className="text-muted-foreground text-xs">
                  {new Date(m.createdAt).toLocaleString('fr-FR')}
                </span>
              </div>
            ))
          )}
        </div>
      ) : (
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
              <Button
                size="sm"
                variant="outline"
                className="w-fit"
                onClick={() => setReplenishingItem(item)}
              >
                Réassort
              </Button>
            </div>
          ))}
        </div>
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
