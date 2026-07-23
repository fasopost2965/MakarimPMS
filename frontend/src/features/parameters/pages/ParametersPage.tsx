import { useCallback, useEffect, useState } from 'react';
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
  createSeasonRate,
  deleteSeasonRate,
  getHotelConfig,
  listSeasonRates,
  listTaxRates,
  updateHotelConfig,
  updateTaxRate,
} from '../api';
import { listRooms } from '../../reservations/api';
import type {
  CreateSeasonRateInput,
  HotelConfig,
  SeasonRate,
  TaxRateConfig,
} from '../types';
import type { RoomType } from '../../reservations/types';

type Section = 'identite' | 'taxes' | 'saisons';

const TAX_TYPE_LABEL: Record<string, string> = {
  TVA_HEBERGEMENT: 'TVA hébergement',
  TVA_ANNEXE: 'TVA services annexes',
  TAXE_SEJOUR: 'Taxe de séjour',
};

// Paramétrage de l'hôtel : identité légale, TVA/taxe de séjour, grille
// tarifaire saisonnière. Module dédié parameters (docs/modules/parameters.md,
// Administrateur seul en écriture) — toute modification exige un motif écrit
// (≥ 10 caractères), consigné dans AuditLog.
export function ParametersPage() {
  const [section, setSection] = useState<Section>('identite');

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex gap-1 border-b pb-2">
        <Button
          variant={section === 'identite' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSection('identite')}
        >
          Identité de l'établissement
        </Button>
        <Button
          variant={section === 'taxes' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSection('taxes')}
        >
          TVA & taxes
        </Button>
        <Button
          variant={section === 'saisons' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSection('saisons')}
        >
          Grille saisonnière
        </Button>
      </div>

      {section === 'identite' && <HotelIdentitySection />}
      {section === 'taxes' && <TaxRatesSection />}
      {section === 'saisons' && <SeasonRatesSection />}
    </div>
  );
}

function HotelIdentitySection() {
  const [config, setConfig] = useState<HotelConfig | null>(null);
  const [motif, setMotif] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getHotelConfig()
      .then(setConfig)
      .catch((err: unknown) =>
        setLoadError(
          err instanceof Error ? err.message : 'Erreur de chargement',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <p className="text-muted-foreground text-sm">Chargement…</p>;
  if (loadError) return <p className="text-destructive text-sm">{loadError}</p>;
  if (!config) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!config || motif.length < 10) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await updateHotelConfig({
        raisonSociale: config.raisonSociale,
        ice: config.ice,
        identifiantFiscal: config.identifiantFiscal,
        rc: config.rc,
        adresse: config.adresse,
        logoUrl: config.logoUrl ?? undefined,
        categorieEtoiles: config.categorieEtoiles,
        devise: config.devise,
        formatDate: config.formatDate,
        motif,
      });
      setConfig(updated);
      setMotif('');
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex max-w-md flex-col gap-3" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="raisonSociale">Raison sociale</Label>
        <Input
          id="raisonSociale"
          value={config.raisonSociale}
          onChange={(e) =>
            setConfig({ ...config, raisonSociale: e.target.value })
          }
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adresse">Adresse</Label>
        <Input
          id="adresse"
          value={config.adresse}
          onChange={(e) => setConfig({ ...config, adresse: e.target.value })}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ice">ICE</Label>
        <Input
          id="ice"
          value={config.ice}
          onChange={(e) => setConfig({ ...config, ice: e.target.value })}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="identifiantFiscal">Identifiant fiscal</Label>
        <Input
          id="identifiantFiscal"
          value={config.identifiantFiscal}
          onChange={(e) =>
            setConfig({ ...config, identifiantFiscal: e.target.value })
          }
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rc">Registre de commerce (RC)</Label>
        <Input
          id="rc"
          value={config.rc}
          onChange={(e) => setConfig({ ...config, rc: e.target.value })}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="categorieEtoiles">Catégorie (étoiles)</Label>
        <Input
          id="categorieEtoiles"
          type="number"
          min={1}
          value={config.categorieEtoiles}
          onChange={(e) =>
            setConfig({ ...config, categorieEtoiles: Number(e.target.value) })
          }
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="motif">
          Motif de la modification (≥ 10 caractères)
        </Label>
        <Input
          id="motif"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Ex. Correction de l'adresse suite au déménagement du siège"
          required
        />
      </div>

      {saveError && <p className="text-destructive text-sm">{saveError}</p>}
      {saved && <p className="text-sm text-emerald-600">Enregistré.</p>}

      <Button
        type="submit"
        disabled={saving || motif.length < 10}
        className="w-fit"
      >
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}

function TaxRatesSection() {
  const [rates, setRates] = useState<TaxRateConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [motifs, setMotifs] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listTaxRates();
      setRates(data);
      setDrafts(Object.fromEntries(data.map((r) => [r.id, r.taux])));
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

  async function handleSave(id: number) {
    setSavingId(id);
    setRowError(null);
    try {
      await updateTaxRate(id, drafts[id], motifs[id] ?? '');
      setMotifs({ ...motifs, [id]: '' });
      await refetch();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSavingId(null);
    }
  }

  if (loading)
    return <p className="text-muted-foreground text-sm">Chargement…</p>;
  if (loadError) return <p className="text-destructive text-sm">{loadError}</p>;

  return (
    <div className="flex max-w-md flex-col gap-3">
      {rowError && <p className="text-destructive text-sm">{rowError}</p>}
      {rates.map((rate) => {
        const motif = motifs[rate.id] ?? '';
        const unchanged = drafts[rate.id] === rate.taux;
        return (
          <div
            key={rate.id}
            className="flex flex-col gap-2 rounded-md border p-3"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`taux-${rate.id}`}>
                {TAX_TYPE_LABEL[rate.type] ?? rate.type}
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  id={`taux-${rate.id}`}
                  type="number"
                  step="0.01"
                  value={drafts[rate.id] ?? ''}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [rate.id]: e.target.value })
                  }
                />
                <span className="text-muted-foreground text-sm">%</span>
              </div>
            </div>
            {!unchanged && (
              <Input
                value={motif}
                onChange={(e) =>
                  setMotifs({ ...motifs, [rate.id]: e.target.value })
                }
                placeholder="Motif de la modification (≥ 10 caractères)"
              />
            )}
            <Button
              size="sm"
              className="w-fit"
              disabled={savingId === rate.id || unchanged || motif.length < 10}
              onClick={() => handleSave(rate.id)}
            >
              {savingId === rate.id ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function SeasonRatesSection() {
  const [seasonRates, setSeasonRates] = useState<SeasonRate[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteMotifs, setDeleteMotifs] = useState<Record<number, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ratesData, roomsData] = await Promise.all([
        listSeasonRates(),
        listRooms(),
      ]);
      setSeasonRates(ratesData);
      const uniqueTypes = new Map<number, RoomType>();
      for (const room of roomsData)
        uniqueTypes.set(room.roomType.id, room.roomType);
      setRoomTypes([...uniqueTypes.values()]);
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

  async function handleDelete(id: number) {
    const motif = deleteMotifs[id] ?? '';
    if (motif.length < 10) return;
    setActionError(null);
    setDeletingId(id);
    try {
      await deleteSeasonRate(id, motif);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate(input: CreateSeasonRateInput) {
    setFormError(null);
    setSubmitting(true);
    try {
      await createSeasonRate(input);
      setDialogOpen(false);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  const roomTypeName = (id: number) =>
    roomTypes.find((rt) => rt.id === id)?.nom ?? `Type #${id}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Périodes tarifaires par type de chambre — aucun chevauchement autorisé
          pour un même type.
        </p>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          + Nouveau tarif
        </Button>
      </div>

      {loadError && <p className="text-destructive text-sm">{loadError}</p>}
      {actionError && <p className="text-destructive text-sm">{actionError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : seasonRates.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun tarif saisonnier.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {seasonRates.map((rate) => {
            const motif = deleteMotifs[rate.id] ?? '';
            return (
              <div
                key={rate.id}
                className="flex flex-col gap-2 rounded-md border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {roomTypeName(rate.roomTypeId)} — {rate.libelle}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Du {rate.dateDebut.slice(0, 10)} au{' '}
                      {rate.dateFin.slice(0, 10)} — {rate.prixNuit} MAD/nuit
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={motif}
                    onChange={(e) =>
                      setDeleteMotifs({
                        ...deleteMotifs,
                        [rate.id]: e.target.value,
                      })
                    }
                    placeholder="Motif de suppression (≥ 10 caractères)"
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={deletingId === rate.id || motif.length < 10}
                    onClick={() => handleDelete(rate.id)}
                  >
                    {deletingId === rate.id ? 'Suppression…' : 'Supprimer'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => !next && setDialogOpen(false)}
      >
        <DialogContent>
          {dialogOpen && (
            <CreateSeasonRateForm
              roomTypes={roomTypes}
              onClose={() => setDialogOpen(false)}
              onConfirm={handleCreate}
              submitting={submitting}
              error={formError}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CreateSeasonRateFormProps {
  roomTypes: RoomType[];
  onClose: () => void;
  onConfirm: (input: CreateSeasonRateInput) => void;
  submitting: boolean;
  error: string | null;
}

function CreateSeasonRateForm({
  roomTypes,
  onClose,
  onConfirm,
  submitting,
  error,
}: CreateSeasonRateFormProps) {
  const [roomTypeId, setRoomTypeId] = useState(
    roomTypes[0] ? String(roomTypes[0].id) : '',
  );
  const [libelle, setLibelle] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [prixNuit, setPrixNuit] = useState('');
  const [motif, setMotif] = useState('');

  const canSubmit =
    roomTypeId &&
    libelle &&
    dateDebut &&
    dateFin &&
    prixNuit &&
    motif.length >= 10;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nouveau tarif saisonnier</DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          onConfirm({
            roomTypeId: Number(roomTypeId),
            libelle,
            dateDebut,
            dateFin,
            prixNuit,
            motif,
          });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="roomType">Type de chambre</Label>
          <Select
            value={roomTypeId}
            onValueChange={(v) => v && setRoomTypeId(v)}
            items={roomTypes.map((rt) => ({
              value: String(rt.id),
              label: rt.nom,
            }))}
          >
            <SelectTrigger id="roomType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roomTypes.map((rt) => (
                <SelectItem key={rt.id} value={String(rt.id)}>
                  {rt.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="libelle">Libellé</Label>
          <Input
            id="libelle"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Ex. Haute saison été"
            required
          />
        </div>

        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="dateDebut">Début</Label>
            <Input
              id="dateDebut"
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="dateFin">Fin</Label>
            <Input
              id="dateFin"
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prixNuit">Prix par nuit (MAD)</Label>
          <Input
            id="prixNuit"
            type="number"
            step="0.01"
            value={prixNuit}
            onChange={(e) => setPrixNuit(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="motif">Motif (≥ 10 caractères)</Label>
          <Input
            id="motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. Ouverture de la grille été 2027"
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
            {submitting ? 'Création…' : 'Créer'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
