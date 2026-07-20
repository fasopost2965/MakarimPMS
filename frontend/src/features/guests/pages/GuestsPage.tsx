import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Users,
  UserPlus,
  Search,
  Award,
  ShieldAlert,
  Phone,
  Mail,
  Globe,
  FileText,
  Heart,
  User,
  Activity,
  CreditCard,
  History,
  ShieldX,
} from "lucide-react";
import {
  createGuest,
  getGuestFactures,
  getGuestHistorique,
  searchGuests,
  updateGuestCategorie,
} from "../api";
import type {
  CategorieClient,
  CreateGuestInput,
  Guest,
  GuestInvoice,
  GuestStayHistorique,
} from "../types";

const CATEGORIES: CategorieClient[] = [
  "STANDARD",
  "VIP",
  "ENTREPRISE",
  "AGENCE",
  "BLACKLIST",
];

const CATEGORIE_LABEL: Record<CategorieClient, string> = {
  STANDARD: "Standard",
  VIP: "VIP Premium",
  ENTREPRISE: "Compte Entreprise",
  AGENCE: "Agence de Voyage",
  BLACKLIST: "Liste Noire (Exclu)",
};

const CATEGORIE_STYLES: Record<
  CategorieClient,
  {
    bg: string;
    text: string;
    border: string;
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ReactNode;
  }
> = {
  STANDARD: {
    bg: "bg-slate-50 dark:bg-slate-900/30",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-800",
    badgeVariant: "outline",
    icon: <User className="h-3 w-3" />,
  },
  VIP: {
    bg: "bg-amber-500/[0.04] dark:bg-amber-500/[0.02]",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/20",
    badgeVariant: "default",
    icon: <Award className="h-3 w-3 text-amber-500" />,
  },
  ENTREPRISE: {
    bg: "bg-blue-500/[0.04] dark:bg-blue-500/[0.02]",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/20",
    badgeVariant: "secondary",
    icon: <Activity className="h-3 w-3 text-blue-500" />,
  },
  AGENCE: {
    bg: "bg-purple-500/[0.04] dark:bg-purple-500/[0.02]",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/20",
    badgeVariant: "secondary",
    icon: <Globe className="h-3 w-3 text-purple-500" />,
  },
  BLACKLIST: {
    bg: "bg-rose-500/[0.05] dark:bg-rose-500/[0.02]",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-500/30",
    badgeVariant: "destructive",
    icon: <ShieldAlert className="h-3 w-3 text-rose-500" />,
  },
};

export function GuestsPage() {
  const [query, setQuery] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Guest | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const refetch = useCallback(async (q: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      setGuests(await searchGuests(q || undefined));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refetch(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, refetch]);

  async function handleCreate(input: CreateGuestInput) {
    setCreateError(null);
    setCreating(true);
    try {
      const newGuest = await createGuest(input);
      setCreateOpen(false);
      await refetch(query);
      setSelected(newGuest);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erreur de création");
    } finally {
      setCreating(false);
    }
  }

  function handleGuestUpdated(updated: Guest) {
    setSelected(updated);
    setGuests((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  }

  // Pre-select first guest if list is loaded and none selected
  useEffect(() => {
    if (guests.length > 0 && !selected) {
      setSelected(guests[0]);
    }
  }, [guests, selected]);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Title Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-serif font-bold text-foreground">
              Fichier Clients & CRM
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Gérez les profils clients, leur historique de séjours, leurs préférences et l'attribution des statuts VIP ou Liste noire.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="gap-2 self-start sm:self-auto shadow-sm"
        >
          <UserPlus className="h-4 w-4" />
          Créer une fiche client
        </Button>
      </div>

      {loadError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive text-sm">
          {loadError}
        </div>
      )}

      {/* Main Grid: List on left, details on right */}
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden min-h-0">
        {/* Left Column: Search & List */}
        <div className="lg:col-span-5 flex flex-col gap-3 h-full min-h-0">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher (nom, téléphone, passeport...)"
              className="pl-9 h-9.5 text-xs bg-card"
            />
          </div>

          <div className="flex-1 overflow-auto pr-1 flex flex-col gap-2">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-16 justify-center">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Recherche...
              </div>
            ) : guests.length === 0 ? (
              <div className="rounded-xl border border-dashed py-16 text-center bg-card">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold text-muted-foreground">Aucun client trouvé</p>
                <p className="text-xs text-muted-foreground mt-0.5">Vérifiez les critères ou créez une nouvelle fiche.</p>
              </div>
            ) : (
              guests.map((guest) => {
                const isSelected = selected?.id === guest.id;
                const cStyle = CATEGORIE_STYLES[guest.categorie] || CATEGORIE_STYLES.STANDARD;
                const initials = `${guest.nom.slice(0, 1)}${guest.prenom.slice(0, 1)}`.toUpperCase();

                return (
                  <button
                    key={guest.id}
                    type="button"
                    onClick={() => setSelected(guest)}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all hover:bg-muted ${
                      isSelected
                        ? "border-primary bg-primary/[0.02] ring-1 ring-primary/30"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar initials */}
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                      }`}>
                        {initials}
                      </div>

                      <div className="text-left leading-tight">
                        <p className="font-semibold text-sm text-foreground">
                          {guest.nom} {guest.prenom}
                        </p>
                        {guest.telephone ? (
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
                            <Phone className="h-3 w-3 inline text-muted-foreground/70" />
                            {guest.telephone}
                          </p>
                        ) : guest.email ? (
                          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 max-w-[200px] truncate">
                            <Mail className="h-3 w-3 inline text-muted-foreground/70" />
                            {guest.email}
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground/60 italic mt-0.5">Aucune coordonnée</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge
                        variant={cStyle.badgeVariant}
                        className="font-bold text-[9px] uppercase px-1.5 py-0.2 flex items-center gap-1 h-5"
                      >
                        {cStyle.icon}
                        {guest.categorie}
                      </Badge>
                      {guest.nationalite && (
                        <span className="text-[9px] text-muted-foreground/80 font-semibold uppercase tracking-wider">
                          🇲🇦 {guest.nationalite}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detail View */}
        <div className="lg:col-span-7 h-full overflow-hidden flex flex-col">
          {selected ? (
            <GuestDetail
              key={selected.id}
              guest={selected}
              onCategorieChanged={handleGuestUpdated}
            />
          ) : (
            <div className="flex-1 rounded-2xl border border-dashed flex flex-col items-center justify-center p-8 bg-card">
              <Users className="h-12 w-12 text-muted-foreground opacity-30 mb-3 animate-pulse" />
              <h3 className="font-serif text-lg font-bold text-foreground">Aucun client sélectionné</h3>
              <p className="text-xs text-muted-foreground text-center max-w-sm mt-1">
                Choisissez un client dans la liste de gauche pour consulter sa fiche complète, ses séjours passés, ses factures et ses préférences.
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(next) => !next && setCreateOpen(false)}
      >
        <DialogContent className="sm:max-w-[480px]">
          {createOpen && (
            <CreateGuestForm
              onClose={() => setCreateOpen(false)}
              onConfirm={handleCreate}
              submitting={creating}
              error={createError}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface GuestDetailProps {
  guest: Guest;
  onCategorieChanged: (guest: Guest) => void;
}

function GuestDetail({ guest, onCategorieChanged }: GuestDetailProps) {
  const [historique, setHistorique] = useState<GuestStayHistorique[]>([]);
  const [factures, setFactures] = useState<GuestInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [categorie, setCategorie] = useState<CategorieClient>(guest.categorie);
  const [motif, setMotif] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getGuestHistorique(guest.id), getGuestFactures(guest.id)])
      .then(([h, f]) => {
        if (!cancelled) {
          setHistorique(h);
          setFactures(f);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [guest.id]);

  async function handleSaveCategorie(e: FormEvent) {
    e.preventDefault();
    if (!motif.trim()) return;
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await updateGuestCategorie(guest.id, {
        categorie,
        motif: motif.trim(),
      });
      onCategorieChanged(updated);
      setMotif("");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erreur de mise à jour");
    } finally {
      setSaving(false);
    }
  }

  const initials = `${guest.nom.slice(0, 1)}${guest.prenom.slice(0, 1)}`.toUpperCase();
  const cStyle = CATEGORIE_STYLES[guest.categorie] || CATEGORIE_STYLES.STANDARD;

  return (
    <div className="flex-1 overflow-auto rounded-2xl border bg-card p-5.5 shadow-sm flex flex-col gap-5 text-left h-full">
      {/* Top Banner Profile card */}
      <div className={`rounded-xl border p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${cStyle.bg} ${cStyle.border}`}>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-lg font-bold text-primary-foreground shadow-sm">
            {initials}
          </div>
          <div>
            <h2 className="font-serif text-lg font-bold text-foreground flex items-center gap-2">
              {guest.nom} {guest.prenom}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground mt-0.5">
              {guest.nationalite && (
                <span className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground/70" />
                  Nationalité : {guest.nationalite}
                </span>
              )}
              {guest.pieceIdentite && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground/70" />
                  ID : {guest.pieceIdentite}
                </span>
              )}
            </div>
          </div>
        </div>

        <Badge
          variant={cStyle.badgeVariant}
          className="font-bold text-xs uppercase px-2.5 py-0.5 self-start sm:self-auto shadow-xs"
        >
          {CATEGORIE_LABEL[guest.categorie]}
        </Badge>
      </div>

      {/* Guest Coordinates Card */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-3 flex items-center gap-3 bg-background shadow-xs">
          <Phone className="h-4 w-4 text-primary shrink-0" />
          <div className="leading-tight">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Téléphone</span>
            <span className="text-xs font-mono font-semibold">{guest.telephone || "Non renseigné"}</span>
          </div>
        </div>

        <div className="rounded-lg border p-3 flex items-center gap-3 bg-background shadow-xs">
          <Mail className="h-4 w-4 text-primary shrink-0" />
          <div className="leading-tight max-w-[200px] truncate">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Email</span>
            <span className="text-xs font-semibold">{guest.email || "Non renseigné"}</span>
          </div>
        </div>
      </div>

      {/* Preferences Section (Special callout) */}
      <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.02] p-4.5 text-xs">
        <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-400 mb-1.5">
          <Heart className="h-4 w-4" />
          Préférences & Notes Particulières
        </div>
        <p className="text-muted-foreground leading-relaxed">
          {guest.preferences ? guest.preferences : "Aucune note ou préférence de séjour n'a été spécifiée pour ce client. Exemple: chambre calme, étage élevé, oreillers supplémentaires..."}
        </p>
      </div>

      {/* Segment: Change CRM Category */}
      <div className="rounded-xl border p-4 bg-background shadow-xs">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Award className="h-4 w-4 text-primary" />
          Statut & Catégorisation CRM
        </h3>

        <form
          className="flex flex-col sm:flex-row items-end gap-3"
          onSubmit={(e) => void handleSaveCategorie(e)}
        >
          <div className="flex-1 w-full flex flex-col gap-1">
            <Label htmlFor="categorie" className="text-[10px] font-bold text-muted-foreground uppercase">Statut Client</Label>
            <Select
              value={categorie}
              onValueChange={(v) => v && setCategorie(v as CategorieClient)}
              items={CATEGORIES.map((c) => ({
                value: c,
                label: CATEGORIE_LABEL[c],
              }))}
            >
              <SelectTrigger id="categorie" className="w-full h-8.5 bg-background border text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">
                    {CATEGORIE_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 w-full flex flex-col gap-1">
            <Label htmlFor="motif" className="text-[10px] font-bold text-muted-foreground uppercase">Motif de modification</Label>
            <Input
              id="motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex: Client régulier VIP..."
              required
              className="h-8.5 text-xs"
            />
          </div>

          <Button
            type="submit"
            size="sm"
            className="h-8.5 w-full sm:w-auto px-4 font-bold text-xs shrink-0 shadow-xs"
            disabled={saving || !motif.trim() || categorie === guest.categorie}
          >
            {saving ? "Enregistrement..." : "Changer de statut"}
          </Button>
        </form>
        {categorie === "BLACKLIST" && (
          <div className="mt-2.5 rounded-lg border border-rose-500/10 bg-rose-500/[0.02] p-2.5 text-[10px] text-rose-600 dark:text-rose-400 flex items-start gap-1.5 font-medium">
            <ShieldX className="h-4 w-4 shrink-0 mt-0.5" />
            <span>La mise en Liste noire bloque automatiquement toute tentative de création de réservation ou de check-in future pour ce client. Motif requis pour la traçabilité.</span>
          </div>
        )}
        {saveError && <p className="text-destructive text-xs mt-1 font-semibold">{saveError}</p>}
      </div>

      {/* Bottom Tabs: History and Invoices */}
      <div className="grid gap-5 md:grid-cols-2 mt-2">
        {/* Left pane stays list */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
            <History className="h-4 w-4 text-primary" />
            Historique de séjours
          </h3>

          {loading ? (
            <span className="text-muted-foreground text-xs italic py-4">Chargement...</span>
          ) : historique.length === 0 ? (
            <p className="text-muted-foreground text-xs italic py-4">Aucun séjour à ce jour.</p>
          ) : (
            <ul className="flex flex-col gap-2 max-h-[180px] overflow-auto pr-1">
              {historique.map((stay) => {
                const isActive = stay.statut === "EN_COURS";
                return (
                  <li
                    key={stay.id}
                    className="rounded-lg border p-2.5 bg-background hover:border-primary/20 transition-all text-xs flex flex-col gap-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        Chambre {stay.room.numero}
                      </span>
                      <Badge
                        variant={isActive ? "default" : "outline"}
                        className={`text-[9px] font-bold uppercase px-1.5 py-0 h-4 flex items-center ${isActive ? "bg-emerald-500 text-white" : ""}`}
                      >
                        {stay.statut}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Du {new Date(stay.dateCheckin).toLocaleDateString("fr-FR")} au {new Date(stay.dateCheckoutReelle ?? stay.dateCheckoutPrevue).toLocaleDateString("fr-FR")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right pane Invoices list */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
            <CreditCard className="h-4 w-4 text-primary" />
            Facturation & Paiements
          </h3>

          {loading ? (
            <span className="text-muted-foreground text-xs italic py-4">Chargement...</span>
          ) : factures.length === 0 ? (
            <p className="text-muted-foreground text-xs italic py-4">Aucune facture émise.</p>
          ) : (
            <ul className="flex flex-col gap-2 max-h-[180px] overflow-auto pr-1">
              {factures.map((invoice) => {
                const isEmise = invoice.statut === "EMISE";
                return (
                  <li
                    key={invoice.id}
                    className="rounded-lg border p-2.5 bg-background hover:border-primary/20 transition-all text-xs flex flex-col gap-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-foreground max-w-[120px] truncate">
                        {invoice.numero}
                      </span>
                      <Badge
                        className={`text-[9px] font-bold uppercase px-1.5 py-0 h-4 flex items-center ${isEmise ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"}`}
                      >
                        {invoice.statut}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-baseline mt-1 font-semibold">
                      <span className="text-[10px] text-muted-foreground">Total facturé</span>
                      <span className="text-primary font-mono">{invoice.montantTotal} MAD</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

interface CreateGuestFormProps {
  onClose: () => void;
  onConfirm: (input: CreateGuestInput) => void;
  submitting: boolean;
  error: string | null;
}

function CreateGuestForm({
  onClose,
  onConfirm,
  submitting,
  error,
}: CreateGuestFormProps) {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [pieceIdentite, setPieceIdentite] = useState("");
  const [nationalite, setNationalite] = useState("Maroc");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [preferences, setPreferences] = useState("");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-serif text-xl font-bold tracking-tight text-foreground">
          Nouvelle Fiche Client
        </DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-3.5 mt-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nom || !prenom) return;
          onConfirm({
            nom,
            prenom,
            pieceIdentite: pieceIdentite || undefined,
            nationalite: nationalite || undefined,
            telephone: telephone || undefined,
            email: email || undefined,
            preferences: preferences || undefined,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-1 text-left">
            <Label htmlFor="nom" className="text-xs font-semibold text-muted-foreground uppercase">Nom</Label>
            <Input
              id="nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex: El Amrani"
              required
              className="h-9.5 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1 text-left">
            <Label htmlFor="prenom" className="text-xs font-semibold text-muted-foreground uppercase">Prénom</Label>
            <Input
              id="prenom"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              placeholder="Ex: Rachid"
              required
              className="h-9.5 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-1 text-left">
            <Label htmlFor="pieceIdentite" className="text-xs font-semibold text-muted-foreground uppercase">N° Pièce d'identité / Passeport</Label>
            <Input
              id="pieceIdentite"
              value={pieceIdentite}
              onChange={(e) => setPieceIdentite(e.target.value)}
              placeholder="Ex: K584930..."
              className="h-9.5 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1 text-left">
            <Label htmlFor="nationalite" className="text-xs font-semibold text-muted-foreground uppercase">Nationalité</Label>
            <Input
              id="nationalite"
              value={nationalite}
              onChange={(e) => setNationalite(e.target.value)}
              placeholder="Ex: Marocain, Français..."
              className="h-9.5 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-1 text-left">
            <Label htmlFor="telephone" className="text-xs font-semibold text-muted-foreground uppercase">Téléphone</Label>
            <Input
              id="telephone"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="Ex: +212 6..."
              className="h-9.5 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1 text-left">
            <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ex: client@mail.com"
              className="h-9.5 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 text-left">
          <Label htmlFor="preferences" className="text-xs font-semibold text-muted-foreground uppercase">Préférences & Commentaires</Label>
          <Input
            id="preferences"
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            placeholder="Ex: chambre côté calme, lit king-size, étage 3..."
            className="h-9.5 text-xs"
          />
        </div>

        {error && <p className="text-destructive text-xs text-center font-semibold mt-1">{error}</p>}

        <DialogFooter className="gap-2 sm:gap-0 mt-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="h-9.5 text-xs font-semibold"
          >
            Annuler
          </Button>
          <Button type="submit" disabled={submitting || !nom || !prenom} className="h-9.5 text-xs font-bold">
            {submitting ? (
              <>
                <span className="mr-1.5 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Création...
              </>
            ) : (
              "Enregistrer le client"
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
