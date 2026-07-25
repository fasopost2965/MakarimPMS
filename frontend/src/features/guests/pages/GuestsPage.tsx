import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Crown,
  Building,
  ShieldAlert,
  Phone,
  Mail,
  CreditCard,
  LayoutGrid,
  List,
  Columns,
  Edit,
  UserCheck,
  Copy,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createGuest,
  searchGuests,
  updateGuest,
  updateGuestCategorie,
} from "../api";
import { CreateGuestDialog } from "../components/CreateGuestDialog";
import { EditGuestDialog } from "../components/EditGuestDialog";
import { ChangeCategoryDialog } from "../components/ChangeCategoryDialog";
import { GuestDetailView } from "../components/GuestDetailView";
import type {
  CategorieClient,
  CreateGuestInput,
  Guest,
  UpdateGuestCategorieInput,
  UpdateGuestInput,
} from "../types";

const CATEGORIE_LABEL: Record<CategorieClient, string> = {
  STANDARD: "Standard",
  VIP: "VIP",
  ENTREPRISE: "Entreprise",
  AGENCE: "Agence",
  BLACKLIST: "Liste noire",
};

const CATEGORIE_BADGE_CLASS: Record<CategorieClient, string> = {
  STANDARD:
    "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
  VIP:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 font-bold",
  ENTREPRISE:
    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 font-semibold",
  AGENCE:
    "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 font-semibold",
  BLACKLIST:
    "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 font-bold animate-pulse",
};

export function GuestsPage() {
  const [query, setQuery] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selected Guest & Modals
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filters & Views
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [contactFilter, setContactFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"split" | "grid" | "table">("split");

  const [copiedId, setCopiedId] = useState<number | null>(null);

  const refetch = useCallback(async (q: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await searchGuests(q || undefined);
      setGuests(data);
      // Auto select first guest if none selected or if previously selected is no longer in list
      if (data.length > 0) {
        setSelectedGuest((prev) => {
          if (!prev) return data[0];
          const found = data.find((g) => g.id === prev.id);
          return found || data[0];
        });
      } else {
        setSelectedGuest(null);
      }
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

  // Handle Create Guest
  async function handleCreate(input: CreateGuestInput) {
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await createGuest(input);
      setCreateDialogOpen(false);
      setSelectedGuest(created);
      await refetch(query);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Erreur lors de la création",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Edit Guest
  async function handleUpdate(id: number, input: UpdateGuestInput) {
    setFormError(null);
    setSubmitting(true);
    try {
      const updated = await updateGuest(id, input);
      setEditDialogOpen(false);
      setSelectedGuest(updated);
      await refetch(query);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Erreur lors de la modification",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Change Category
  async function handleChangeCategory(id: number, input: UpdateGuestCategorieInput) {
    setFormError(null);
    setSubmitting(true);
    try {
      const updated = await updateGuestCategorie(id, input);
      setCategoryDialogOpen(false);
      setSelectedGuest(updated);
      await refetch(query);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Erreur lors du changement de catégorie",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // KPIs
  const kpis = useMemo(() => {
    const total = guests.length;
    const vips = guests.filter((g) => g.categorie === "VIP").length;
    const entreprises = guests.filter(
      (g) => g.categorie === "ENTREPRISE" || g.categorie === "AGENCE",
    ).length;
    const blacklisted = guests.filter((g) => g.categorie === "BLACKLIST").length;
    const withPhone = guests.filter((g) => Boolean(g.telephone)).length;

    return { total, vips, entreprises, blacklisted, withPhone };
  }, [guests]);

  // Filtered Guests
  const filteredGuests = useMemo(() => {
    return guests.filter((g) => {
      // Category filter
      const matchCategory =
        categoryFilter === "ALL" || g.categorie === categoryFilter;

      // Contact filter
      const matchContact =
        contactFilter === "ALL" ||
        (contactFilter === "PHONE" && Boolean(g.telephone)) ||
        (contactFilter === "EMAIL" && Boolean(g.email)) ||
        (contactFilter === "CIN" && Boolean(g.pieceIdentite));

      return matchCategory && matchContact;
    });
  }, [guests, categoryFilter, contactFilter]);

  const copyContact = (guest: Guest) => {
    const text = `${guest.nom} ${guest.prenom} - Tél: ${guest.telephone || 'N/A'} - Email: ${guest.email || 'N/A'}`;
    void navigator.clipboard.writeText(text);
    setCopiedId(guest.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex h-full flex-col gap-5 p-6 bg-muted/10 overflow-y-auto">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Users className="size-6 text-amber-600 dark:text-amber-400" />
              <span>Gestion des Clients & Fichiers CRM</span>
            </h1>
            <Badge
              variant="outline"
              className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200"
            >
              Hôtel Makarim
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Fiches d'identité, suivi des catégories, préférences VIP, séjours et traçabilité d'audit
          </p>
        </div>

        {/* HEADER ACTIONS */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch(query)}
            disabled={loading}
            className="gap-1.5 text-xs font-semibold"
          >
            <RefreshCw
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span>Actualiser</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              setFormError(null);
              setCreateDialogOpen(true);
            }}
            className="gap-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow"
          >
            <Plus className="size-4" />
            <span>Nouveau Client</span>
          </Button>
        </div>
      </div>

      {/* ERROR ALERTS */}
      {loadError && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs font-medium">
          {loadError}
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* TOTAL CLIENTS */}
        <button
          type="button"
          onClick={() => setCategoryFilter("ALL")}
          className={`p-3.5 rounded-xl border text-left transition-all bg-card hover:border-primary/50 ${
            categoryFilter === "ALL" ? "ring-2 ring-primary border-primary" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total Clients
            </span>
            <Users className="size-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-extrabold text-foreground mt-1 font-mono">
            {kpis.total}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Base CRM
          </p>
        </button>

        {/* VIPS */}
        <button
          type="button"
          onClick={() => setCategoryFilter("VIP")}
          className={`p-3.5 rounded-xl border text-left transition-all bg-card hover:border-amber-500/50 ${
            categoryFilter === "VIP"
              ? "ring-2 ring-amber-500 border-amber-500 bg-amber-50/20"
              : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Clients VIP
            </span>
            <Crown className="size-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 font-mono">
            {kpis.vips}
          </p>
          <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5 font-medium">
            Traitements privilégiés
          </p>
        </button>

        {/* ENTREPRISES & AGENCE */}
        <button
          type="button"
          onClick={() => setCategoryFilter("ENTREPRISE")}
          className={`p-3.5 rounded-xl border text-left transition-all bg-card hover:border-blue-500/50 ${
            categoryFilter === "ENTREPRISE"
              ? "ring-2 ring-blue-500 border-blue-500 bg-blue-50/20"
              : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Entreprises / Agences
            </span>
            <Building className="size-4 text-blue-500" />
          </div>
          <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1 font-mono">
            {kpis.entreprises}
          </p>
          <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-0.5 font-medium">
            Comptes professionnels
          </p>
        </button>

        {/* BLACKLIST */}
        <button
          type="button"
          onClick={() => setCategoryFilter("BLACKLIST")}
          className={`p-3.5 rounded-xl border text-left transition-all bg-card hover:border-rose-500/50 ${
            categoryFilter === "BLACKLIST"
              ? "ring-2 ring-rose-500 border-rose-500 bg-rose-50/20"
              : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Liste Noire
            </span>
            <ShieldAlert className="size-4 text-rose-500 animate-pulse" />
          </div>
          <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 font-mono">
            {kpis.blacklisted}
          </p>
          <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5 font-medium">
            Accès restreints
          </p>
        </button>

        {/* CLIENTS AVEC PHONE */}
        <div className="p-3.5 rounded-xl border text-left bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Coordonnées Tél.
            </span>
            <Phone className="size-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {kpis.withPhone}
          </p>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 font-medium">
            Joignables directement
          </p>
        </div>
      </div>

      {/* FILTER & CONTROL BAR */}
      <div className="rounded-xl border bg-card p-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* LEFT SEARCH & SELECTS */}
        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          {/* SEARCH INPUT */}
          <div className="relative min-w-[240px] flex-1 md:flex-initial">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Rechercher nom, prénom, tél, CIN/Passeport…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          {/* CATEGORY FILTER */}
          <Select
            value={categoryFilter}
            onValueChange={(val) => val && setCategoryFilter(val)}
            items={[
              { value: "ALL", label: "Toutes les catégories" },
              { value: "STANDARD", label: "Standard" },
              { value: "VIP", label: "VIP" },
              { value: "ENTREPRISE", label: "Entreprise" },
              { value: "AGENCE", label: "Agence" },
              { value: "BLACKLIST", label: "Liste Noire" },
            ]}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes les catégories</SelectItem>
              <SelectItem value="STANDARD">Standard</SelectItem>
              <SelectItem value="VIP">VIP</SelectItem>
              <SelectItem value="ENTREPRISE">Entreprise</SelectItem>
              <SelectItem value="AGENCE">Agence</SelectItem>
              <SelectItem value="BLACKLIST">Liste Noire</SelectItem>
            </SelectContent>
          </Select>

          {/* CONTACT FILTER */}
          <Select
            value={contactFilter}
            onValueChange={(val) => val && setContactFilter(val)}
            items={[
              { value: "ALL", label: "Tous contacts" },
              { value: "PHONE", label: "Avec téléphone" },
              { value: "EMAIL", label: "Avec email" },
              { value: "CIN", label: "Avec Pièce Identité" },
            ]}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Contact" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous contacts</SelectItem>
              <SelectItem value="PHONE">Avec téléphone</SelectItem>
              <SelectItem value="EMAIL">Avec email</SelectItem>
              <SelectItem value="CIN">Avec Pièce Identité</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* RIGHT VIEW SWITCHER */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <span className="text-muted-foreground text-[11px] font-medium hidden sm:inline">
            Affichage :
          </span>
          <div className="flex items-center border rounded-lg p-0.5 bg-muted/40">
            <Button
              type="button"
              variant={viewMode === "split" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("split")}
              className="h-7 px-2.5 text-[11px] gap-1"
            >
              <Columns className="size-3.5" />
              <span>Split CRM</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-7 px-2.5 text-[11px] gap-1"
            >
              <LayoutGrid className="size-3.5" />
              <span className="hidden sm:inline">Grille</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="h-7 px-2.5 text-[11px] gap-1"
            >
              <List className="size-3.5" />
              <span className="hidden sm:inline">Tableau</span>
            </Button>
          </div>
        </div>
      </div>

      {/* CONTENT LAYOUT */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
          <RefreshCw className="size-8 animate-spin text-primary" />
          <span>Recherche des fiches clients…</span>
        </div>
      ) : filteredGuests.length === 0 ? (
        <div className="py-16 border rounded-xl bg-card text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
          <Users className="size-10 text-muted-foreground/60" />
          <p className="font-bold text-foreground text-sm">
            Aucun client ne correspond à votre recherche
          </p>
          <p className="text-muted-foreground">
            Ajustez votre recherche ou enregistrez un nouveau client.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setQuery("");
              setCategoryFilter("ALL");
              setContactFilter("ALL");
            }}
            className="mt-2 text-xs"
          >
            Effacer la recherche
          </Button>
        </div>
      ) : viewMode === "split" ? (
        /* SPLIT VIEW (MASTER DETAIL) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-start min-h-[500px]">
          {/* LEFT MASTER LIST */}
          <div className="lg:col-span-5 flex flex-col gap-2 max-h-[680px] overflow-y-auto pr-1">
            {filteredGuests.map((guest) => {
              const isSelected = selectedGuest?.id === guest.id;

              return (
                <button
                  key={guest.id}
                  type="button"
                  onClick={() => setSelectedGuest(guest)}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col gap-2 ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/40 shadow-sm"
                      : "bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-sm text-foreground">
                      {guest.nom} {guest.prenom}
                    </span>
                    <Badge
                      className={`text-[9px] ${
                        CATEGORIE_BADGE_CLASS[guest.categorie]
                      }`}
                    >
                      {CATEGORIE_LABEL[guest.categorie]}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1 border-t">
                    <div className="flex items-center gap-2 font-mono">
                      {guest.telephone ? (
                        <span className="flex items-center gap-1 text-foreground">
                          <Phone className="size-3 text-amber-600" />
                          <span>{guest.telephone}</span>
                        </span>
                      ) : (
                        <span className="italic">Pas de téléphone</span>
                      )}
                    </div>

                    <span className="font-mono text-[10px]">
                      #{guest.id}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* RIGHT DETAIL PANEL */}
          <div className="lg:col-span-7 h-full">
            {selectedGuest ? (
              <GuestDetailView
                key={selectedGuest.id}
                guest={selectedGuest}
                onEdit={() => {
                  setFormError(null);
                  setEditDialogOpen(true);
                }}
                onChangeCategory={() => {
                  setFormError(null);
                  setCategoryDialogOpen(true);
                }}
              />
            ) : (
              <div className="p-8 border rounded-2xl bg-card text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-2 h-full">
                <Users className="size-8 text-muted-foreground/50" />
                <span>Sélectionnez un client dans la liste pour voir sa fiche détaillée</span>
              </div>
            )}
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID CARDS VIEW */
        <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGuests.map((guest) => {
            return (
              <div
                key={guest.id}
                className="bg-card rounded-xl border p-4 transition-all flex flex-col justify-between gap-3 shadow-sm hover:shadow-md"
              >
                {/* CARD HEADER */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <h3 className="font-extrabold text-sm text-foreground">
                      {guest.nom} {guest.prenom}
                    </h3>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Fiche Client #{guest.id}
                    </span>
                  </div>

                  <Badge
                    className={`text-[9px] ${
                      CATEGORIE_BADGE_CLASS[guest.categorie]
                    }`}
                  >
                    {CATEGORIE_LABEL[guest.categorie]}
                  </Badge>
                </div>

                {/* CONTACT DETAILS */}
                <div className="flex flex-col gap-1.5 pt-2 border-t text-xs">
                  <div className="flex items-center gap-2">
                    <Phone className="size-3.5 text-amber-600 shrink-0" />
                    <span className="font-mono text-foreground font-medium truncate">
                      {guest.telephone || "Téléphone non renseigné"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Mail className="size-3.5 text-purple-600 shrink-0" />
                    <span className="font-mono text-foreground truncate">
                      {guest.email || "Email non renseigné"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <CreditCard className="size-3.5 text-blue-600 shrink-0" />
                    <span className="font-mono text-muted-foreground truncate">
                      {guest.pieceIdentite
                        ? `CIN/Passeport : ${guest.pieceIdentite}`
                        : "Pièce identité non enregistrée"}
                    </span>
                  </div>
                </div>

                {/* CARD ACTIONS */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t text-xs">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyContact(guest)}
                    className="h-7 text-[10px] gap-1 px-2"
                  >
                    {copiedId === guest.id ? (
                      <Check className="size-3 text-emerald-600" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    <span>{copiedId === guest.id ? "Copié !" : "Copier"}</span>
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedGuest(guest);
                        setFormError(null);
                        setEditDialogOpen(true);
                      }}
                      className="h-7 text-[10px] gap-1"
                    >
                      <Edit className="size-3" />
                      <span>Éditer</span>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setSelectedGuest(guest);
                        setViewMode("split");
                      }}
                      className="h-7 text-[10px] gap-1 font-bold bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <UserCheck className="size-3" />
                      <span>Ouvrir Fiche</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Nom & Prénom</th>
                  <th className="p-3">Catégorie</th>
                  <th className="p-3">Téléphone</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Nationalité</th>
                  <th className="p-3">Pièce Identité</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredGuests.map((guest) => {
                  return (
                    <tr
                      key={guest.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3 font-mono font-bold text-foreground">
                        #{guest.id}
                      </td>
                      <td className="p-3 font-extrabold text-foreground">
                        {guest.nom} {guest.prenom}
                      </td>
                      <td className="p-3">
                        <Badge
                          className={`text-[10px] ${
                            CATEGORIE_BADGE_CLASS[guest.categorie]
                          }`}
                        >
                          {CATEGORIE_LABEL[guest.categorie]}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-foreground font-medium">
                        {guest.telephone || "—"}
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {guest.email || "—"}
                      </td>
                      <td className="p-3 text-foreground font-medium">
                        {guest.nationalite || "—"}
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {guest.pieceIdentite || "—"}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedGuest(guest);
                              setFormError(null);
                              setEditDialogOpen(true);
                            }}
                            className="h-7 text-[11px] gap-1"
                          >
                            <Edit className="size-3" />
                            <span>Éditer</span>
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setSelectedGuest(guest);
                              setViewMode("split");
                            }}
                            className="h-7 text-[11px] font-bold gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                          >
                            <UserCheck className="size-3" />
                            <span>Fiche</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE GUEST DIALOG */}
      <CreateGuestDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onConfirm={handleCreate}
        submitting={submitting}
        error={formError}
      />

      {/* EDIT GUEST DIALOG */}
      <EditGuestDialog
        open={editDialogOpen}
        guest={selectedGuest}
        onClose={() => setEditDialogOpen(false)}
        onConfirm={handleUpdate}
        submitting={submitting}
        error={formError}
      />

      {/* CHANGE CATEGORY DIALOG */}
      <ChangeCategoryDialog
        open={categoryDialogOpen}
        guest={selectedGuest}
        onClose={() => setCategoryDialogOpen(false)}
        onConfirm={handleChangeCategory}
        submitting={submitting}
        error={formError}
      />
    </div>
  );
}
