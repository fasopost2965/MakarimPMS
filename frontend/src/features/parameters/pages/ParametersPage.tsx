import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Ban,
  Building2,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Globe,
  HardDrive,
  History,
  Info,
  Key,
  Layout,
  Lock,
  Moon,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  Sliders,
  Sparkles,
  Sun,
  Terminal,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createChannelMapping,
  createRateRestriction,
  createSeasonRate,
  createTaxRate,
  deleteChannelMapping,
  deleteRateRestriction,
  deleteSeasonRate,
  getHotelConfig,
  listAuditLogs,
  listChannelMappings,
  listRateRestrictions,
  listSeasonRates,
  listTaxRates,
  updateHotelConfig,
  updateRateRestriction,
  updateTaxRate,
} from "../api";
import { listRooms } from "../../reservations/api";
import type {
  AuditLogItem,
  CanalOTA,
  ChannelRoomTypeMapping,
  CreateChannelRoomTypeMappingInput,
  CreateRateRestrictionInput,
  CreateSeasonRateInput,
  CreateTaxRateInput,
  HotelConfig,
  RateRestriction,
  SeasonRate,
  TaxRateConfig,
} from "../types";
import type { RoomType } from "../../reservations/types";

type Section =
  | "identite"
  | "taxes"
  | "roles"
  | "maintenance"
  | "preferences"
  | "saisons"
  | "restrictions"
  | "channel-manager"
  | "audit";

const CANAL_OTA_LABEL: Record<CanalOTA, string> = {
  BOOKING_COM: "Booking.com",
  EXPEDIA: "Expedia",
  AIRBNB: "Airbnb",
};

const TAX_TYPE_LABEL: Record<string, string> = {
  TVA_HEBERGEMENT: "TVA hébergement (10%)",
  TVA_ANNEXE: "TVA services annexes (20%)",
  TAXE_SEJOUR: "Taxe de séjour (TPT & communale)",
};

export function ParametersPage() {
  const [section, setSection] = useState<Section>("identite");

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* En-tête de la page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">
              Paramètres & Configuration Système
            </h2>
            <Badge
              variant="outline"
              className="gap-1 border-primary/30 text-primary bg-primary/5"
            >
              <Lock className="size-3" />
              Accès Administrateur
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Référentiel central de l'établissement : identité légale, rôles &
            permissions, sauvegardes BDD, taxes et préférences d'affichage.
          </p>
        </div>
      </div>

      {/* Barre de navigation par onglets */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        <Button
          variant={section === "identite" ? "default" : "outline"}
          size="sm"
          onClick={() => setSection("identite")}
          className="gap-2 text-xs"
        >
          <Building2 className="size-4" />
          Général & Stratégie
        </Button>
        <Button
          variant={section === "taxes" ? "default" : "outline"}
          size="sm"
          onClick={() => setSection("taxes")}
          className="gap-2 text-xs"
        >
          <Receipt className="size-4" />
          TVA & Taxes Légales
        </Button>
        <Button
          variant={section === "roles" ? "default" : "outline"}
          size="sm"
          onClick={() => setSection("roles")}
          className="gap-2 text-xs"
        >
          <Users className="size-4" />
          Rôles & Permissions
        </Button>
        <Button
          variant={section === "maintenance" ? "default" : "outline"}
          size="sm"
          onClick={() => setSection("maintenance")}
          className="gap-2 text-xs"
        >
          <Database className="size-4" />
          Maintenance & Backups
        </Button>
        <Button
          variant={section === "preferences" ? "default" : "outline"}
          size="sm"
          onClick={() => setSection("preferences")}
          className="gap-2 text-xs"
        >
          <Sliders className="size-4" />
          Préférences Affichage
        </Button>
        <Button
          variant={section === "saisons" ? "default" : "outline"}
          size="sm"
          onClick={() => setSection("saisons")}
          className="gap-2 text-xs"
        >
          <CalendarRange className="size-4" />
          Grille Saisonnière
        </Button>
        <Button
          variant={section === "restrictions" ? "default" : "outline"}
          size="sm"
          onClick={() => setSection("restrictions")}
          className="gap-2 text-xs"
        >
          <ShieldAlert className="size-4" />
          Restrictions & Stop Sale
        </Button>
        <Button
          variant={section === "channel-manager" ? "default" : "outline"}
          size="sm"
          onClick={() => setSection("channel-manager")}
          className="gap-2 text-xs"
        >
          <Globe className="size-4" />
          Channel Manager OTA
        </Button>
        <Button
          variant={section === "audit" ? "default" : "outline"}
          size="sm"
          onClick={() => setSection("audit")}
          className="gap-2 text-xs"
        >
          <History className="size-4" />
          Journal d'Audit
        </Button>
      </div>

      {/* Affichage de la section active */}
      <div className="max-w-5xl">
        {section === "identite" && <HotelIdentitySection />}
        {section === "taxes" && <TaxRatesSection />}
        {section === "roles" && <UserRolesSection />}
        {section === "maintenance" && <MaintenanceBackupsSection />}
        {section === "preferences" && <DisplayPreferencesSection />}
        {section === "saisons" && <SeasonRatesSection />}
        {section === "restrictions" && <RateRestrictionsSection />}
        {section === "channel-manager" && <ChannelManagerSection />}
        {section === "audit" && <AuditLogsSection />}
      </div>
    </div>
  );
}

/* ========================================================================
   SECTION 1: CONFIGURATION GÉNÉRALE, IDENTITÉ DE L'ÉTABLISSEMENT & POLITIQUES
   ======================================================================== */
function HotelIdentitySection() {
  const [config, setConfig] = useState<HotelConfig | null>(null);
  const [motif, setMotif] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Politiques d'exploitation supplémentaires
  const [checkInTime, setCheckInTime] = useState("14:00");
  const [checkOutTime, setCheckOutTime] = useState("12:00");
  const [lateCheckOutFee, setLateCheckOutFee] = useState("150");
  const [cancellationPolicy, setCancellationPolicy] = useState(
    "Annulation sans frais jusqu'à 48 heures avant l'arrivée. Au-delà, facturation de la première nuitée.",
  );
  const [contactEmail, setContactEmail] = useState("reception@hotelmakarim.ma");
  const [contactPhone, setContactPhone] = useState("+212 5 22 33 44 55");

  useEffect(() => {
    getHotelConfig()
      .then(setConfig)
      .catch((err: unknown) =>
        setLoadError(
          err instanceof Error ? err.message : "Erreur de chargement",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <p className="text-muted-foreground text-sm">
        Chargement de la configuration…
      </p>
    );
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
      setMotif("");
      setSaved(true);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Formulaire de modification */}
      <div className="lg:col-span-7 rounded-lg border bg-card p-6 shadow-xs flex flex-col gap-5">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            Configuration Générale & Identité
          </h3>
          <p className="text-muted-foreground text-xs mt-1">
            Mentions légales obligatoires (CGI Maroc) et politiques
            d'exploitation de l'établissement.
          </p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {/* Identité Légale */}
          <div className="space-y-3 border-b pb-4">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
              Identité Fiscale & Commerciale
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
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

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="adresse">Adresse du siège social</Label>
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
                <Label htmlFor="ice">ICE (Identifiant Commun)</Label>
                <Input
                  id="ice"
                  value={config.ice}
                  onChange={(e) =>
                    setConfig({ ...config, ice: e.target.value })
                  }
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="identifiantFiscal">
                  Identifiant Fiscal (IF)
                </Label>
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
                <Label htmlFor="rc">Registre de Commerce (RC)</Label>
                <Input
                  id="rc"
                  value={config.rc}
                  onChange={(e) => setConfig({ ...config, rc: e.target.value })}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="categorieEtoiles">Catégorie hôtel</Label>
                <Input
                  id="categorieEtoiles"
                  type="number"
                  min={1}
                  max={5}
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
                <Label htmlFor="devise">Devise d'exploitation</Label>
                <Select
                  value={config.devise}
                  onValueChange={(v) =>
                    v && setConfig({ ...config, devise: v })
                  }
                  items={[
                    { value: "MAD", label: "MAD - Dirham Marocain" },
                    { value: "EUR", label: "EUR - Euro (€)" },
                    { value: "USD", label: "USD - Dollar ($)" },
                  ]}
                >
                  <SelectTrigger id="devise" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MAD">MAD - Dirham Marocain</SelectItem>
                    <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                    <SelectItem value="USD">USD - Dollar ($)</SelectItem>
                  </SelectContent>
                </Select>
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
          </div>

          {/* Politiques Check-in / Check-out */}
          <div className="space-y-3 border-b pb-4">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="size-3.5" />
              Politiques Check-in / Check-out & Contact
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="checkInTime">Heure Check-In par défaut</Label>
                <Input
                  id="checkInTime"
                  type="time"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="checkOutTime">Heure Check-Out par défaut</Label>
                <Input
                  id="checkOutTime"
                  type="time"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lateCheckOutFee">
                  Frais Late Check-Out ({config.devise}/heure)
                </Label>
                <Input
                  id="lateCheckOutFee"
                  type="number"
                  value={lateCheckOutFee}
                  onChange={(e) => setLateCheckOutFee(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contactPhone">
                  Téléphone support réception
                </Label>
                <Input
                  id="contactPhone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="contactEmail">
                  Email officiel de facturation
                </Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="cancellationPolicy">
                  Politique d'annulation générale
                </Label>
                <Input
                  id="cancellationPolicy"
                  value={cancellationPolicy}
                  onChange={(e) => setCancellationPolicy(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 bg-muted/20 p-3 rounded-md border">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="motif"
                className="font-semibold text-xs text-primary flex items-center gap-1.5"
              >
                <Info className="size-3.5" />
                Motif obligatoire de modification (ADR-005)
              </Label>
              <span className="text-[10px] text-muted-foreground">
                {motif.length}/10 caract. min.
              </span>
            </div>
            <Input
              id="motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex. Mise à jour de la raison sociale et politique check-out 2026"
              required
              className="text-xs"
            />
          </div>

          {saveError && (
            <p className="text-destructive text-xs font-medium">{saveError}</p>
          )}
          {saved && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 rounded-md text-xs font-medium border border-emerald-200">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              Configuration mise à jour avec succès et consignée dans le
              registre d'audit.
            </div>
          )}

          <Button
            type="submit"
            disabled={saving || motif.length < 10}
            className="w-fit self-start gap-2 text-xs"
          >
            {saving ? "Enregistrement…" : "Enregistrer la configuration"}
          </Button>
        </form>
      </div>

      {/* Prévisualisation de l'en-tête de facture */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="rounded-lg border bg-gradient-to-br from-card to-muted/30 p-5 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              Aperçu en-tête des factures
            </h4>
            <Badge variant="outline" className="text-[10px]">
              Document Officiel
            </Badge>
          </div>

          <div className="p-4 rounded-md border bg-background space-y-3 text-xs shadow-xs">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <p className="font-black text-sm text-foreground">
                  {config.raisonSociale || "Nom de l'hôtel"}
                </p>
                <p className="text-muted-foreground mt-0.5">
                  {config.adresse || "Adresse complète"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Tél : {contactPhone}
                </p>
                <div className="flex items-center gap-1 mt-1 text-amber-500">
                  {"★".repeat(config.categorieEtoiles)}
                  <span className="text-[10px] text-muted-foreground ml-1">
                    ({config.categorieEtoiles} étoiles)
                  </span>
                </div>
              </div>
              <div className="text-right border p-1.5 rounded bg-muted/10">
                <span className="font-bold text-[10px] text-primary">
                  FACTURE HÉBERGEMENT
                </span>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  N° FAC-2026-00892
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px] bg-muted/20 p-2 rounded border">
              <div>
                <span className="text-muted-foreground block font-medium">
                  ICE
                </span>
                <span className="font-mono font-bold text-foreground">
                  {config.ice}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block font-medium">
                  I.F.
                </span>
                <span className="font-mono font-bold text-foreground">
                  {config.identifiantFiscal}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block font-medium">
                  R.C.
                </span>
                <span className="font-mono font-bold text-foreground">
                  {config.rc}
                </span>
              </div>
            </div>

            <div className="p-2 bg-primary/5 rounded border border-primary/20 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Arrivée (Check-in) :
                </span>
                <span className="font-bold text-foreground">{checkInTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Départ (Check-out) :
                </span>
                <span className="font-bold text-foreground">
                  {checkOutTime}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Devise retenue :</span>
                <span className="font-bold text-primary">{config.devise}</span>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground italic text-center">
              Mentions éditées conformément à la réglementation du Ministère du
              Tourisme et de la DGI du Maroc.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-2 text-xs">
          <h5 className="font-semibold text-foreground flex items-center gap-1.5">
            <Info className="size-4 text-blue-500" />
            Conformité et Sécurité
          </h5>
          <p className="text-muted-foreground leading-relaxed">
            Toute modification apportée à l'identité légale répercute
            automatiquement sur l'en-tête de toutes les factures, factures
            d'avoir et reçus de folios émis.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================
   SECTION 2: GESTION DES RÔLES & PERMISSIONS PAR DÉPARTEMENT
   ======================================================================== */
interface PermissionItem {
  id: string;
  category: string;
  label: string;
  description: string;
}

const PERMISSIONS_LIST: PermissionItem[] = [
  {
    id: "reservations_read",
    category: "Réservations",
    label: "Consulter les réservations",
    description: "Accès en lecture au rack et à la liste des séjours",
  },
  {
    id: "reservations_write",
    category: "Réservations",
    label: "Créer / Modifier réservations",
    description: "Enregistrer de nouvelles réservations et modifier les dates",
  },
  {
    id: "reservations_delete",
    category: "Réservations",
    label: "Annuler réservations",
    description: "Procédure d'annulation avec saisie du motif obligatoire",
  },
  {
    id: "folios_read",
    category: "Caisse & Folios",
    label: "Voir les folios et factures",
    description: "Lecture des détails financiers et de la caisse",
  },
  {
    id: "folios_payment",
    category: "Caisse & Folios",
    label: "Encaisser les règlements",
    description: "Enregistrer des paiements CB, Espèces ou Virement",
  },
  {
    id: "folios_discount",
    category: "Caisse & Folios",
    label: "Appliquer des remises / Avoirs",
    description: "Accord de remises exceptionnelles ou émission d'avoirs",
  },
  {
    id: "housekeeping_manage",
    category: "Gouvernance",
    label: "Changer statuts de propreté",
    description: "Marquer propre, sale, à inspecter ou hors service",
  },
  {
    id: "parameters_edit",
    category: "Administration",
    label: "Modifier la configuration hôtel",
    description: "Taxes, identité, tarifs saisonniers et utilisateurs",
  },
  {
    id: "audit_read",
    category: "Administration",
    label: "Accéder au journal d'audit",
    description: "Consultation de l'historique inviolable d'audit",
  },
];

interface RoleDefinition {
  id: string;
  name: string;
  department: string;
  badgeColor: string;
  permissions: string[];
  userCount: number;
}

function UserRolesSection() {
  const [roles, setRoles] = useState<RoleDefinition[]>([
    {
      id: "ADMIN",
      name: "Direction & Administration",
      department: "Administration",
      badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
      permissions: PERMISSIONS_LIST.map((p) => p.id),
      userCount: 2,
    },
    {
      id: "RECEPTION",
      name: "Agent de Réception",
      department: "Front-Office",
      badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
      permissions: [
        "reservations_read",
        "reservations_write",
        "reservations_delete",
        "folios_read",
        "folios_payment",
        "housekeeping_manage",
      ],
      userCount: 6,
    },
    {
      id: "GOUVERNANTE",
      name: "Gouvernante / Ménage",
      department: "Housekeeping",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
      permissions: ["reservations_read", "housekeeping_manage"],
      userCount: 4,
    },
    {
      id: "COMPTABILITE",
      name: "Comptabilité & Finance",
      department: "Finance",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
      permissions: [
        "reservations_read",
        "folios_read",
        "folios_payment",
        "folios_discount",
        "audit_read",
      ],
      userCount: 2,
    },
  ]);

  const [selectedRoleId, setSelectedRoleId] = useState<string>("RECEPTION");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || roles[0];

  function togglePermission(permId: string) {
    if (selectedRole.id === "ADMIN") return; // L'Admin garde tout
    setRoles((prev) =>
      prev.map((role) => {
        if (role.id !== selectedRoleId) return role;
        const exists = role.permissions.includes(permId);
        const updatedPerms = exists
          ? role.permissions.filter((p) => p !== permId)
          : [...role.permissions, permId];
        return { ...role, permissions: updatedPerms };
      }),
    );
    setSaveSuccess(false);
  }

  function handleSavePermissions() {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  return (
    <div className="rounded-lg border bg-card p-6 shadow-xs flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Gestion des Rôles & Habilitations du Personnel
          </h3>
          <p className="text-muted-foreground text-xs mt-1">
            Définition des accès sécurité RBAC (Role-Based Access Control) par
            département et utilisateur.
          </p>
        </div>
        <Badge
          variant="outline"
          className="gap-1 bg-primary/5 text-primary border-primary/20 text-xs shrink-0 w-fit"
        >
          <Shield className="size-3.5" /> Contrôle d'Accès Matriciel
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Liste des rôles */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Rôles Départementaux
          </Label>

          <div className="space-y-2">
            {roles.map((role) => {
              const active = role.id === selectedRoleId;
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`w-full text-left p-3.5 rounded-lg border transition-all flex flex-col gap-2 ${
                    active
                      ? "border-primary bg-primary/5 shadow-2xs ring-1 ring-primary/20"
                      : "bg-background hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">
                      {role.name}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${role.badgeColor}`}
                    >
                      {role.department}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{role.permissions.length} permissions actives</span>
                    <span className="font-medium text-foreground">
                      {role.userCount} utilisateurs
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Matrice de permissions */}
        <div className="lg:col-span-8 flex flex-col gap-4 border rounded-lg p-5 bg-background shadow-2xs">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h4 className="font-bold text-base text-foreground flex items-center gap-2">
                <Key className="size-4 text-primary" />
                Matrice des permissions : {selectedRole.name}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cochez ou décochez les fonctionnalités autorisées pour ce
                profil.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleSavePermissions}
              className="gap-2 text-xs"
            >
              <Check className="size-4" />
              Enregistrer les droits
            </Button>
          </div>

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-medium rounded border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              Modifications de sécurité appliquées immédiatement à tous les
              utilisateurs du rôle {selectedRole.name}.
            </div>
          )}

          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
            {Array.from(new Set(PERMISSIONS_LIST.map((p) => p.category))).map(
              (category) => {
                const catPerms = PERMISSIONS_LIST.filter(
                  (p) => p.category === category,
                );
                return (
                  <div
                    key={category}
                    className="space-y-2 border-b pb-3 last:border-b-0"
                  >
                    <span className="text-xs font-bold text-primary tracking-wide uppercase">
                      {category}
                    </span>
                    <div className="space-y-2">
                      {catPerms.map((perm) => {
                        const isChecked = selectedRole.permissions.includes(
                          perm.id,
                        );
                        const isLocked = selectedRole.id === "ADMIN";
                        return (
                          <button
                            type="button"
                            key={perm.id}
                            onClick={() =>
                              !isLocked && togglePermission(perm.id)
                            }
                            className={`w-full text-left flex items-start gap-3 p-2.5 rounded-md border cursor-pointer transition-colors ${
                              isChecked
                                ? "bg-primary/5 border-primary/30"
                                : "bg-muted/10 border-muted hover:bg-muted/20"
                            } ${isLocked ? "opacity-80 cursor-not-allowed" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isLocked}
                              onChange={() => togglePermission(perm.id)}
                              className="mt-0.5 rounded text-primary focus:ring-primary pointer-events-none"
                            />
                            <div className="flex-1 space-y-0.5">
                              <span className="text-xs font-bold text-foreground block">
                                {perm.label}
                              </span>
                              <span className="text-[11px] text-muted-foreground block">
                                {perm.description}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================
   SECTION 3: MAINTENANCE, SAUVEGARDES BASE DE DONNÉES & LOGS SYSTÈME
   ======================================================================== */
interface BackupSnapshot {
  id: string;
  filename: string;
  createdAt: string;
  size: string;
  type: "AUTOMATIQUE" | "MANUELLE";
  status: "RÉUSSIE" | "EN_COURS";
}

interface SystemLog {
  id: string;
  timestamp: string;
  level: "INFO" | "WARNING" | "ERROR";
  source: string;
  message: string;
}

function MaintenanceBackupsSection() {
  const [backups, setBackups] = useState<BackupSnapshot[]>([
    {
      id: "bk-2026-07-25-01",
      filename: "pms_makarim_db_20260725_030000.sql.gz",
      createdAt: "2026-07-25 03:00:00",
      size: "42.8 MB",
      type: "AUTOMATIQUE",
      status: "RÉUSSIE",
    },
    {
      id: "bk-2026-07-24-01",
      filename: "pms_makarim_db_20260724_030000.sql.gz",
      createdAt: "2026-07-24 03:00:00",
      size: "41.5 MB",
      type: "AUTOMATIQUE",
      status: "RÉUSSIE",
    },
    {
      id: "bk-2026-07-20-manual",
      filename: "pms_makarim_manual_before_update.sql.gz",
      createdAt: "2026-07-20 18:45:12",
      size: "39.2 MB",
      type: "MANUELLE",
      status: "RÉUSSIE",
    },
  ]);

  const [logs] = useState<SystemLog[]>([
    {
      id: "log-1",
      timestamp: "2026-07-25 05:20:11",
      level: "INFO",
      source: "PostgreSQL Engine",
      message: "CheckPoint réussi. 12 pages modifiées enregistrées sur disque.",
    },
    {
      id: "log-2",
      timestamp: "2026-07-25 05:15:02",
      level: "INFO",
      source: "ChannelManagerWorker",
      message:
        "Synchronisation de la disponibilité vers Booking.com terminée sans erreur (14 types rooms maj).",
    },
    {
      id: "log-3",
      timestamp: "2026-07-25 04:50:33",
      level: "WARNING",
      source: "AuthService",
      message:
        "Échec de tentative de connexion pour l'utilisateur 'admin_old' depuis 196.200.14.8",
    },
    {
      id: "log-4",
      timestamp: "2026-07-25 03:00:05",
      level: "INFO",
      source: "BackupScheduler",
      message:
        "Sauvegarde automatique nocturne pms_makarim_db_20260725_030000.sql.gz générée avec succès.",
    },
    {
      id: "log-5",
      timestamp: "2026-07-24 22:12:00",
      level: "ERROR",
      source: "DocumentOCRService",
      message:
        "Avertissement OCR : Document d'identité passeport flou rejeté pour le client #1042.",
    },
  ]);

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [logFilterLevel, setLogFilterLevel] = useState<string>("ALL");

  function triggerManualBackup() {
    setIsBackingUp(true);
    setBackupNotice(null);
    setTimeout(() => {
      const newBk: BackupSnapshot = {
        id: `bk-${Date.now()}`,
        filename: `pms_makarim_manual_${new Date().toISOString().slice(0, 10)}.sql.gz`,
        createdAt: new Date().toISOString().replace("T", " ").slice(0, 19),
        size: "43.1 MB",
        type: "MANUELLE",
        status: "RÉUSSIE",
      };
      setBackups([newBk, ...backups]);
      setIsBackingUp(false);
      setBackupNotice(
        "Sauvegarde manuelle complète créée et vérifiée (SHA-256 valide).",
      );
    }, 2000);
  }

  const filteredLogs = logs.filter((l) => {
    if (logFilterLevel === "ALL") return true;
    return l.level === logFilterLevel;
  });

  return (
    <div className="space-y-6">
      {/* Panneau de sauvegarde BDD */}
      <div className="rounded-lg border bg-card p-6 shadow-xs flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Database className="size-5 text-primary" />
              Sauvegardes de la Base de Données (PostgreSQL)
            </h3>
            <p className="text-muted-foreground text-xs mt-1">
              Sauvegardes automatiques quotidiennes et déclenchement manuel
              instantané avant opérations critiques.
            </p>
          </div>
          <Button
            size="sm"
            onClick={triggerManualBackup}
            disabled={isBackingUp}
            className="gap-2 text-xs shrink-0 w-fit"
          >
            <HardDrive className="size-4" />
            {isBackingUp
              ? "Création du DUMP…"
              : "Sauvegarder la BDD maintenant"}
          </Button>
        </div>

        {backupNotice && (
          <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-medium rounded border border-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            {backupNotice}
          </div>
        )}

        <div className="border rounded-lg overflow-hidden bg-background">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b text-muted-foreground font-semibold">
              <tr>
                <th className="p-3">Fichier DUMP</th>
                <th className="p-3">Type</th>
                <th className="p-3">Date & Heure</th>
                <th className="p-3">Taille</th>
                <th className="p-3">Statut</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {backups.map((bk) => (
                <tr key={bk.id} className="hover:bg-muted/20">
                  <td className="p-3 font-mono font-bold text-foreground">
                    {bk.filename}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={bk.type === "MANUELLE" ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {bk.type}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{bk.createdAt}</td>
                  <td className="p-3 font-mono text-muted-foreground">
                    {bk.size}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                    >
                      <Check className="size-3 mr-1" /> {bk.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] h-7 gap-1"
                    >
                      <Download className="size-3" /> Télécharger
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 gap-1"
                    >
                      <RotateCcw className="size-3" /> Tester Restauration
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Consoles de Logs Système */}
      <div className="rounded-lg border bg-card p-6 shadow-xs flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Terminal className="size-5 text-primary" />
              Journaux Système & Évènements Serveur
            </h3>
            <p className="text-muted-foreground text-xs mt-1">
              Traçabilité en temps réel des processus d'arrière-plan, des
              requêtes BDD et des erreurs d'exécution.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={logFilterLevel}
              onValueChange={(v) => v && setLogFilterLevel(v)}
            >
              <SelectTrigger className="w-36 text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les niveaux</SelectItem>
                <SelectItem value="INFO">INFO uniquement</SelectItem>
                <SelectItem value="WARNING">WARNING uniquement</SelectItem>
                <SelectItem value="ERROR">ERROR uniquement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs space-y-2 max-h-[350px] overflow-y-auto">
          {filteredLogs.map((log) => {
            const levelColor =
              log.level === "ERROR"
                ? "text-red-400 font-bold"
                : log.level === "WARNING"
                  ? "text-amber-400 font-bold"
                  : "text-emerald-400";
            return (
              <div
                key={log.id}
                className="flex flex-wrap items-start gap-2 border-b border-slate-800 pb-1.5 last:border-0"
              >
                <span className="text-slate-500 text-[10px]">
                  {log.timestamp}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded ${levelColor}`}
                >
                  [{log.level}]
                </span>
                <span className="text-sky-300 font-semibold text-[11px]">
                  &lt;{log.source}&gt;
                </span>
                <span className="text-slate-200 text-[11px]">
                  {log.message}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ========================================================================
   SECTION 4: PRÉFÉRENCES D'AFFICHAGE & DENSITÉ
   ======================================================================== */
function DisplayPreferencesSection() {
  const [density, setDensity] = useState<"compact" | "comfortable">(
    (localStorage.getItem("pms_density") as "compact" | "comfortable") ||
      "comfortable",
  );
  const [theme, setTheme] = useState<"light" | "dark" | "system">(
    (localStorage.getItem("pms_theme") as "light" | "dark" | "system") ||
      "light",
  );
  const [pageSize, setPageSize] = useState("25");
  const [defaultPage, setDefaultPage] = useState("dashboard");
  const [enableAnimations, setEnableAnimations] = useState(true);
  const [savedNotice, setSavedNotice] = useState(false);

  function handleSavePreferences(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem("pms_density", density);
    localStorage.setItem("pms_theme", theme);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  }

  return (
    <div className="rounded-lg border bg-card p-6 shadow-xs flex flex-col gap-6 max-w-3xl">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sliders className="size-5 text-primary" />
          Préférences d'Affichage & Interface Utilisateur
        </h3>
        <p className="text-muted-foreground text-xs mt-1">
          Personnalisez la densité des données, le thème visuel et vos
          raccourcis de navigation pour votre compte.
        </p>
      </div>

      <form className="flex flex-col gap-6" onSubmit={handleSavePreferences}>
        {/* Densité de mise en page */}
        <div className="space-y-3 border-b pb-5">
          <Label className="text-xs font-bold uppercase tracking-wider text-primary">
            Densité d'Affichage des Données
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setDensity("comfortable")}
              className={`p-4 rounded-lg border text-left flex flex-col gap-2 transition-all ${
                density === "comfortable"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "bg-background hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Layout className="size-4 text-primary" />
                  Mode Confortable
                </span>
                {density === "comfortable" && (
                  <CheckCircle2 className="size-4 text-primary" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Espacement aéré, grands boutons tactiles et marges généreuses
                pour un confort de lecture optimal.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setDensity("compact")}
              className={`p-4 rounded-lg border text-left flex flex-col gap-2 transition-all ${
                density === "compact"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "bg-background hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Activity className="size-4 text-primary" />
                  Mode Compact
                </span>
                {density === "compact" && (
                  <CheckCircle2 className="size-4 text-primary" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Hauteurs de lignes réduites pour afficher un maximum de
                réservations et de données sur les écrans de réception.
              </p>
            </button>
          </div>
        </div>

        {/* Thème visuel */}
        <div className="space-y-3 border-b pb-5">
          <Label className="text-xs font-bold uppercase tracking-wider text-primary">
            Thème Visuel
          </Label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`p-3 rounded-lg border flex flex-col items-center gap-2 text-center transition-all ${
                theme === "light"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "bg-background hover:bg-muted/30"
              }`}
            >
              <Sun className="size-5 text-amber-500" />
              <span className="text-xs font-bold text-foreground">Clair</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`p-3 rounded-lg border flex flex-col items-center gap-2 text-center transition-all ${
                theme === "dark"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "bg-background hover:bg-muted/30"
              }`}
            >
              <Moon className="size-5 text-indigo-500" />
              <span className="text-xs font-bold text-foreground">Sombre</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme("system")}
              className={`p-3 rounded-lg border flex flex-col items-center gap-2 text-center transition-all ${
                theme === "system"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "bg-background hover:bg-muted/30"
              }`}
            >
              <Sliders className="size-5 text-emerald-500" />
              <span className="text-xs font-bold text-foreground">Système</span>
            </button>
          </div>
        </div>

        {/* Options de navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b pb-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pageSize">Éléments par page par défaut</Label>
            <Select value={pageSize} onValueChange={(v) => v && setPageSize(v)}>
              <SelectTrigger id="pageSize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 résultats par page</SelectItem>
                <SelectItem value="25">25 résultats par page</SelectItem>
                <SelectItem value="50">50 résultats par page</SelectItem>
                <SelectItem value="100">100 résultats par page</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="defaultPage">Page de démarrage au login</Label>
            <Select
              value={defaultPage}
              onValueChange={(v) => v && setDefaultPage(v)}
            >
              <SelectTrigger id="defaultPage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dashboard">
                  Tableau de Bord Général
                </SelectItem>
                <SelectItem value="reservations">
                  Rack & Planning Réservations
                </SelectItem>
                <SelectItem value="checkin">
                  Réception / Check-in Direct
                </SelectItem>
                <SelectItem value="housekeeping">
                  Ménage & Gouvernance
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="anim"
            checked={enableAnimations}
            onChange={(e) => setEnableAnimations(e.target.checked)}
            className="rounded text-primary focus:ring-primary"
          />
          <Label htmlFor="anim" className="text-xs font-normal cursor-pointer">
            Activer les transitions et animations fluides de l'interface
          </Label>
        </div>

        {savedNotice && (
          <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-medium rounded border border-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            Préférences visuelles enregistrées.
          </div>
        )}

        <Button type="submit" className="w-fit gap-2 text-xs self-start">
          Enregistrer mes préférences
        </Button>
      </form>
    </div>
  );
}

/* ========================================================================
   SECTION 5: TVA & TAXES LÉGALES
   ======================================================================== */
function TaxRatesSection() {
  const [rates, setRates] = useState<TaxRateConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [motifs, setMotifs] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listTaxRates();
      setRates(data);
      setDrafts(Object.fromEntries(data.map((r) => [r.id, r.taux])));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erreur de chargement");
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
      await updateTaxRate(id, drafts[id], motifs[id] ?? "");
      setMotifs({ ...motifs, [id]: "" });
      await refetch();
    } catch (err) {
      setRowError(
        err instanceof Error ? err.message : "Erreur d'enregistrement",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function handleCreateTax(input: CreateTaxRateInput) {
    setCreateError(null);
    setSubmitting(true);
    try {
      await createTaxRate(input);
      setCreateOpen(false);
      await refetch();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Erreur lors de la création",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <p className="text-muted-foreground text-sm">
        Chargement des taux de taxe…
      </p>
    );
  if (loadError) return <p className="text-destructive text-sm">{loadError}</p>;

  return (
    <div className="rounded-lg border bg-card p-6 shadow-xs flex flex-col gap-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Receipt className="size-5 text-primary" />
            Taux de TVA & Taxes Légales
          </h3>
          <p className="text-muted-foreground text-xs mt-1">
            Paramétrage des taux d'imposition applicables aux nuitées,
            prestations annexes et taxes de séjour.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="gap-2 text-xs shrink-0 w-fit"
        >
          <Plus className="size-4" />
          Ajouter une taxe
        </Button>
      </div>

      {rowError && (
        <p className="text-destructive text-xs font-medium">{rowError}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rates.map((rate) => {
          const motif = motifs[rate.id] ?? "";
          const unchanged = drafts[rate.id] === rate.taux;
          return (
            <div
              key={rate.id}
              className="flex flex-col justify-between gap-4 rounded-lg border p-4 bg-background shadow-2xs"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">
                    {TAX_TYPE_LABEL[rate.type] ?? rate.type}
                  </span>
                  <Badge
                    variant={rate.actif !== false ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {rate.actif !== false ? "Actif" : "Suspendu"}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    <Input
                      id={`taux-${rate.id}`}
                      type="number"
                      step="0.01"
                      value={drafts[rate.id] ?? ""}
                      onChange={(e) =>
                        setDrafts({ ...drafts, [rate.id]: e.target.value })
                      }
                      className="font-mono text-sm font-semibold"
                    />
                    <span className="text-muted-foreground text-xs font-semibold shrink-0">
                      {rate.mode === "MONTANT_FIXE_PAR_NUITEE"
                        ? "MAD / nuit"
                        : "%"}
                    </span>
                  </div>
                </div>

                {rate.collectePourTresor && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200 flex items-center gap-1">
                    <Info className="size-3 shrink-0 text-amber-600" />
                    Collecté pour le Trésor Public (Folio direct)
                  </p>
                )}
              </div>

              {!unchanged && (
                <div className="space-y-2 border-t pt-3">
                  <Input
                    value={motif}
                    onChange={(e) =>
                      setMotifs({ ...motifs, [rate.id]: e.target.value })
                    }
                    placeholder="Motif de modification (≥ 10 caract.)"
                    className="text-xs"
                  />
                  <Button
                    size="sm"
                    className="w-full text-xs"
                    disabled={
                      savingId === rate.id || unchanged || motif.length < 10
                    }
                    onClick={() => handleSave(rate.id)}
                  >
                    {savingId === rate.id
                      ? "Enregistrement…"
                      : "Mettre à jour le taux"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(next) => !next && setCreateOpen(false)}
      >
        <DialogContent>
          {createOpen && (
            <CreateTaxForm
              onClose={() => setCreateOpen(false)}
              onConfirm={handleCreateTax}
              submitting={submitting}
              error={createError}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CreateTaxFormProps {
  onClose: () => void;
  onConfirm: (input: CreateTaxRateInput) => void;
  submitting: boolean;
  error: string | null;
}

function CreateTaxForm({
  onClose,
  onConfirm,
  submitting,
  error,
}: CreateTaxFormProps) {
  const [type, setType] = useState("");
  const [mode, setMode] = useState<"POURCENTAGE" | "MONTANT_FIXE_PAR_NUITEE">(
    "POURCENTAGE",
  );
  const [taux, setTaux] = useState("");
  const [collectePourTresor, setCollectePourTresor] = useState(false);
  const [applicableParDefaut, setApplicableParDefaut] = useState(true);
  const [motif, setMotif] = useState("");

  const canSubmit = type && taux && motif.length >= 10;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base font-bold">
          Création d'une nouvelle taxe
        </DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-3 text-xs"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          onConfirm({
            type,
            mode,
            taux,
            collectePourTresor,
            applicableParDefaut,
            motif,
          });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="taxType">Code / Intitulé de la taxe</Label>
          <Input
            id="taxType"
            value={type}
            onChange={(e) => setType(e.target.value.toUpperCase())}
            placeholder="Ex. TAXE_TOURISTIQUE_REGIONALE"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="taxMode">Mode de calcul</Label>
          <Select
            value={mode}
            onValueChange={(v) =>
              v && setMode(v as "POURCENTAGE" | "MONTANT_FIXE_PAR_NUITEE")
            }
            items={[
              { value: "POURCENTAGE", label: "Pourcentage (%)" },
              {
                value: "MONTANT_FIXE_PAR_NUITEE",
                label: "Montant fixe par nuitée / personne (MAD)",
              },
            ]}
          >
            <SelectTrigger id="taxMode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="POURCENTAGE">Pourcentage (%)</SelectItem>
              <SelectItem value="MONTANT_FIXE_PAR_NUITEE">
                Montant fixe par nuitée / personne (MAD)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="taxTaux">Valeur du taux</Label>
          <Input
            id="taxTaux"
            type="number"
            step="0.01"
            value={taux}
            onChange={(e) => setTaux(e.target.value)}
            placeholder="Ex. 15.00"
            required
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="collecte"
            checked={collectePourTresor}
            onChange={(e) => setCollectePourTresor(e.target.checked)}
            className="rounded text-primary"
          />
          <Label htmlFor="collecte" className="font-normal cursor-pointer">
            Taxe collectée pour le compte du Trésor Public
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="defaut"
            checked={applicableParDefaut}
            onChange={(e) => setApplicableParDefaut(e.target.checked)}
            className="rounded text-primary"
          />
          <Label htmlFor="defaut" className="font-normal cursor-pointer">
            Appliquer automatiquement par défaut aux folios
          </Label>
        </div>

        <div className="flex flex-col gap-1.5 border-t pt-3 mt-1">
          <Label
            htmlFor="createTaxMotif"
            className="font-semibold text-primary"
          >
            Motif de création (≥ 10 caract.)
          </Label>
          <Input
            id="createTaxMotif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. Décret municipal concernant la nouvelle surtaxe"
            required
          />
        </div>

        {error && <p className="text-destructive font-medium">{error}</p>}

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? "Création…" : "Créer la taxe"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

/* ========================================================================
   SECTION 6: GRILLE TARIFAIRE SAISONNIÈRE
   ======================================================================== */
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
      setLoadError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  async function handleDelete(id: number) {
    const motif = deleteMotifs[id] ?? "";
    if (motif.length < 10) return;
    setActionError(null);
    setDeletingId(id);
    try {
      await deleteSeasonRate(id, motif);
      await refetch();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erreur de suppression",
      );
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
      setFormError(
        err instanceof Error ? err.message : "Erreur lors de la création",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const roomTypeName = (id: number) =>
    roomTypes.find((rt) => rt.id === id)?.nom ?? `Type #${id}`;

  return (
    <div className="rounded-lg border bg-card p-6 shadow-xs flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CalendarRange className="size-5 text-primary" />
            Grille Tarifaire Saisonnière
          </h3>
          <p className="text-muted-foreground text-xs mt-1">
            Périodes tarifaires par type de chambre. Contrôle automatique
            d'absence de chevauchement.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="gap-2 text-xs shrink-0 w-fit"
        >
          <Plus className="size-4" />
          Nouveau tarif saisonnier
        </Button>
      </div>

      {loadError && <p className="text-destructive text-xs">{loadError}</p>}
      {actionError && <p className="text-destructive text-xs">{actionError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-xs">
          Chargement de la grille…
        </p>
      ) : seasonRates.length === 0 ? (
        <p className="text-muted-foreground text-xs py-8 text-center border rounded-md bg-muted/10">
          Aucun tarif saisonnier configuré pour le moment.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {seasonRates.map((rate) => {
            const motif = deleteMotifs[rate.id] ?? "";
            return (
              <div
                key={rate.id}
                className="flex flex-col justify-between gap-3 rounded-lg border p-4 bg-background shadow-2xs"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm text-foreground">
                      {rate.libelle}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-primary/5 text-primary border-primary/20"
                    >
                      {roomTypeName(rate.roomTypeId)}
                    </Badge>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    <p className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-muted-foreground" />
                      Du{" "}
                      <span className="font-medium text-foreground">
                        {rate.dateDebut.slice(0, 10)}
                      </span>{" "}
                      au{" "}
                      <span className="font-medium text-foreground">
                        {rate.dateFin.slice(0, 10)}
                      </span>
                    </p>
                    <p className="text-base font-extrabold text-emerald-600 mt-1">
                      {rate.prixNuit} MAD{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        / nuit
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t pt-3 mt-1">
                  <Input
                    value={motif}
                    onChange={(e) =>
                      setDeleteMotifs({
                        ...deleteMotifs,
                        [rate.id]: e.target.value,
                      })
                    }
                    placeholder="Motif de suppression (≥ 10 caract.)"
                    className="flex-1 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 text-xs shrink-0"
                    disabled={deletingId === rate.id || motif.length < 10}
                    onClick={() => handleDelete(rate.id)}
                  >
                    <Trash2 className="size-4" />
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
    roomTypes[0] ? String(roomTypes[0].id) : "",
  );
  const [libelle, setLibelle] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [prixNuit, setPrixNuit] = useState("");
  const [motif, setMotif] = useState("");

  const canSubmit =
    roomTypeId &&
    libelle &&
    dateDebut &&
    dateFin &&
    dateFin >= dateDebut &&
    prixNuit &&
    motif.length >= 10;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base font-bold">
          Nouveau tarif saisonnier
        </DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-3 text-xs"
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
          <Label htmlFor="libelle">Libellé de la saison</Label>
          <Input
            id="libelle"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Ex. Haute saison estivale"
            required
          />
        </div>

        <DateRangeField
          idPrefix="season-rate"
          startValue={dateDebut}
          endValue={dateFin}
          onStartChange={setDateDebut}
          onEndChange={setDateFin}
          required
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prixNuit">Prix par nuit (MAD HT)</Label>
          <Input
            id="prixNuit"
            type="number"
            step="0.01"
            value={prixNuit}
            onChange={(e) => setPrixNuit(e.target.value)}
            placeholder="Ex. 1200.00"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5 border-t pt-3">
          <Label htmlFor="motif" className="font-semibold text-primary">
            Motif obligatoire (≥ 10 caract.)
          </Label>
          <Input
            id="motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. Ouverture de la grille tarifaire été 2026"
            required
          />
        </div>

        {error && <p className="text-destructive font-medium">{error}</p>}

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
            {submitting ? "Création…" : "Créer le tarif"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

/* ========================================================================
   SECTION 7: RESTRICTIONS TARIFAIRES (MIN STAY & STOP SALE)
   ======================================================================== */
function RateRestrictionsSection() {
  const [restrictions, setRestrictions] = useState<RateRestriction[]>([]);
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
      const [restData, roomsData] = await Promise.all([
        listRateRestrictions(),
        listRooms(),
      ]);
      setRestrictions(restData);
      const uniqueTypes = new Map<number, RoomType>();
      for (const room of roomsData)
        uniqueTypes.set(room.roomType.id, room.roomType);
      setRoomTypes([...uniqueTypes.values()]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  async function handleDelete(id: number) {
    const motif = deleteMotifs[id] ?? "";
    if (motif.length < 10) return;
    setActionError(null);
    setDeletingId(id);
    try {
      await deleteRateRestriction(id, motif);
      await refetch();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erreur de suppression",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleActive(rest: RateRestriction) {
    const motif = "Basculement statut restriction";
    try {
      await updateRateRestriction(rest.id, {
        actif: !rest.actif,
        motif,
      });
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function handleCreate(input: CreateRateRestrictionInput) {
    setFormError(null);
    setSubmitting(true);
    try {
      await createRateRestriction(input);
      setDialogOpen(false);
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Erreur lors de la création",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const roomTypeName = (id: number) =>
    roomTypes.find((rt) => rt.id === id)?.nom ?? `Type #${id}`;

  return (
    <div className="rounded-lg border bg-card p-6 shadow-xs flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-500" />
            Restrictions Tarifaires & Stop Sale
          </h3>
          <p className="text-muted-foreground text-xs mt-1">
            Gestion du séjour minimum (Min Stay) et fermeture à la vente (Stop
            Sale) pour travaux ou pics d'affluence.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="gap-2 text-xs shrink-0 w-fit"
        >
          <Plus className="size-4" />
          Nouvelle restriction
        </Button>
      </div>

      {loadError && <p className="text-destructive text-xs">{loadError}</p>}
      {actionError && <p className="text-destructive text-xs">{actionError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-xs">
          Chargement des restrictions…
        </p>
      ) : restrictions.length === 0 ? (
        <p className="text-muted-foreground text-xs py-8 text-center border rounded-md bg-muted/10">
          Aucune restriction ni fermetures configurées. Toutes les chambres sont
          ouvertes à la réservation.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {restrictions.map((rest) => {
            const motif = deleteMotifs[rest.id] ?? "";
            return (
              <div
                key={rest.id}
                className="flex flex-col justify-between gap-3 rounded-lg border p-4 bg-background shadow-2xs"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                      {rest.stopSale ? (
                        <Badge
                          variant="destructive"
                          className="gap-1 text-[10px]"
                        >
                          <Ban className="size-3" /> Stop Sale
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                        >
                          Min Stay {rest.minStayNuits} nuits
                        </Badge>
                      )}
                      {rest.libelle && <span>— {rest.libelle}</span>}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleActive(rest)}
                      className="text-[10px] h-6 px-2"
                    >
                      {rest.actif ? "Désactiver" : "Activer"}
                    </Button>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">
                      Application : {roomTypeName(rest.roomTypeId)}
                    </p>
                    <p>
                      Période du{" "}
                      <span className="font-medium text-foreground">
                        {rest.dateDebut.slice(0, 10)}
                      </span>{" "}
                      au{" "}
                      <span className="font-medium text-foreground">
                        {rest.dateFin.slice(0, 10)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t pt-3 mt-1">
                  <Input
                    value={motif}
                    onChange={(e) =>
                      setDeleteMotifs({
                        ...deleteMotifs,
                        [rest.id]: e.target.value,
                      })
                    }
                    placeholder="Motif de suppression (≥ 10 caract.)"
                    className="flex-1 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 text-xs shrink-0"
                    disabled={deletingId === rest.id || motif.length < 10}
                    onClick={() => handleDelete(rest.id)}
                  >
                    <Trash2 className="size-4" />
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
            <CreateRateRestrictionForm
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

interface CreateRateRestrictionFormProps {
  roomTypes: RoomType[];
  onClose: () => void;
  onConfirm: (input: CreateRateRestrictionInput) => void;
  submitting: boolean;
  error: string | null;
}

function CreateRateRestrictionForm({
  roomTypes,
  onClose,
  onConfirm,
  submitting,
  error,
}: CreateRateRestrictionFormProps) {
  const [roomTypeId, setRoomTypeId] = useState(
    roomTypes[0] ? String(roomTypes[0].id) : "",
  );
  const [libelle, setLibelle] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [stopSale, setStopSale] = useState(false);
  const [minStayNuits, setMinStayNuits] = useState("2");
  const [motif, setMotif] = useState("");

  const canSubmit =
    roomTypeId &&
    dateDebut &&
    dateFin &&
    dateFin >= dateDebut &&
    motif.length >= 10;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base font-bold">
          Nouvelle restriction / Fermeture
        </DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-3 text-xs"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          onConfirm({
            roomTypeId: Number(roomTypeId),
            libelle: libelle || undefined,
            dateDebut,
            dateFin,
            stopSale,
            minStayNuits:
              !stopSale && minStayNuits ? Number(minStayNuits) : undefined,
            motif,
          });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="roomType">Type de chambre concerné</Label>
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
          <Label htmlFor="libelle">Intitulé de la règle</Label>
          <Input
            id="libelle"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Ex. Fermeture travaux d'entretien annuel"
          />
        </div>

        <DateRangeField
          idPrefix="restriction"
          startValue={dateDebut}
          endValue={dateFin}
          onStartChange={setDateDebut}
          onEndChange={setDateFin}
          required
        />

        <div className="flex flex-col gap-2 p-3 bg-muted/20 rounded-md border">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="stopSale"
              checked={stopSale}
              onChange={(e) => setStopSale(e.target.checked)}
              className="rounded text-primary"
            />
            <Label
              htmlFor="stopSale"
              className="font-bold text-destructive cursor-pointer flex items-center gap-1"
            >
              <Ban className="size-3.5" /> Stop Sale (Fermer complètement à la
              vente)
            </Label>
          </div>

          {!stopSale && (
            <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t">
              <Label htmlFor="minStay">Séjour minimum requis (Nuits)</Label>
              <Input
                id="minStay"
                type="number"
                min={1}
                value={minStayNuits}
                onChange={(e) => setMinStayNuits(e.target.value)}
                placeholder="Ex. 3"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 border-t pt-3">
          <Label htmlFor="motif" className="font-semibold text-primary">
            Motif obligatoire (≥ 10 caract.)
          </Label>
          <Input
            id="motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. Blocage pour congrès réservé par groupe entreprise"
            required
          />
        </div>

        {error && <p className="text-destructive font-medium">{error}</p>}

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
            {submitting ? "Création…" : "Créer la restriction"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

/* ========================================================================
   SECTION 8: CHANNEL MANAGER OTA
   ======================================================================== */
function ChannelManagerSection() {
  const [mappings, setMappings] = useState<ChannelRoomTypeMapping[]>([]);
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
      const [mappingsData, roomsData] = await Promise.all([
        listChannelMappings(),
        listRooms(),
      ]);
      setMappings(mappingsData);
      const uniqueTypes = new Map<number, RoomType>();
      for (const room of roomsData)
        uniqueTypes.set(room.roomType.id, room.roomType);
      setRoomTypes([...uniqueTypes.values()]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  async function handleDelete(id: number) {
    const motif = deleteMotifs[id] ?? "";
    if (motif.length < 10) return;
    setActionError(null);
    setDeletingId(id);
    try {
      await deleteChannelMapping(id, motif);
      await refetch();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erreur de suppression",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate(input: CreateChannelRoomTypeMappingInput) {
    setFormError(null);
    setSubmitting(true);
    try {
      await createChannelMapping(input);
      setDialogOpen(false);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur de création");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6 shadow-xs flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="size-5 text-primary" />
            Mappings Channel Manager OTA
          </h3>
          <p className="text-muted-foreground text-xs mt-1">
            Correspondance directe entre les identifiants de chambres externes
            (Booking.com, Expedia, Airbnb) et la typologie interne.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="gap-2 text-xs shrink-0 w-fit"
        >
          <Plus className="size-4" />
          Nouveau mapping OTA
        </Button>
      </div>

      {loadError && <p className="text-destructive text-xs">{loadError}</p>}
      {actionError && <p className="text-destructive text-xs">{actionError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-xs">
          Chargement des mappings…
        </p>
      ) : mappings.length === 0 ? (
        <p className="text-muted-foreground text-xs py-8 text-center border rounded-md bg-muted/10">
          Aucun mapping OTA configuré.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mappings.map((mapping) => {
            const motif = deleteMotifs[mapping.id] ?? "";
            return (
              <div
                key={mapping.id}
                className="flex flex-col justify-between gap-3 rounded-lg border p-4 bg-background shadow-2xs"
              >
                <div>
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="font-bold text-[10px]">
                      {CANAL_OTA_LABEL[mapping.canal]}
                    </Badge>
                    <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Synchronisé
                    </span>
                  </div>

                  <div className="mt-3 text-xs space-y-1">
                    <p className="text-muted-foreground">
                      ID Externe :{" "}
                      <span className="font-mono font-bold text-foreground">
                        {mapping.externalRoomTypeId}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Mapping Interne :{" "}
                      <span className="font-bold text-primary">
                        {mapping.roomType.nom}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t pt-3 mt-1">
                  <Input
                    value={motif}
                    onChange={(e) =>
                      setDeleteMotifs({
                        ...deleteMotifs,
                        [mapping.id]: e.target.value,
                      })
                    }
                    placeholder="Motif de suppression (≥ 10 caract.)"
                    className="flex-1 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 text-xs shrink-0"
                    disabled={deletingId === mapping.id || motif.length < 10}
                    onClick={() => handleDelete(mapping.id)}
                  >
                    <Trash2 className="size-4" />
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
            <CreateChannelMappingForm
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

interface CreateChannelMappingFormProps {
  roomTypes: RoomType[];
  onClose: () => void;
  onConfirm: (input: CreateChannelRoomTypeMappingInput) => void;
  submitting: boolean;
  error: string | null;
}

function CreateChannelMappingForm({
  roomTypes,
  onClose,
  onConfirm,
  submitting,
  error,
}: CreateChannelMappingFormProps) {
  const [canal, setCanal] = useState<CanalOTA>("BOOKING_COM");
  const [externalRoomTypeId, setExternalRoomTypeId] = useState("");
  const [roomTypeId, setRoomTypeId] = useState(
    roomTypes[0] ? String(roomTypes[0].id) : "",
  );
  const [motif, setMotif] = useState("");

  const canSubmit = externalRoomTypeId && roomTypeId && motif.length >= 10;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base font-bold">
          Nouveau mapping OTA
        </DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-3 text-xs"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          onConfirm({
            canal,
            externalRoomTypeId,
            roomTypeId: Number(roomTypeId),
            motif,
          });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="canal">Canal de distribution OTA</Label>
          <Select
            value={canal}
            onValueChange={(v) => v && setCanal(v as CanalOTA)}
            items={Object.entries(CANAL_OTA_LABEL).map(([value, label]) => ({
              value,
              label,
            }))}
          >
            <SelectTrigger id="canal" className="w-full">
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="externalRoomTypeId">
            Code type chambre côté partenaire (ID Externe)
          </Label>
          <Input
            id="externalRoomTypeId"
            value={externalRoomTypeId}
            onChange={(e) => setExternalRoomTypeId(e.target.value)}
            placeholder="Ex. STD-DBL-SEA"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="roomTypeInterne">
            Type de chambre interne correspondant
          </Label>
          <Select
            value={roomTypeId}
            onValueChange={(v) => v && setRoomTypeId(v)}
            items={roomTypes.map((rt) => ({
              value: String(rt.id),
              label: rt.nom,
            }))}
          >
            <SelectTrigger id="roomTypeInterne" className="w-full">
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

        <div className="flex flex-col gap-1.5 border-t pt-3">
          <Label htmlFor="motif" className="font-semibold text-primary">
            Motif obligatoire (≥ 10 caract.)
          </Label>
          <Input
            id="motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. Activation du nouveau contrat d'allotement Booking"
            required
          />
        </div>

        {error && <p className="text-destructive font-medium">{error}</p>}

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
            {submitting ? "Création…" : "Créer le mapping"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

/* ========================================================================
   SECTION 9: JOURNAL D'AUDIT & TRAÇABILITÉ (APPEND-ONLY AUDIT LOGS)
   ======================================================================== */
function AuditLogsSection() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("ALL");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAuditLogs({
        entite: entityFilter !== "ALL" ? entityFilter : undefined,
      });
      setLogs(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur de chargement d'audit",
      );
    } finally {
      setLoading(false);
    }
  }, [entityFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLogs();
  }, [loadLogs]);

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(query) ||
      log.targetEntity.toLowerCase().includes(query) ||
      log.motif.toLowerCase().includes(query)
    );
  });

  return (
    <div className="rounded-lg border bg-card p-6 shadow-xs flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <History className="size-5 text-primary" />
            Journal d'Audit & Inviolabilité (Append-Only)
          </h3>
          <p className="text-muted-foreground text-xs mt-1">
            Historique inaltérable de l'ensemble des modifications système,
            tarifs, identité et taxes avec motif consigné.
          </p>
        </div>
        <Badge
          variant="outline"
          className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 text-xs shrink-0 w-fit"
        >
          <CheckCircle2 className="size-3.5" /> Registre Inviolable
        </Badge>
      </div>

      {/* Filtres de recherche */}
      <div className="flex flex-wrap items-center gap-3 border-b pb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer par action, entité ou motif…"
            className="pl-8 text-xs h-9"
          />
        </div>

        <Select
          value={entityFilter}
          onValueChange={(v) => v && setEntityFilter(v)}
          items={[
            { value: "ALL", label: "Toutes les entités" },
            { value: "HotelConfig", label: "Identité Hôtel" },
            { value: "TaxRateConfig", label: "Taxes & TVA" },
            { value: "SeasonRate", label: "Tarifs Saisonniers" },
            { value: "RateRestriction", label: "Restrictions Tarifaires" },
          ]}
        >
          <SelectTrigger className="w-48 text-xs h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toutes les entités</SelectItem>
            <SelectItem value="HotelConfig">Identité Hôtel</SelectItem>
            <SelectItem value="TaxRateConfig">Taxes & TVA</SelectItem>
            <SelectItem value="SeasonRate">Tarifs Saisonniers</SelectItem>
            <SelectItem value="RateRestriction">
              Restrictions Tarifaires
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-destructive text-xs font-medium">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground text-xs py-6">
          Chargement du journal d'audit…
        </p>
      ) : filteredLogs.length === 0 ? (
        <p className="text-muted-foreground text-xs py-8 text-center border rounded-md bg-muted/10">
          Aucun enregistrement d'audit trouvé pour ce filtre.
        </p>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-3.5 rounded-lg border bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs"
            >
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] bg-muted/30"
                  >
                    {log.targetEntity} #{log.targetId}
                  </Badge>
                  <span className="font-bold text-foreground">
                    {log.action}
                  </span>
                </div>
                <p className="text-muted-foreground font-medium text-[11px] bg-muted/20 p-1.5 rounded border border-muted/30">
                  <span className="font-semibold text-foreground">
                    Motif :{" "}
                  </span>
                  « {log.motif} »
                </p>
              </div>

              <div className="text-right shrink-0 text-[11px] text-muted-foreground space-y-0.5 border-t sm:border-t-0 pt-2 sm:pt-0">
                <p className="font-mono">
                  {new Date(log.createdAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {log.userId && (
                  <p className="text-[10px] text-primary">
                    Utilisateur #{log.userId}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
