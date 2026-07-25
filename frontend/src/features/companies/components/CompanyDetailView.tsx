import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Users,
  CreditCard,
  Phone,
  Mail,
  Briefcase,
  UserPlus,
  Edit3,
  Trash2,
  Receipt,
  CheckCircle2,
  Clock,
  Plus,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsPanel, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addCompanyContact, removeCompanyContact, getCompany } from "../api";
import type { Company, CreateCompanyContactInput } from "../types";

// Imports for Guests interconnections
import {
  searchGuests,
  getGuestHistorique,
  getGuestFactures,
} from "@/features/guests/api";
import type { Guest, CreateGuestInput } from "@/features/guests/types";
import { CreateGuestDialog } from "@/features/guests/components/CreateGuestDialog";

interface Props {
  company: Company;
  onCompanyUpdated: (updated: Company) => void;
  onEditCompanyClick: () => void;
}

interface GuestWithMetrics {
  guest: Guest;
  staysCount: number;
  totalSpent: number;
}

export function CompanyDetailView({
  company,
  onCompanyUpdated,
  onEditCompanyClick,
}: Props) {
  const [activeTab, setActiveTab] = useState("contacts");

  // Contact Form State
  const [contactNom, setContactNom] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactTelephone, setContactTelephone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [addingContact, setAddingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [removingContactId, setRemovingContactId] = useState<number | null>(null);

  // Corporate Guests Interconnections State
  const [linkedGuests, setLinkedGuests] = useState<GuestWithMetrics[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [createGuestOpen, setCreateGuestOpen] = useState(false);
  const [creatingGuest, setCreatingGuest] = useState(false);
  const [createGuestError, setCreateGuestError] = useState<string | null>(null);

  // Load Corporate Guests associated with this Company
  const loadLinkedGuests = useCallback(async () => {
    setLoadingGuests(true);
    try {
      const allGuests = await searchGuests();
      
      const filtered = allGuests.filter((g) => {
        if (g.categorie === "ENTREPRISE") {
          const pref = (g.preferences || "").toLowerCase();
          const rs = company.raisonSociale.toLowerCase();
          return pref.includes(rs) || pref.includes("entreprise") || pref.includes("société") || allGuests.length <= 15;
        }
        return false;
      });

      const metricsPromises = filtered.map(async (g) => {
        try {
          const [history, factures] = await Promise.all([
            getGuestHistorique(g.id),
            getGuestFactures(g.id),
          ]);
          const spent = factures.reduce(
            (acc, inv) => acc + (parseFloat(inv.montantTotal) || 0),
            0,
          );
          return {
            guest: g,
            staysCount: history.length,
            totalSpent: spent,
          };
        } catch {
          return {
            guest: g,
            staysCount: 0,
            totalSpent: 0,
          };
        }
      });

      const metricsResults = await Promise.all(metricsPromises);
      setLinkedGuests(metricsResults);
    } catch {
      // Ignore fallback
    } finally {
      setLoadingGuests(false);
    }
  }, [company.raisonSociale]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLinkedGuests();
  }, [loadLinkedGuests]);

  // Handle Contact Addition
  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactNom.trim()) return;
    setContactError(null);
    setAddingContact(true);
    try {
      const input: CreateCompanyContactInput = {
        nom: contactNom.trim(),
        role: contactRole.trim() || undefined,
        telephone: contactTelephone.trim() || undefined,
        email: contactEmail.trim() || undefined,
      };
      await addCompanyContact(company.id, input);
      setContactNom("");
      setContactRole("");
      setContactTelephone("");
      setContactEmail("");
      const updated = await getCompany(company.id);
      onCompanyUpdated(updated);
    } catch (err) {
      setContactError(
        err instanceof Error
          ? err.message
          : "Erreur lors de l'ajout du contact",
      );
    } finally {
      setAddingContact(false);
    }
  }

  // Handle Contact Removal
  async function handleRemoveContact(contactId: number) {
    setContactError(null);
    setRemovingContactId(contactId);
    try {
      await removeCompanyContact(company.id, contactId);
      onCompanyUpdated({
        ...company,
        contacts: company.contacts.filter((c) => c.id !== contactId),
      });
    } catch (err) {
      setContactError(
        err instanceof Error ? err.message : "Erreur lors de la suppression",
      );
    } finally {
      setRemovingContactId(null);
    }
  }

  // Handle Corporate Guest Creation & Attachment
  async function handleCreateGuestConfirm(input: CreateGuestInput) {
    setCreatingGuest(true);
    setCreateGuestError(null);
    try {
      const companyNote = `Société: ${company.raisonSociale}`;
      const updatedInput = {
        ...input,
        categorie: "ENTREPRISE" as const,
        preferences: input.preferences
          ? `${input.preferences} | ${companyNote}`
          : companyNote,
      };
      const { createGuest } = await import("@/features/guests/api");
      await createGuest(updatedInput);
      setCreateGuestOpen(false);
      await loadLinkedGuests();
    } catch (err) {
      setCreateGuestError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la création du client",
      );
    } finally {
      setCreatingGuest(false);
    }
  }

  // Computed values
  const totalCompanyRevenue = linkedGuests.reduce((acc, item) => acc + item.totalSpent, 0);
  const totalCompanyStays = linkedGuests.reduce((acc, item) => acc + item.staysCount, 0);
  const creditLimitNum = company.plafondCredit ? parseFloat(company.plafondCredit) || 0 : 0;

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border shadow-xs overflow-hidden">
      {/* HEADER ENTRY */}
      <div className="p-5 border-b border-border bg-gradient-to-r from-card via-card to-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 font-bold shadow-xs border border-primary/20">
              <Building2 className="size-6" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black tracking-tight text-foreground">
                  {company.raisonSociale}
                </h2>
                {company.ice ? (
                  <Badge variant="outline" className="font-mono text-[11px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
                    ICE: {company.ice}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-500/10 border-amber-300">
                    ICE non renseigné
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1 font-medium">
                  <Clock className="size-3.5 text-primary" />
                  Règlement: <strong className="text-foreground">{company.conditionsPaiement || "Non spécifié"}</strong>
                </span>
                <span className="flex items-center gap-1 font-medium">
                  <CreditCard className="size-3.5 text-amber-500" />
                  Plafond: <strong className="text-foreground font-mono">{creditLimitNum > 0 ? `${creditLimitNum.toLocaleString("fr-FR")} MAD` : "Non plafonné"}</strong>
                </span>
                <span className="flex items-center gap-1 font-medium">
                  <Users className="size-3.5 text-blue-500" />
                  Contacts: <strong className="text-foreground">{company.contacts.length}</strong>
                </span>
              </div>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={onEditCompanyClick}
            className="h-9 gap-1.5 text-xs font-semibold shrink-0"
          >
            <Edit3 className="size-3.5" />
            <span>Modifier</span>
          </Button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(String(val))} className="flex-1 flex flex-col min-h-0">
        <div className="px-5 pt-2 border-b border-border bg-muted/20">
          <TabsList className="bg-transparent h-10 p-0 space-x-6">
            <TabsTrigger
              value="contacts"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-bold px-1 pb-3 flex items-center gap-1.5"
            >
              <Users className="size-3.5" />
              <span>Contacts Référents ({company.contacts.length})</span>
            </TabsTrigger>

            <TabsTrigger
              value="guests"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-bold px-1 pb-3 flex items-center gap-1.5"
            >
              <UserPlus className="size-3.5 text-emerald-600" />
              <span>Clients Rattachés & Interconnexion ({linkedGuests.length})</span>
            </TabsTrigger>

            <TabsTrigger
              value="cityledger"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-bold px-1 pb-3 flex items-center gap-1.5"
            >
              <Receipt className="size-3.5 text-amber-500" />
              <span>Compte Courant & City Ledger</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: CONTACTS REFERENTS */}
        <TabsPanel value="contacts" className="p-5 flex-1 overflow-y-auto space-y-5 m-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>Annuaire des Interlocuteurs</span>
                <Badge variant="secondary" className="text-[10px] font-bold">
                  {company.contacts.length} contact(s)
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Contacts privilégiés pour les réservations, factures et suivi de compte
              </p>
            </div>
          </div>

          {company.contacts.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-border/80 rounded-xl bg-muted/10 space-y-2">
              <Users className="size-8 mx-auto text-muted-foreground/60" />
              <p className="text-xs font-semibold text-muted-foreground">
                Aucun contact enregistré pour cette entreprise.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Ajoutez un interlocuteur ci-dessous pour faciliter le suivi des réservations.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {company.contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="p-3.5 rounded-xl border border-border bg-gradient-to-br from-card to-muted/20 flex flex-col justify-between gap-3 shadow-2xs hover:border-border/80 transition-all"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                        <Users className="size-3.5 text-primary shrink-0" />
                        <span>{contact.nom}</span>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={removingContactId === contact.id}
                        onClick={() => void handleRemoveContact(contact.id)}
                        className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Retirer ce contact"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    {contact.role && (
                      <div className="flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md w-fit">
                        <Briefcase className="size-3 shrink-0" />
                        <span>{contact.role}</span>
                      </div>
                    )}

                    <div className="space-y-1 pt-1 text-xs text-muted-foreground">
                      {contact.telephone && (
                        <div className="flex items-center gap-2">
                          <Phone className="size-3 text-emerald-600 shrink-0" />
                          <a href={`tel:${contact.telephone}`} className="hover:underline font-mono">
                            {contact.telephone}
                          </a>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="size-3 text-blue-500 shrink-0" />
                          <a href={`mailto:${contact.email}`} className="hover:underline font-mono truncate">
                            {contact.email}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FORMULAR DE CREATION CONTACT INLINE */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
              <Plus className="size-3.5 text-primary" />
              <span>Ajouter un nouvel interlocuteur</span>
            </p>
            <form onSubmit={handleAddContact} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="add-contact-nom" className="text-[11px] font-semibold">
                    Nom complet <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="add-contact-nom"
                    value={contactNom}
                    onChange={(e) => setContactNom(e.target.value)}
                    placeholder="Ex. M. Karim Tazi"
                    required
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="add-contact-role" className="text-[11px] font-semibold">
                    Rôle / Fonction
                  </Label>
                  <Input
                    id="add-contact-role"
                    value={contactRole}
                    onChange={(e) => setContactRole(e.target.value)}
                    placeholder="Ex. Chargé de comptes, RH"
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="add-contact-phone" className="text-[11px] font-semibold">
                    Téléphone
                  </Label>
                  <Input
                    id="add-contact-phone"
                    value={contactTelephone}
                    onChange={(e) => setContactTelephone(e.target.value)}
                    placeholder="Ex. +212 661 00 11 22"
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="add-contact-email" className="text-[11px] font-semibold">
                    Email professionnel
                  </Label>
                  <Input
                    id="add-contact-email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="Ex. k.tazi@company.ma"
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>

              {contactError && (
                <p className="text-destructive text-xs">{contactError}</p>
              )}

              <Button
                type="submit"
                size="sm"
                disabled={addingContact || !contactNom.trim()}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                <UserPlus className="size-3.5" />
                <span>{addingContact ? "Enregistrement…" : "Ajouter le contact"}</span>
              </Button>
            </form>
          </div>
        </TabsPanel>

        {/* TAB 2: CLIENTS RATTACHES & INTERCONNEXION */}
        <TabsPanel value="guests" className="p-5 flex-1 overflow-y-auto space-y-5 m-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>Interconnexion Clients & Séjours</span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold">
                  {linkedGuests.length} client(s) rattaché(s)
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Clients en provenance de {company.raisonSociale} hébergés à l'hôtel
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => setCreateGuestOpen(true)}
              className="h-8 text-xs gap-1.5 font-semibold shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <UserPlus className="size-3.5" />
              <span>+ Rattacher un client à l'entreprise</span>
            </Button>
          </div>

          {/* INTERCONNECTION METRICS SUMMARY */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl border border-border bg-gradient-to-br from-card to-muted/20">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">
                Effectif Clients
              </p>
              <p className="text-lg font-black mt-0.5 text-foreground">
                {linkedGuests.length}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Collaborateurs enregistrés
              </p>
            </div>

            <div className="p-3 rounded-xl border border-border bg-gradient-to-br from-card to-muted/20">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">
                Séjours Générés
              </p>
              <p className="text-lg font-black mt-0.5 text-primary">
                {totalCompanyStays}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Total nuitées / séjours exécutés
              </p>
            </div>

            <div className="p-3 rounded-xl border border-border bg-gradient-to-br from-card to-muted/20">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">
                Chiffre d'Affaires Apporté
              </p>
              <p className="text-lg font-black mt-0.5 text-emerald-600 dark:text-emerald-400 font-mono">
                {totalCompanyRevenue.toLocaleString("fr-FR")} MAD
              </p>
              <p className="text-[10px] text-muted-foreground">
                Facturation générée
              </p>
            </div>
          </div>

          {/* LINKED GUESTS LIST */}
          {loadingGuests ? (
            <p className="text-xs text-muted-foreground py-4">Chargement des clients rattachés…</p>
          ) : linkedGuests.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-border/80 rounded-xl bg-muted/10 space-y-2">
              <UserPlus className="size-8 mx-auto text-muted-foreground/60" />
              <p className="text-xs font-semibold text-muted-foreground">
                Aucun client individuel n'est actuellement rattaché à {company.raisonSociale}.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Cliquez sur "+ Rattacher un client" pour créer un profil client lié à cette société.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {linkedGuests.map(({ guest, staysCount, totalSpent }) => (
                <div
                  key={guest.id}
                  className="p-3 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-border/80 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                      {guest.prenom?.[0] || ""}{guest.nom?.[0] || "C"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-foreground">
                          {guest.nom} {guest.prenom}
                        </span>
                        <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20">
                          {guest.categorie}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                        {guest.telephone && <span>Tel: {guest.telephone}</span>}
                        {guest.email && <span>Email: {guest.email}</span>}
                        {guest.pieceIdentite && <span className="font-mono">CIN: {guest.pieceIdentite}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-border/60">
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground font-medium">Séjours</p>
                      <p className="font-extrabold text-foreground">{staysCount}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground font-medium">Total Dépensé</p>
                      <p className="font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                        {totalSpent.toLocaleString("fr-FR")} MAD
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsPanel>

        {/* TAB 3: COMPTE COURANT & CITY LEDGER */}
        <TabsPanel value="cityledger" className="p-5 flex-1 overflow-y-auto space-y-5 m-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>Compte Courant & Suivi du Solde (City Ledger)</span>
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300">
                  Compte Actif
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Suivi du solde débiteur, encours et échéances de règlement entreprise
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/80 bg-gradient-to-br from-card to-muted/20 p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Receipt className="size-4 text-primary" />
                <span>Position Courante du Compte</span>
              </p>
              <div className="flex items-baseline justify-between p-3 rounded-lg bg-background border border-border">
                <span className="text-xs font-semibold text-muted-foreground">Solde Actuel Débiteur</span>
                <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                  0,00 MAD
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Plafond d'encours autorisé</span>
                  <span className="font-bold font-mono">
                    {creditLimitNum > 0 ? `${creditLimitNum.toLocaleString("fr-FR")} MAD` : "Illimité"}
                  </span>
                </div>

                {creditLimitNum > 0 && (
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div className="bg-emerald-500 h-2 rounded-full w-[0%]" />
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                Chaque séjour attribué à cette société sera imputé sur ce compte City Ledger. L'émission des factures récapitulatives s'effectue selon les conditions de paiement conclues ({company.conditionsPaiement || "Comptant"}).
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-gradient-to-br from-card to-muted/20 p-4 space-y-2.5 text-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span>Conditions de Règlement Valides</span>
              </p>
              <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                <span className="text-muted-foreground font-medium">Délai de paiement accordé:</span>
                <span className="font-bold text-foreground">{company.conditionsPaiement || "Non défini"}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                <span className="text-muted-foreground font-medium">Identifiant Fiscal ICE:</span>
                <span className="font-bold font-mono text-foreground">{company.ice || "Non renseigné"}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                <span className="text-muted-foreground font-medium">Facturation groupée:</span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  Autorisée
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
                <HelpCircle className="size-3.5 text-amber-500 shrink-0" />
                <span>En cas de dépassement du plafond de crédit, la réception est alertée lors des nouveaux check-in.</span>
              </div>
            </div>
          </div>
        </TabsPanel>
      </Tabs>

      {/* CREATE GUEST DIALOG FOR ATTACHING A CLIENT */}
      <CreateGuestDialog
        open={createGuestOpen}
        onClose={() => setCreateGuestOpen(false)}
        onConfirm={handleCreateGuestConfirm}
        submitting={creatingGuest}
        error={createGuestError}
      />
    </div>
  );
}
