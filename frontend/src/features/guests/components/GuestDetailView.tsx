import { useEffect, useState } from "react";
import {
  User,
  Phone,
  Mail,
  CreditCard,
  Globe,
  Heart,
  Crown,
  History,
  Receipt,
  Edit,
  Eye,
  EyeOff,
  Copy,
  Check,
  Calendar,
  BedDouble,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getGuestFactures, getGuestHistorique } from "../api";
import type {
  CategorieClient,
  Guest,
  GuestInvoice,
  GuestStayHistorique,
} from "../types";

interface Props {
  guest: Guest;
  onEdit: () => void;
  onChangeCategory: () => void;
}

const CATEGORIE_LABEL: Record<CategorieClient, string> = {
  STANDARD: "Standard",
  VIP: "VIP Privilege",
  ENTREPRISE: "Compte Entreprise",
  AGENCE: "Agence Partenaire",
  BLACKLIST: "Liste Noire (Restreint)",
};

const CATEGORIE_BADGE_CLASS: Record<CategorieClient, string> = {
  STANDARD:
    "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
  VIP: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 font-bold",
  ENTREPRISE:
    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 font-semibold",
  AGENCE:
    "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 font-semibold",
  BLACKLIST:
    "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 font-bold animate-pulse",
};

export function GuestDetailView({ guest, onEdit, onChangeCategory }: Props) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "history" | "invoices" | "prefs"
  >("overview");
  const [historique, setHistorique] = useState<GuestStayHistorique[]>([]);
  const [factures, setFactures] = useState<GuestInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPieceIdentite, setShowPieceIdentite] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  function copyToClipboard(text: string, fieldName: string) {
    void navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  }

  const totalSpent = factures.reduce(
    (acc, inv) => acc + (parseFloat(inv.montantTotal) || 0),
    0,
  );

  const getInitials = (nom: string, prenom: string) => {
    return `${(nom[0] || "").toUpperCase()}${(prenom[0] || "").toUpperCase()}`;
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm h-full overflow-y-auto">
      {/* HEADER CARD */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b">
        <div className="flex items-center gap-3.5">
          {/* AVATAR INITIALS */}
          <div className="size-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center font-extrabold text-xl shadow shrink-0">
            {getInitials(guest.nom, guest.prenom)}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                {guest.nom} {guest.prenom}
              </h2>
              <Badge
                className={`text-xs ${CATEGORIE_BADGE_CLASS[guest.categorie]}`}
              >
                {CATEGORIE_LABEL[guest.categorie]}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 font-mono">
              <span>Client #{guest.id}</span>
              <span>·</span>
              <span>
                Inscrit le{" "}
                {new Date(guest.createdAt).toLocaleDateString("fr-FR")}
              </span>
            </p>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onChangeCategory}
            className="text-xs font-semibold gap-1.5 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300"
          >
            <Crown className="size-3.5" />
            <span>Changer Statut</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onEdit}
            className="text-xs font-bold gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Edit className="size-3.5" />
            <span>Modifier Fiche</span>
          </Button>
        </div>
      </div>

      {/* QUICK STATS STRIP */}
      <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-muted/30 border text-xs">
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Séjours Effectués
          </span>
          <span className="text-base font-extrabold text-foreground font-mono mt-0.5">
            {historique.length}
          </span>
        </div>

        <div className="flex flex-col border-l pl-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Facturation Totale
          </span>
          <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
            {totalSpent.toLocaleString("fr-FR")} MAD
          </span>
        </div>

        <div className="flex flex-col border-l pl-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Nationalité
          </span>
          <span className="text-xs font-bold text-foreground mt-1 truncate">
            {guest.nationalite || "Non renseignée"}
          </span>
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex items-center border-b gap-1 text-xs pt-1">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`pb-2 px-3 font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="size-3.5" />
          <span>Coordonnées</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`pb-2 px-3 font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="size-3.5" />
          <span>Historique Séjours ({historique.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("invoices")}
          className={`pb-2 px-3 font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === "invoices"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Receipt className="size-3.5" />
          <span>Factures ({factures.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("prefs")}
          className={`pb-2 px-3 font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === "prefs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart className="size-3.5 text-rose-500" />
          <span>Préférences</span>
        </button>
      </div>

      {/* TAB CONTENT AREA */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-xs">
          Chargement des informations du profil…
        </div>
      ) : activeTab === "overview" ? (
        /* OVERVIEW & CONTACT TAB */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
          {/* TELEPHONE */}
          <div className="p-3.5 rounded-xl border bg-background flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
              <Phone className="size-3 text-amber-600" />
              <span>Téléphone</span>
            </span>
            {guest.telephone ? (
              <div className="flex items-center justify-between gap-2 mt-1">
                <a
                  href={`tel:${guest.telephone}`}
                  className="font-mono font-bold text-sm text-foreground hover:underline hover:text-amber-600"
                >
                  {guest.telephone}
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(guest.telephone!, "phone")}
                  className="h-7 text-[10px] gap-1"
                >
                  {copiedField === "phone" ? (
                    <Check className="size-3 text-emerald-600" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  <span>Copier</span>
                </Button>
              </div>
            ) : (
              <span className="text-muted-foreground italic mt-1">
                Non renseigné
              </span>
            )}
          </div>

          {/* EMAIL */}
          <div className="p-3.5 rounded-xl border bg-background flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
              <Mail className="size-3 text-purple-600" />
              <span>Adresse Email</span>
            </span>
            {guest.email ? (
              <div className="flex items-center justify-between gap-2 mt-1">
                <a
                  href={`mailto:${guest.email}`}
                  className="font-mono font-bold text-xs text-foreground hover:underline hover:text-purple-600 truncate"
                >
                  {guest.email}
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(guest.email!, "email")}
                  className="h-7 text-[10px] gap-1 shrink-0"
                >
                  {copiedField === "email" ? (
                    <Check className="size-3 text-emerald-600" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  <span>Copier</span>
                </Button>
              </div>
            ) : (
              <span className="text-muted-foreground italic mt-1">
                Non renseigné
              </span>
            )}
          </div>

          {/* PIECE D'IDENTITE */}
          <div className="p-3.5 rounded-xl border bg-background flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
              <CreditCard className="size-3 text-blue-600" />
              <span>Pièce d'Identité (Sécurisée)</span>
            </span>
            {guest.pieceIdentite ? (
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="font-mono font-bold text-xs text-foreground">
                  {showPieceIdentite
                    ? guest.pieceIdentite
                    : guest.pieceIdentite.replace(/.(?=.{2})/g, "•")}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPieceIdentite(!showPieceIdentite)}
                  className="h-7 text-[10px] gap-1"
                >
                  {showPieceIdentite ? (
                    <EyeOff className="size-3" />
                  ) : (
                    <Eye className="size-3" />
                  )}
                  <span>{showPieceIdentite ? "Masquer" : "Révéler"}</span>
                </Button>
              </div>
            ) : (
              <span className="text-muted-foreground italic mt-1">
                Non renseignée
              </span>
            )}
          </div>

          {/* NATIONALITE */}
          <div className="p-3.5 rounded-xl border bg-background flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
              <Globe className="size-3 text-emerald-600" />
              <span>Nationalité / Origine</span>
            </span>
            <span className="font-bold text-xs text-foreground mt-1">
              {guest.nationalite || "Non spécifiée"}
            </span>
          </div>
        </div>
      ) : activeTab === "history" ? (
        /* STAY HISTORY TAB */
        <div className="flex flex-col gap-2 pt-1">
          {historique.length === 0 ? (
            <div className="py-12 border rounded-xl bg-background text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
              <Calendar className="size-8 text-muted-foreground/60" />
              <p className="font-bold text-foreground">
                Aucun séjour enregistré pour ce client
              </p>
              <p className="text-[11px]">
                Les prochains séjours et check-ins apparaîtront automatiquement
                ici.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {historique.map((stay) => (
                <div
                  key={stay.id}
                  className="p-3.5 rounded-xl border bg-background flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold font-mono">
                      #{stay.room.numero}
                    </div>

                    <div className="flex flex-col">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <BedDouble className="size-3.5 text-primary" />
                        <span>
                          Chambre #{stay.room.numero} ({stay.room.roomType.nom})
                        </span>
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        Du{" "}
                        {new Date(stay.dateCheckin).toLocaleDateString("fr-FR")}{" "}
                        au{" "}
                        {new Date(
                          stay.dateCheckoutReelle || stay.dateCheckoutPrevue,
                        ).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant={
                      stay.statut === "EN_COURS" ? "default" : "secondary"
                    }
                    className="text-[10px] font-bold"
                  >
                    {stay.statut === "EN_COURS"
                      ? "Séjour En Cours"
                      : "Checkout Effectué"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === "invoices" ? (
        /* INVOICES TAB */
        <div className="flex flex-col gap-2 pt-1">
          {factures.length === 0 ? (
            <div className="py-12 border rounded-xl bg-background text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
              <Receipt className="size-8 text-muted-foreground/60" />
              <p className="font-bold text-foreground">
                Aucune facture émise pour ce client
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {factures.map((inv) => (
                <div
                  key={inv.id}
                  className="p-3.5 rounded-xl border bg-background flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
                      <Receipt className="size-4" />
                    </div>

                    <div className="flex flex-col">
                      <span className="font-bold text-foreground font-mono">
                        Facture {inv.numero}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        Émise le{" "}
                        {new Date(inv.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-sm text-foreground font-mono">
                      {(parseFloat(inv.montantTotal) || 0).toLocaleString(
                        "fr-FR",
                      )}{" "}
                      MAD
                    </span>
                    <Badge
                      variant={
                        inv.statut === "EMISE" ? "default" : "destructive"
                      }
                      className="text-[10px] font-bold"
                    >
                      {inv.statut === "EMISE" ? "Émise" : "Annulée"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* PREFERENCES TAB */
        <div className="p-4 rounded-xl border bg-background flex flex-col gap-3 text-xs">
          <span className="font-bold text-foreground flex items-center gap-1.5 text-sm">
            <Heart className="size-4 text-rose-500" />
            <span>Remarques, Préférences & Habitudes de Séjour</span>
          </span>

          {guest.preferences ? (
            <div className="p-3 rounded-lg bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 text-foreground leading-relaxed">
              {guest.preferences}
            </div>
          ) : (
            <p className="text-muted-foreground italic">
              Aucune préférence enregistrée pour le moment. Cliquez sur
              "Modifier Fiche" pour en ajouter.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
