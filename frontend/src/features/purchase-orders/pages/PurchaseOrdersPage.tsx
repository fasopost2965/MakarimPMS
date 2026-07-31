import { useCallback, useEffect, useState } from 'react';
import { Plus, ShoppingCart, Trash2, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
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
import { Tabs, TabsList, TabsPanel, TabsTrigger } from '@/components/ui/tabs';
import { toastManager } from '@/components/ui/toast';
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  createSupplier,
  listPurchaseOrders,
  listSuppliers,
  submitPurchaseOrder,
  validatePurchaseOrder,
} from '../api';
import type { PurchaseOrder, PurchaseOrderLineInput, Supplier } from '../types';
import { PurchaseOrderPrintModal } from '../components/PurchaseOrderPrintModal';

const STATUT_BADGE: Record<
  PurchaseOrder['statut'],
  {
    label: string;
    variant: 'secondary' | 'warning' | 'success' | 'destructive';
  }
> = {
  BROUILLON: { label: 'Brouillon', variant: 'secondary' },
  EN_ATTENTE_VALIDATION: { label: 'En attente', variant: 'warning' },
  VALIDEE: { label: 'Validé', variant: 'success' },
  ANNULEE: { label: 'Annulé', variant: 'destructive' },
};

function totalOf(po: PurchaseOrder) {
  return po.lignes.reduce((sum, l) => sum + Number(l.montant), 0);
}

// Lot 8 (Handoff final) — module Économat (Supplier + PurchaseOrder),
// backend/src/modules/purchase-orders. Deux onglets : Bons de commande
// (workflow BROUILLON → EN_ATTENTE_VALIDATION → VALIDEE/ANNULEE) et
// Fournisseurs (carnet d'adresses minimal). Aucune gestion RBAC fine côté
// client sur le bouton « Valider » (purchase-orders:valider, réservé à
// l'Administrateur) — même convention que checkin:force-checkout/
// guests:blacklist ailleurs dans ce projet : le bouton reste visible à
// quiconque a accès à cet onglet, le backend rejette en 403 si la
// permission dédiée manque, message d'erreur affiché tel quel.
export function PurchaseOrdersPage() {
  const [view, setView] = useState<'bons' | 'fournisseurs'>('bons');
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [printing, setPrinting] = useState<PurchaseOrder | null>(null);
  const [actionTarget, setActionTarget] = useState<{
    po: PurchaseOrder;
    action: 'valider' | 'annuler';
  } | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [pos, sups] = await Promise.all([
        listPurchaseOrders(),
        listSuppliers(),
      ]);
      setPurchaseOrders(pos);
      setSuppliers(sups);
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

  async function handleSubmit(po: PurchaseOrder) {
    try {
      await submitPurchaseOrder(po.id);
      toastManager.add({
        title: 'Bon soumis pour validation',
        description: po.numero,
        type: 'success',
      });
      await refetch();
    } catch (err) {
      toastManager.add({
        title: 'Échec de la soumission',
        description: err instanceof Error ? err.message : 'Erreur',
        type: 'error',
      });
    }
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-auto p-6">
      {loadError && <p className="text-destructive text-sm">{loadError}</p>}

      <Tabs
        value={view}
        onValueChange={(v) => v && setView(v as 'bons' | 'fournisseurs')}
        className="flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <TabsList className="w-fit">
            <TabsTrigger value="bons">Bons de commande</TabsTrigger>
            <TabsTrigger value="fournisseurs">Fournisseurs</TabsTrigger>
          </TabsList>
          {view === 'bons' && (
            <Button
              type="button"
              onClick={() => setCreating(true)}
              disabled={suppliers.length === 0}
              title={
                suppliers.length === 0
                  ? "Créez d'abord un fournisseur"
                  : undefined
              }
            >
              <Plus className="size-4" />
              Nouveau bon
            </Button>
          )}
        </div>

        <TabsPanel value="bons">
          {loading ? (
            <p className="text-muted-foreground text-sm">Chargement…</p>
          ) : purchaseOrders.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart className="size-6" strokeWidth={1.7} />}
              title="Aucun bon de commande"
              description="Créez un bon de commande pour un réassort fournisseur."
            />
          ) : (
            <div className="bg-card overflow-hidden rounded-lg border">
              <div className="overflow-x-auto">
                <div className="bg-muted/60 text-muted-foreground grid min-w-[820px] grid-cols-[140px_minmax(150px,2fr)_130px_110px_100px_minmax(200px,1.5fr)] gap-2 px-4.5 py-2 text-[11px] font-bold">
                  <span>N°</span>
                  <span>Fournisseur</span>
                  <span>Statut</span>
                  <span className="text-right">Total HT</span>
                  <span>Date</span>
                  <span className="text-right">Actions</span>
                </div>
                {purchaseOrders.map((po) => {
                  const badge = STATUT_BADGE[po.statut];
                  return (
                    <div
                      key={po.id}
                      className="grid min-w-[820px] grid-cols-[140px_minmax(150px,2fr)_130px_110px_100px_minmax(200px,1.5fr)] items-center gap-2 border-t px-4.5 py-2.5 text-sm"
                    >
                      <span className="font-mono text-xs">{po.numero}</span>
                      <span className="truncate">{po.supplier.nom}</span>
                      <Badge variant={badge.variant} className="w-fit">
                        {badge.label}
                      </Badge>
                      <span className="text-right font-mono">
                        {totalOf(po).toFixed(2)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {new Date(po.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                      <div className="flex flex-wrap justify-end gap-3">
                        <button
                          type="button"
                          className="text-primary text-xs font-semibold hover:underline"
                          onClick={() => setPrinting(po)}
                        >
                          Voir / Imprimer
                        </button>
                        {po.statut === 'BROUILLON' && (
                          <button
                            type="button"
                            className="text-primary text-xs font-semibold hover:underline"
                            onClick={() => void handleSubmit(po)}
                          >
                            Soumettre
                          </button>
                        )}
                        {po.statut === 'EN_ATTENTE_VALIDATION' && (
                          <button
                            type="button"
                            className="text-success text-xs font-semibold hover:underline"
                            onClick={() =>
                              setActionTarget({ po, action: 'valider' })
                            }
                          >
                            Valider
                          </button>
                        )}
                        {(po.statut === 'BROUILLON' ||
                          po.statut === 'EN_ATTENTE_VALIDATION') && (
                          <button
                            type="button"
                            className="text-destructive text-xs font-semibold hover:underline"
                            onClick={() =>
                              setActionTarget({ po, action: 'annuler' })
                            }
                          >
                            Annuler
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsPanel>

        <TabsPanel value="fournisseurs">
          <SuppliersSection
            suppliers={suppliers}
            loading={loading}
            onCreated={refetch}
          />
        </TabsPanel>
      </Tabs>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-lg">
          {creating && (
            <CreatePurchaseOrderForm
              suppliers={suppliers}
              onClose={() => setCreating(false)}
              onDone={async () => {
                setCreating(false);
                await refetch();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <PurchaseOrderPrintModal
        open={printing !== null}
        onClose={() => setPrinting(null)}
        purchaseOrder={printing}
      />

      <Dialog
        open={actionTarget !== null}
        onOpenChange={(next) => !next && setActionTarget(null)}
      >
        <DialogContent>
          {actionTarget && (
            <MotifActionForm
              title={
                actionTarget.action === 'valider'
                  ? `Valider ${actionTarget.po.numero}`
                  : `Annuler ${actionTarget.po.numero}`
              }
              destructive={actionTarget.action === 'annuler'}
              onClose={() => setActionTarget(null)}
              onSubmit={async (motif) => {
                if (actionTarget.action === 'valider') {
                  await validatePurchaseOrder(actionTarget.po.id, motif);
                } else {
                  await cancelPurchaseOrder(actionTarget.po.id, motif);
                }
              }}
              onDone={async () => {
                setActionTarget(null);
                await refetch();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CreatePurchaseOrderFormProps {
  suppliers: Supplier[];
  onClose: () => void;
  onDone: () => void;
}

function CreatePurchaseOrderForm({
  suppliers,
  onClose,
  onDone,
}: CreatePurchaseOrderFormProps) {
  const [supplierId, setSupplierId] = useState(String(suppliers[0]?.id ?? ''));
  const [demandeur, setDemandeur] = useState('');
  const [dateLivraison, setDateLivraison] = useState('');
  const [lignes, setLignes] = useState<PurchaseOrderLineInput[]>([
    { designation: '', quantite: 1, prixUnitaire: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = lignes.reduce(
    (sum, l) => sum + (l.quantite || 0) * (l.prixUnitaire || 0),
    0,
  );
  const canSubmit =
    supplierId &&
    demandeur.trim() &&
    lignes.length > 0 &&
    lignes.every(
      (l) => l.designation.trim() && l.quantite > 0 && l.prixUnitaire >= 0,
    );

  function updateLigne(index: number, patch: Partial<PurchaseOrderLineInput>) {
    setLignes((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const po = await createPurchaseOrder({
        supplierId: Number(supplierId),
        demandeur,
        dateLivraisonSouhaitee: dateLivraison || undefined,
        lignes,
      });
      toastManager.add({
        title: 'Bon de commande créé',
        description: `${po.numero} — brouillon`,
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
        <DialogTitle>Nouveau bon de commande</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="poSupplier">Fournisseur</Label>
          <Select
            value={supplierId}
            onValueChange={(v) => v && setSupplierId(v)}
          >
            <SelectTrigger id="poSupplier">
              <SelectValue placeholder="Choisir un fournisseur" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="poDemandeur">Demandeur</Label>
          <Input
            id="poDemandeur"
            value={demandeur}
            onChange={(e) => setDemandeur(e.target.value)}
            placeholder="Ex. Karim L. (Économat)"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="poDateLivraison">
            Livraison souhaitée avant le (optionnel)
          </Label>
          <Input
            id="poDateLivraison"
            type="date"
            value={dateLivraison}
            onChange={(e) => setDateLivraison(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Lignes</Label>
          {lignes.map((ligne, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1">
                {i === 0 && (
                  <span className="text-muted-foreground text-[10px] uppercase">
                    Désignation
                  </span>
                )}
                <Input
                  value={ligne.designation}
                  onChange={(e) =>
                    updateLigne(i, { designation: e.target.value })
                  }
                  placeholder="Ex. Draps housse 160×200"
                  required
                />
              </div>
              <div className="flex w-20 flex-col gap-1">
                {i === 0 && (
                  <span className="text-muted-foreground text-[10px] uppercase">
                    Qté
                  </span>
                )}
                <Input
                  type="number"
                  min="1"
                  value={ligne.quantite}
                  onChange={(e) =>
                    updateLigne(i, { quantite: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div className="flex w-24 flex-col gap-1">
                {i === 0 && (
                  <span className="text-muted-foreground text-[10px] uppercase">
                    PU (MAD)
                  </span>
                )}
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ligne.prixUnitaire}
                  onChange={(e) =>
                    updateLigne(i, { prixUnitaire: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={lignes.length === 1}
                onClick={() =>
                  setLignes((prev) => prev.filter((_, idx) => idx !== i))
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() =>
              setLignes((prev) => [
                ...prev,
                { designation: '', quantite: 1, prixUnitaire: 0 },
              ])
            }
          >
            <Plus className="size-4" />
            Ajouter une ligne
          </Button>
        </div>

        <div className="flex justify-end border-t pt-2 text-sm font-semibold">
          Total HT : {total.toFixed(2)} MAD
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
            {submitting ? 'Création…' : 'Créer le brouillon'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

interface MotifActionFormProps {
  title: string;
  destructive?: boolean;
  onClose: () => void;
  onSubmit: (motif: string) => Promise<void>;
  onDone: () => void;
}

// Formulaire générique motif ≥ 10 caractères, réutilisé pour Valider et
// Annuler (même rigueur ADR-005 que DeleteRoomDto/ValidatePurchaseOrderDto
// côté backend).
function MotifActionForm({
  title,
  destructive,
  onClose,
  onSubmit,
  onDone,
}: MotifActionFormProps) {
  const [motif, setMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = motif.trim().length >= 10;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(motif);
      toastManager.add({ title: `${title} — effectué`, type: 'success' });
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
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="motifAction">Motif (≥ 10 caractères)</Label>
          <Input
            id="motifAction"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. Validation budget confirmée par la Direction"
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
            Fermer
          </Button>
          <Button
            type="submit"
            variant={destructive ? 'destructive' : 'default'}
            disabled={submitting || !canSubmit}
          >
            {submitting ? 'Enregistrement…' : 'Confirmer'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

interface SuppliersSectionProps {
  suppliers: Supplier[];
  loading: boolean;
  onCreated: () => Promise<void>;
}

function SuppliersSection({
  suppliers,
  loading,
  onCreated,
}: SuppliersSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createSupplier({
        nom,
        adresse: adresse || undefined,
        email: email || undefined,
        telephone: telephone || undefined,
      });
      toastManager.add({
        title: 'Fournisseur créé',
        description: nom,
        type: 'success',
      });
      setNom('');
      setAdresse('');
      setEmail('');
      setTelephone('');
      setShowForm(false);
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="size-4" />
          Nouveau fournisseur
        </Button>
      </div>

      {showForm && (
        <form
          className="bg-card flex flex-col gap-3 rounded-lg border p-4"
          onSubmit={handleSubmit}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supNom">Nom</Label>
              <Input
                id="supNom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supAdresse">Adresse</Label>
              <Input
                id="supAdresse"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supEmail">Email</Label>
              <Input
                id="supEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supTelephone">Téléphone</Label>
              <Input
                id="supTelephone"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={submitting || !nom.trim()}>
              {submitting ? 'Création…' : 'Créer'}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={<Truck className="size-6" strokeWidth={1.7} />}
          title="Aucun fournisseur"
          description="Ajoutez un fournisseur pour pouvoir créer un bon de commande."
        />
      ) : (
        <div className="bg-card overflow-hidden rounded-lg border">
          <div className="bg-muted/60 text-muted-foreground grid min-w-[600px] grid-cols-[minmax(150px,2fr)_minmax(150px,2fr)_1fr] gap-2 px-4.5 py-2 text-[11px] font-bold">
            <span>Nom</span>
            <span>Adresse</span>
            <span>Contact</span>
          </div>
          {suppliers.map((s) => (
            <div
              key={s.id}
              className="grid min-w-[600px] grid-cols-[minmax(150px,2fr)_minmax(150px,2fr)_1fr] items-center gap-2 border-t px-4.5 py-2.5 text-sm"
            >
              <span className="truncate font-medium">{s.nom}</span>
              <span className="text-muted-foreground truncate">
                {s.adresse ?? '—'}
              </span>
              <span className="text-muted-foreground truncate text-xs">
                {[s.email, s.telephone].filter(Boolean).join(' · ') || '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
