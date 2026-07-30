import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  CalendarRange,
  Globe2,
  Percent,
  BedDouble,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/ui/file-upload';
import { DateRangeField } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createChannelMapping,
  createSeasonRate,
  deleteChannelMapping,
  deleteSeasonRate,
  getHotelConfig,
  listChannelMappings,
  listSeasonRates,
  listTaxRates,
  updateHotelConfig,
  updateSeasonRate,
  updateTaxRate,
} from '../api';
import { listRooms } from '../../reservations/api';
import type {
  CanalOTA,
  ChannelRoomTypeMapping,
  CreateChannelRoomTypeMappingInput,
  CreateSeasonRateInput,
  HotelConfig,
  SeasonRate,
  TaxRateConfig,
  UpdateSeasonRateInput,
} from '../types';
import type { RoomType } from '../../reservations/types';
import { RoomsSection } from '../../rooms/components/RoomsSection';

const CANAL_OTA_LABEL: Record<CanalOTA, string> = {
  BOOKING_COM: 'Booking.com',
  EXPEDIA: 'Expedia',
  AIRBNB: 'Airbnb',
};

// Teinte de pastille par canal — reprend les variants sémantiques déjà en
// place (aucun nouveau token), les 3 hue les plus proches des couleurs
// exactes de Canaux.dc.html (bleu Booking.com/or Expedia/rouge Airbnb).
const CANAL_OTA_BADGE_VARIANT: Record<
  CanalOTA,
  'info' | 'warning' | 'destructive'
> = {
  BOOKING_COM: 'info',
  EXPEDIA: 'warning',
  AIRBNB: 'destructive',
};

// Design Marine & Or — logo de l'hôtel, même convention CH-055 (data URI
// base64, conversion File → data URI côté client, jamais de persistance
// disque). Plafond aligné sur LOGO_MAX_LENGTH côté backend (~2,2 Mo source).
const LOGO_MAX_SIZE_MB = 2;
const LOGO_MAX_SIZE_BYTES = LOGO_MAX_SIZE_MB * 1024 * 1024;

const TAX_TYPE_LABEL: Record<string, string> = {
  TVA_HEBERGEMENT: 'TVA hébergement',
  TVA_ANNEXE: 'TVA services annexes',
  TAXE_SEJOUR: 'Taxe de séjour',
};

const TAX_TYPE_UNIT: Record<string, string> = {
  TVA_HEBERGEMENT: '%',
  TVA_ANNEXE: '%',
  TAXE_SEJOUR: ' MAD/nuit',
};

interface SubNavItem {
  id: string;
  label: string;
  icon: typeof Building2;
}

const SUBNAV_ITEMS: SubNavItem[] = [
  { id: 'identite', label: "Identité de l'hôtel", icon: Building2 },
  { id: 'taxes', label: 'Taux & taxes', icon: Percent },
  { id: 'tarifs', label: 'Grille tarifaire', icon: CalendarRange },
  { id: 'canaux', label: 'Canaux OTA', icon: Globe2 },
  { id: 'chambres', label: 'Chambres & types', icon: BedDouble },
];

// Paramétrage de l'hôtel : identité légale, TVA/taxe de séjour, grille
// tarifaire saisonnière, canaux OTA. Module dédié parameters
// (docs/modules/parameters.md, Administrateur seul en écriture) — toute
// modification exige un motif écrit (≥ 10 caractères), consigné dans
// AuditLog. Refonte batch 3 (design_handoff_batch3/Parametres.dc.html) :
// commutateur d'onglets remplacé par une page unique à sections empilées
// avec sous-navigation ancrée sticky, pour les 4 sous-modules couverts par
// la maquette. « Chambres & types » (RoomsSection) reste hors périmètre de
// la maquette — conservé tel quel, simplement replacé dans la même page
// plutôt que silencieusement retiré (même discipline que le rapport
// « arrivées du jour » conservé en CH-066 malgré son absence du mockup).
export function ParametersPage() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Paramètres</h1>
        <Badge variant="warning">Écriture réservée à l'Administrateur</Badge>
      </div>

      <div className="grid grid-cols-[220px_minmax(0,1fr)] items-start gap-6">
        <nav className="bg-card sticky top-0 flex flex-col gap-0.5 rounded-lg border p-2">
          {SUBNAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className="text-muted-foreground hover:bg-muted hover:text-primary flex items-center gap-2 rounded-md px-2.5 py-2 text-[12.5px] font-medium no-underline transition-colors"
            >
              <Icon className="size-3.5 shrink-0" />
              {label}
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          <section id="identite" className="scroll-mt-4">
            <HotelIdentitySection />
          </section>
          <section id="taxes" className="scroll-mt-4">
            <TaxRatesSection />
          </section>
          <section id="tarifs" className="scroll-mt-4">
            <SeasonRatesSection />
          </section>
          <section id="canaux" className="scroll-mt-4">
            <ChannelManagerSection />
          </section>
          <section id="chambres" className="scroll-mt-4">
            <div className="bg-card overflow-hidden rounded-lg border">
              <div className="border-b px-4.5 py-3.5">
                <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                  Chambres &amp; types (hors périmètre de la maquette —
                  inchangé)
                </span>
              </div>
              <div className="p-4.5">
                <RoomsSection />
              </div>
            </div>
          </section>
        </div>
      </div>
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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

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
    setLogoError(null);
    setSaved(false);

    let logoUrl = config.logoUrl ?? undefined;
    if (logoFile) {
      if (logoFile.size > LOGO_MAX_SIZE_BYTES) {
        setLogoError(
          `Le logo dépasse la taille maximale (${LOGO_MAX_SIZE_MB} Mo)`,
        );
        setSaving(false);
        return;
      }
      try {
        logoUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            if (typeof result === 'string') {
              resolve(result);
            } else {
              reject(new Error('Erreur lors de la lecture du fichier'));
            }
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(logoFile);
        });
      } catch (err) {
        setLogoError(
          err instanceof Error ? err.message : 'Erreur lors du chargement',
        );
        setSaving(false);
        return;
      }
    }

    try {
      const updated = await updateHotelConfig({
        raisonSociale: config.raisonSociale,
        ice: config.ice,
        identifiantFiscal: config.identifiantFiscal,
        rc: config.rc,
        adresse: config.adresse,
        logoUrl,
        categorieEtoiles: config.categorieEtoiles,
        devise: config.devise,
        formatDate: config.formatDate,
        motif,
      });
      setConfig(updated);
      setMotif('');
      setLogoFile(null);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <div className="border-b px-4.5 py-3.5">
        <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
          Identité de l'hôtel — fiche légale &amp; fiscale (singleton)
        </span>
      </div>

      <form className="flex flex-col gap-3.5 p-4.5" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
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
            <Label htmlFor="categorieEtoiles">Catégorie (étoiles)</Label>
            <Input
              id="categorieEtoiles"
              type="number"
              min={1}
              value={config.categorieEtoiles}
              onChange={(e) =>
                setConfig({
                  ...config,
                  categorieEtoiles: Number(e.target.value),
                })
              }
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
            <Label htmlFor="devise">Devise</Label>
            <Input
              id="devise"
              value={config.devise}
              onChange={(e) => setConfig({ ...config, devise: e.target.value })}
              required
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="adresse">Adresse</Label>
            <Input
              id="adresse"
              value={config.adresse}
              onChange={(e) =>
                setConfig({ ...config, adresse: e.target.value })
              }
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="formatDate">Format de date</Label>
            <Input
              id="formatDate"
              value={config.formatDate}
              onChange={(e) =>
                setConfig({ ...config, formatDate: e.target.value })
              }
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t pt-3.5">
          <Label htmlFor="logo">Logo de l'hôtel</Label>
          {config.logoUrl && !logoFile && (
            <img
              src={config.logoUrl}
              alt="Logo actuel"
              className="h-16 w-16 rounded object-contain"
            />
          )}
          <FileUpload
            id="logo"
            accept="image/jpeg,image/png,image/webp"
            value={logoFile}
            onChange={setLogoFile}
            hint={`Max ${LOGO_MAX_SIZE_MB} Mo (JPEG, PNG, WebP) — utilisé dans la sidebar, l'écran de connexion et les factures PDF`}
          />
          {logoError && <p className="text-destructive text-sm">{logoError}</p>}
        </div>

        <div className="grid grid-cols-[1fr_auto] items-end gap-2.5 border-t pt-3.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motif">
              Motif (≥ 10 caractères, obligatoire — modification tracée dans
              l'audit)
            </Label>
            <Input
              id="motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex. Mise à jour du RC suite au renouvellement 2026"
              required
            />
          </div>
          <Button type="submit" disabled={saving || motif.length < 10}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>

        {saveError && <p className="text-destructive text-sm">{saveError}</p>}
        {saved && <p className="text-success text-sm">Enregistré.</p>}
      </form>
    </div>
  );
}

function TaxRatesSection() {
  const [rates, setRates] = useState<TaxRateConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tauxDraft, setTauxDraft] = useState('');
  const [motif, setMotif] = useState('');
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setRates(await listTaxRates());
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

  const editingRate = rates.find((r) => r.id === editingId) ?? null;

  function startEditing(rate: TaxRateConfig) {
    setEditingId(rate.id);
    setTauxDraft(rate.taux);
    setMotif('');
    setRowError(null);
  }

  async function handleSave() {
    if (!editingRate || motif.length < 10) return;
    setSaving(true);
    setRowError(null);
    try {
      await updateTaxRate(editingRate.id, tauxDraft, motif);
      setEditingId(null);
      setMotif('');
      await refetch();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <div className="border-b px-4.5 py-3.5">
        <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
          Taux &amp; taxes — TVA et taxe de séjour
        </span>
      </div>

      {loading ? (
        <p className="text-muted-foreground px-4.5 py-3 text-sm">Chargement…</p>
      ) : loadError ? (
        <p className="text-destructive px-4.5 py-3 text-sm">{loadError}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="bg-muted/60 text-muted-foreground grid min-w-[620px] grid-cols-[170px_90px_1fr_110px_90px] gap-2 px-4.5 py-2 text-[11px] font-bold">
              <span>Type</span>
              <span>Taux</span>
              <span>Applicable à</span>
              <span>Actif depuis</span>
              <span className="text-right">Action</span>
            </div>
            {rates.map((rate) => (
              <div
                key={rate.id}
                className={`grid min-w-[620px] grid-cols-[170px_90px_1fr_110px_90px] items-center gap-2 border-t px-4.5 py-2.5 text-sm ${editingId === rate.id ? 'bg-primary/5' : ''}`}
              >
                <span>{TAX_TYPE_LABEL[rate.type] ?? rate.type}</span>
                <span className="font-medium">
                  {rate.taux}
                  {TAX_TYPE_UNIT[rate.type] ?? ''}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {rate.applicableA ?? '—'}
                </span>
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {new Date(rate.actifDepuis).toLocaleDateString('fr-FR')}
                </span>
                <button
                  type="button"
                  className="text-primary text-right text-xs font-semibold hover:underline"
                  onClick={() => startEditing(rate)}
                >
                  Modifier{editingId === rate.id ? ' ▾' : ''}
                </button>
              </div>
            ))}
          </div>

          {editingRate && (
            <div className="bg-muted/40 flex flex-col gap-2.5 border-t p-4.5">
              <span className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
                Modifier —{' '}
                {TAX_TYPE_LABEL[editingRate.type] ?? editingRate.type}
              </span>
              <div className="grid grid-cols-[140px_1fr_auto] items-end gap-2.5">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="tauxDraft" className="text-xs font-normal">
                    Nouveau taux
                  </Label>
                  <Input
                    id="tauxDraft"
                    value={tauxDraft}
                    onChange={(e) => setTauxDraft(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="taxMotif" className="text-xs font-normal">
                    Motif (≥ 10 caractères)
                  </Label>
                  <Input
                    id="taxMotif"
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    placeholder="Ex. Révision annuelle, arrêté municipal 2026"
                  />
                </div>
                <Button
                  size="sm"
                  disabled={
                    saving ||
                    tauxDraft === editingRate.taux ||
                    motif.length < 10
                  }
                  onClick={() => void handleSave()}
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </div>
              {rowError && (
                <p className="text-destructive text-sm">{rowError}</p>
              )}
              <p className="text-muted-foreground text-[11px]">
                Le type de taxe est immuable — seul le taux se modifie. Non
                rétroactif : les lignes de folio déjà calculées gardent leur
                taux figé.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface SeasonRateEditDraft {
  libelle: string;
  dateDebut: string;
  dateFin: string;
  prixNuit: string;
}

function SeasonRatesSection() {
  const [seasonRates, setSeasonRates] = useState<SeasonRate[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<SeasonRateEditDraft>({
    libelle: '',
    dateDebut: '',
    dateFin: '',
    prixNuit: '',
  });
  const [editMotif, setEditMotif] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteMotif, setDeleteMotif] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [createRoomTypeId, setCreateRoomTypeId] = useState('');
  const [createLibelle, setCreateLibelle] = useState('');
  const [createDateDebut, setCreateDateDebut] = useState('');
  const [createDateFin, setCreateDateFin] = useState('');
  const [createPrixNuit, setCreatePrixNuit] = useState('');
  const [createMotif, setCreateMotif] = useState('');
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
      const types = [...uniqueTypes.values()];
      setRoomTypes(types);
      setCreateRoomTypeId(
        (prev) => prev || (types[0] ? String(types[0].id) : ''),
      );
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

  function startEditing(rate: SeasonRate) {
    setDeletingId(null);
    setEditingId(rate.id);
    setEditDraft({
      libelle: rate.libelle,
      dateDebut: rate.dateDebut.slice(0, 10),
      dateFin: rate.dateFin.slice(0, 10),
      prixNuit: rate.prixNuit,
    });
    setEditMotif('');
    setActionError(null);
  }

  function startDeleting(rate: SeasonRate) {
    setEditingId(null);
    setDeletingId(rate.id);
    setDeleteMotif('');
    setActionError(null);
  }

  async function handleSaveEdit() {
    if (editingId === null || editMotif.length < 10) return;
    setSavingEdit(true);
    setActionError(null);
    try {
      const input: UpdateSeasonRateInput = { ...editDraft, motif: editMotif };
      await updateSeasonRate(editingId, input);
      setEditingId(null);
      setEditMotif('');
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleConfirmDelete() {
    if (deletingId === null || deleteMotif.length < 10) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteSeasonRate(deletingId, deleteMotif);
      setDeletingId(null);
      setDeleteMotif('');
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setDeleting(false);
    }
  }

  const canCreate =
    createRoomTypeId &&
    createLibelle &&
    createDateDebut &&
    createDateFin &&
    createDateFin >= createDateDebut &&
    createPrixNuit &&
    createMotif.length >= 10;

  async function handleCreate(input: CreateSeasonRateInput) {
    setFormError(null);
    setSubmitting(true);
    try {
      await createSeasonRate(input);
      setCreateLibelle('');
      setCreateDateDebut('');
      setCreateDateFin('');
      setCreatePrixNuit('');
      setCreateMotif('');
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
    <div className="bg-card overflow-hidden rounded-lg border">
      <div className="border-b px-4.5 py-3.5">
        <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
          Grille tarifaire saisonnière — par type de chambre
        </span>
      </div>

      {loading ? (
        <p className="text-muted-foreground px-4.5 py-3 text-sm">Chargement…</p>
      ) : loadError ? (
        <p className="text-destructive px-4.5 py-3 text-sm">{loadError}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="bg-muted/60 text-muted-foreground grid min-w-[720px] grid-cols-[130px_1fr_110px_110px_100px_140px] gap-2 px-4.5 py-2 text-[11px] font-bold">
              <span>Type</span>
              <span>Libellé</span>
              <span>Début</span>
              <span>Fin</span>
              <span>Prix/nuit</span>
              <span className="text-right">Action</span>
            </div>
            {seasonRates.length === 0 ? (
              <p className="text-muted-foreground px-4.5 py-3 text-sm">
                Aucun tarif saisonnier.
              </p>
            ) : (
              seasonRates.map((rate) => (
                <div
                  key={rate.id}
                  className={`grid min-w-[720px] grid-cols-[130px_1fr_110px_110px_100px_140px] items-center gap-2 border-t px-4.5 py-2.5 text-sm ${editingId === rate.id || deletingId === rate.id ? 'bg-primary/5' : ''}`}
                >
                  <span>{roomTypeName(rate.roomTypeId)}</span>
                  <span className="truncate">{rate.libelle}</span>
                  <span className="text-muted-foreground text-xs">
                    {rate.dateDebut.slice(0, 10)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {rate.dateFin.slice(0, 10)}
                  </span>
                  <span className="font-medium">{rate.prixNuit} MAD</span>
                  <div className="flex justify-end gap-3 text-xs font-semibold">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => startEditing(rate)}
                    >
                      Modifier{editingId === rate.id ? ' ▾' : ''}
                    </button>
                    <button
                      type="button"
                      className="text-destructive hover:underline"
                      onClick={() => startDeleting(rate)}
                    >
                      Supprimer{deletingId === rate.id ? ' ▾' : ''}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {actionError && (
            <p className="text-destructive px-4.5 pt-3 text-sm">
              {actionError}
            </p>
          )}

          {editingId !== null ? (
            <div className="bg-muted/40 flex flex-col gap-2.5 border-t p-4.5">
              <span className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
                Modifier la période
              </span>
              <div className="flex flex-wrap gap-2.5">
                <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                  <Label htmlFor="editLibelle" className="text-xs font-normal">
                    Libellé
                  </Label>
                  <Input
                    id="editLibelle"
                    value={editDraft.libelle}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, libelle: e.target.value })
                    }
                  />
                </div>
                <DateRangeField
                  idPrefix="edit-season-rate"
                  startValue={editDraft.dateDebut}
                  endValue={editDraft.dateFin}
                  onStartChange={(v) =>
                    setEditDraft({ ...editDraft, dateDebut: v })
                  }
                  onEndChange={(v) =>
                    setEditDraft({ ...editDraft, dateFin: v })
                  }
                />
                <div className="flex min-w-[110px] flex-col gap-1">
                  <Label htmlFor="editPrixNuit" className="text-xs font-normal">
                    Prix/nuit (MAD)
                  </Label>
                  <Input
                    id="editPrixNuit"
                    type="number"
                    step="0.01"
                    value={editDraft.prixNuit}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, prixNuit: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto] items-end gap-2.5">
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="editSeasonMotif"
                    className="text-xs font-normal"
                  >
                    Motif (≥ 10 caractères)
                  </Label>
                  <Input
                    id="editSeasonMotif"
                    value={editMotif}
                    onChange={(e) => setEditMotif(e.target.value)}
                    placeholder="Ex. Correction du prix suite à erreur de saisie"
                  />
                </div>
                <Button
                  size="sm"
                  disabled={savingEdit || editMotif.length < 10}
                  onClick={() => void handleSaveEdit()}
                >
                  {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Refusée si la nouvelle période chevauche une autre période
                existante du même type de chambre.
              </p>
            </div>
          ) : deletingId !== null ? (
            <div className="bg-muted/40 flex flex-col gap-2.5 border-t p-4.5">
              <span className="text-destructive text-[11px] font-bold tracking-wide uppercase">
                Confirmer la suppression de la période
              </span>
              <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2.5">
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="deleteSeasonMotif"
                    className="text-xs font-normal"
                  >
                    Motif (≥ 10 caractères)
                  </Label>
                  <Input
                    id="deleteSeasonMotif"
                    value={deleteMotif}
                    onChange={(e) => setDeleteMotif(e.target.value)}
                    placeholder="Motif de suppression"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDeletingId(null)}
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={deleting || deleteMotif.length < 10}
                  onClick={() => void handleConfirmDelete()}
                >
                  {deleting ? 'Suppression…' : 'Supprimer'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-muted/40 flex flex-col gap-2.5 border-t p-4.5">
              <span className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
                Nouvelle période tarifaire
              </span>
              <div className="flex flex-wrap gap-2.5">
                <div className="flex min-w-[140px] flex-1 flex-col gap-1">
                  <Label
                    htmlFor="createRoomType"
                    className="text-xs font-normal"
                  >
                    Type de chambre
                  </Label>
                  <Select
                    value={createRoomTypeId}
                    onValueChange={(v) => v && setCreateRoomTypeId(v)}
                    items={roomTypes.map((rt) => ({
                      value: String(rt.id),
                      label: rt.nom,
                    }))}
                  >
                    <SelectTrigger
                      id="createRoomType"
                      className="h-[34px] w-full"
                    >
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
                <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                  <Label
                    htmlFor="createLibelle"
                    className="text-xs font-normal"
                  >
                    Libellé
                  </Label>
                  <Input
                    id="createLibelle"
                    value={createLibelle}
                    onChange={(e) => setCreateLibelle(e.target.value)}
                    placeholder="Ex. Haute saison été"
                  />
                </div>
                <DateRangeField
                  idPrefix="create-season-rate"
                  startValue={createDateDebut}
                  endValue={createDateFin}
                  onStartChange={setCreateDateDebut}
                  onEndChange={setCreateDateFin}
                />
                <div className="flex min-w-[110px] flex-col gap-1">
                  <Label
                    htmlFor="createPrixNuit"
                    className="text-xs font-normal"
                  >
                    Prix/nuit (MAD)
                  </Label>
                  <Input
                    id="createPrixNuit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={createPrixNuit}
                    onChange={(e) => setCreatePrixNuit(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto] items-end gap-2.5">
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="createSeasonMotif"
                    className="text-xs font-normal"
                  >
                    Motif (≥ 10 caractères)
                  </Label>
                  <Input
                    id="createSeasonMotif"
                    value={createMotif}
                    onChange={(e) => setCreateMotif(e.target.value)}
                    placeholder="Ex. Grille été 2026 validée par la direction"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={submitting || !canCreate}
                  onClick={() =>
                    void handleCreate({
                      roomTypeId: Number(createRoomTypeId),
                      libelle: createLibelle,
                      dateDebut: createDateDebut,
                      dateFin: createDateFin,
                      prixNuit: createPrixNuit,
                      motif: createMotif,
                    })
                  }
                >
                  {submitting ? 'Création…' : 'Créer la période'}
                </Button>
              </div>
              {formError && (
                <p className="text-destructive text-sm">{formError}</p>
              )}
              <p className="text-muted-foreground text-[11px]">
                Refusée si elle chevauche une période existante du même type de
                chambre.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// CH-009 (F10, channel-manager) — sans mapping configuré, un import de
// réservation OTA échoue explicitement en 404 (ChannelManagerService,
// docs/governance/REGISTRE_CHANTIERS.md) plutôt que de deviner un type de
// chambre. Permission réutilisée : parameters:write/read, même logique que
// SeasonRate/TaxRateConfig ci-dessus (configuration exceptionnelle, pas une
// opération métier quotidienne).
function ChannelManagerSection() {
  const [mappings, setMappings] = useState<ChannelRoomTypeMapping[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteMotif, setDeleteMotif] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [createCanal, setCreateCanal] = useState<CanalOTA>('BOOKING_COM');
  const [createExternalId, setCreateExternalId] = useState('');
  const [createRoomTypeId, setCreateRoomTypeId] = useState('');
  const [createMotif, setCreateMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [mappingsData, roomsData] = await Promise.all([
        listChannelMappings(),
        listRooms(),
      ]);
      setMappings(mappingsData);
      const uniqueTypes = new Map<number, RoomType>();
      for (const room of roomsData)
        uniqueTypes.set(room.roomType.id, room.roomType);
      const types = [...uniqueTypes.values()];
      setRoomTypes(types);
      setCreateRoomTypeId(
        (prev) => prev || (types[0] ? String(types[0].id) : ''),
      );
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

  function startDeleting(mapping: ChannelRoomTypeMapping) {
    setDeletingId(mapping.id);
    setDeleteMotif('');
    setActionError(null);
  }

  async function handleConfirmDelete() {
    if (deletingId === null || deleteMotif.length < 10) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteChannelMapping(deletingId, deleteMotif);
      setDeletingId(null);
      setDeleteMotif('');
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setDeleting(false);
    }
  }

  const canCreate =
    createExternalId && createRoomTypeId && createMotif.length >= 10;

  async function handleCreate(input: CreateChannelRoomTypeMappingInput) {
    setFormError(null);
    setSubmitting(true);
    try {
      await createChannelMapping(input);
      setCreateExternalId('');
      setCreateMotif('');
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <div className="border-b px-4.5 py-3.5">
        <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
          Canaux OTA — correspondance des types de chambre
        </span>
      </div>

      {loading ? (
        <p className="text-muted-foreground px-4.5 py-3 text-sm">Chargement…</p>
      ) : loadError ? (
        <p className="text-destructive px-4.5 py-3 text-sm">{loadError}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="bg-muted/60 text-muted-foreground grid min-w-[620px] grid-cols-[140px_1fr_150px_110px_90px] gap-2 px-4.5 py-2 text-[11px] font-bold">
              <span>Canal</span>
              <span>ID externe</span>
              <span>Type local</span>
              <span>Créé le</span>
              <span className="text-right">Action</span>
            </div>
            {mappings.length === 0 ? (
              <p className="text-muted-foreground px-4.5 py-3 text-sm">
                Aucun mapping configuré.
              </p>
            ) : (
              mappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className={`grid min-w-[620px] grid-cols-[140px_1fr_150px_110px_90px] items-center gap-2 border-t px-4.5 py-2.5 text-sm ${deletingId === mapping.id ? 'bg-primary/5' : ''}`}
                >
                  <Badge
                    variant={CANAL_OTA_BADGE_VARIANT[mapping.canal]}
                    className="w-fit"
                  >
                    {CANAL_OTA_LABEL[mapping.canal]}
                  </Badge>
                  <span className="truncate">{mapping.externalRoomTypeId}</span>
                  <span className="text-muted-foreground text-xs">
                    {mapping.roomType.nom}
                  </span>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(mapping.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                  <button
                    type="button"
                    className="text-destructive text-right text-xs font-semibold hover:underline"
                    onClick={() => startDeleting(mapping)}
                  >
                    Retirer{deletingId === mapping.id ? ' ▾' : ''}
                  </button>
                </div>
              ))
            )}
          </div>

          {actionError && (
            <p className="text-destructive px-4.5 pt-3 text-sm">
              {actionError}
            </p>
          )}

          {deletingId !== null ? (
            <div className="bg-muted/40 flex flex-col gap-2.5 border-t p-4.5">
              <span className="text-destructive text-[11px] font-bold tracking-wide uppercase">
                Confirmer le retrait
              </span>
              <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2.5">
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="deleteMappingMotif"
                    className="text-xs font-normal"
                  >
                    Motif (≥ 10 caractères)
                  </Label>
                  <Input
                    id="deleteMappingMotif"
                    value={deleteMotif}
                    onChange={(e) => setDeleteMotif(e.target.value)}
                    placeholder="Motif de retrait"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDeletingId(null)}
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={deleting || deleteMotif.length < 10}
                  onClick={() => void handleConfirmDelete()}
                >
                  {deleting ? 'Retrait…' : 'Retirer'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-muted/40 flex flex-col gap-2.5 border-t p-4.5">
              <span className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
                Nouvelle correspondance
              </span>
              <div className="flex flex-wrap gap-2.5">
                <div className="flex min-w-[140px] flex-1 flex-col gap-1">
                  <Label htmlFor="createCanal" className="text-xs font-normal">
                    Canal
                  </Label>
                  <Select
                    value={createCanal}
                    onValueChange={(v) => v && setCreateCanal(v as CanalOTA)}
                    items={Object.entries(CANAL_OTA_LABEL).map(
                      ([value, label]) => ({ value, label }),
                    )}
                  >
                    <SelectTrigger id="createCanal" className="h-[34px] w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CANAL_OTA_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                  <Label
                    htmlFor="createExternalId"
                    className="text-xs font-normal"
                  >
                    ID externe (canal)
                  </Label>
                  <Input
                    id="createExternalId"
                    value={createExternalId}
                    onChange={(e) => setCreateExternalId(e.target.value)}
                    placeholder="Ex. RT-DLX-7731"
                  />
                </div>
                <div className="flex min-w-[140px] flex-1 flex-col gap-1">
                  <Label
                    htmlFor="createMappingRoomType"
                    className="text-xs font-normal"
                  >
                    Type de chambre local
                  </Label>
                  <Select
                    value={createRoomTypeId}
                    onValueChange={(v) => v && setCreateRoomTypeId(v)}
                    items={roomTypes.map((rt) => ({
                      value: String(rt.id),
                      label: rt.nom,
                    }))}
                  >
                    <SelectTrigger
                      id="createMappingRoomType"
                      className="h-[34px] w-full"
                    >
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
              </div>
              <div className="grid grid-cols-[1fr_auto] items-end gap-2.5">
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="createMappingMotif"
                    className="text-xs font-normal"
                  >
                    Motif (≥ 10 caractères)
                  </Label>
                  <Input
                    id="createMappingMotif"
                    value={createMotif}
                    onChange={(e) => setCreateMotif(e.target.value)}
                    placeholder="Ex. Nouveau type de chambre ouvert sur Booking.com"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={submitting || !canCreate}
                  onClick={() =>
                    void handleCreate({
                      canal: createCanal,
                      externalRoomTypeId: createExternalId,
                      roomTypeId: Number(createRoomTypeId),
                      motif: createMotif,
                    })
                  }
                >
                  {submitting ? 'Création…' : 'Créer la correspondance'}
                </Button>
              </div>
              {formError && (
                <p className="text-destructive text-sm">{formError}</p>
              )}
              <p className="text-muted-foreground text-[11px]">
                Walk-in et Direct n'ont jamais de correspondance OTA — aucun
                webhook entrant pour ces deux canaux.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
