import { useEffect, useState } from "react";
import {
  ShieldAlert,
  Crown,
  Building,
  Briefcase,
  UserCheck,
  AlertTriangle,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type {
  CategorieClient,
  Guest,
  UpdateGuestCategorieInput,
} from "../types";

interface Props {
  open: boolean;
  guest: Guest | null;
  onClose: () => void;
  onConfirm: (id: number, input: UpdateGuestCategorieInput) => Promise<void>;
  submitting: boolean;
  error: string | null;
}

const CATEGORIES_CONFIG: {
  value: CategorieClient;
  label: string;
  description: string;
  icon: React.ReactNode;
  badgeClass: string;
}[] = [
  {
    value: "STANDARD",
    label: "Standard",
    description: "Client particulier sans statut particulier.",
    icon: <UserCheck className="size-4 text-slate-600" />,
    badgeClass:
      "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
  },
  {
    value: "VIP",
    label: "VIP",
    description:
      "Client privilégié bénéficiant d'un traitement spécial et attentions.",
    icon: <Crown className="size-4 text-amber-500" />,
    badgeClass:
      "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 font-bold",
  },
  {
    value: "ENTREPRISE",
    label: "Entreprise",
    description:
      "Client lié à un compte professionnel ou contrat cadre d'entreprise.",
    icon: <Building className="size-4 text-blue-600" />,
    badgeClass:
      "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 font-semibold",
  },
  {
    value: "AGENCE",
    label: "Agence / Partner",
    description:
      "Client apporté par une agence de voyage ou partenaire de réservation.",
    icon: <Briefcase className="size-4 text-purple-600" />,
    badgeClass:
      "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 font-semibold",
  },
  {
    value: "BLACKLIST",
    label: "Liste Noire (Blacklist)",
    description:
      "Incapacité de réserver ou faire un check-in (Interdiction stricte).",
    icon: <ShieldAlert className="size-4 text-rose-600" />,
    badgeClass:
      "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 font-bold",
  },
];

export function ChangeCategoryDialog({
  open,
  guest,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props) {
  const [categorie, setCategorie] = useState<CategorieClient>("STANDARD");
  const [motif, setMotif] = useState("");

  useEffect(() => {
    if (guest) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategorie(guest.categorie);
      setMotif("");
    }
  }, [guest]);

  if (!guest) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guest || !motif.trim()) return;

    void onConfirm(guest.id, {
      categorie,
      motif: motif.trim(),
    });
  }

  const isBlacklistTarget = categorie === "BLACKLIST";
  const isCurrentlyBlacklisted = guest.categorie === "BLACKLIST";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg max-w-[calc(100%-1rem)] max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Crown className="size-5 text-amber-600 dark:text-amber-400" />
            <span>Changer la Catégorie Client</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Client :{" "}
            <span className="font-bold text-foreground">
              {guest.nom} {guest.prenom}
            </span>{" "}
            (Statut actuel :{" "}
            <Badge variant="outline" className="text-[10px]">
              {guest.categorie}
            </Badge>
            )
          </p>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 text-xs mt-2"
        >
          {/* CATEGORY SELECTION CARDS */}
          <div className="flex flex-col gap-2">
            <Label className="font-bold text-xs">
              Choisissez la nouvelle catégorie :
            </Label>
            <div className="flex flex-col gap-2">
              {CATEGORIES_CONFIG.map((cat) => {
                const isSelected = categorie === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategorie(cat.value)}
                    className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/40 shadow-sm"
                        : "bg-card hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">{cat.icon}</div>
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-foreground flex items-center gap-2">
                          {cat.label}
                          <Badge className={`text-[9px] ${cat.badgeClass}`}>
                            {cat.value}
                          </Badge>
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          {cat.description}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MOTIF DE CHANGEMENT (MANDATORY AUDIT TRAIL) */}
          <div className="flex flex-col gap-1.5 border-t pt-3">
            <Label
              htmlFor="category-motif"
              className="font-bold text-xs flex items-center gap-1.5"
            >
              <FileText className="size-3.5 text-primary" />
              <span>
                Motif Obligatoire (Traçabilité & Audit Log){" "}
                <span className="text-rose-500">*</span>
              </span>
            </Label>
            <Input
              id="category-motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex. Client fidèle 10e séjour (VIP), ou Impayé récurrent (Liste Noire)…"
              className="bg-background h-9 text-xs"
              required
            />
            <p className="text-[10px] text-muted-foreground">
              Chaque modification de catégorie est systématiquement enregistrée
              dans le registre d'audit du système.
            </p>
          </div>

          {/* BLACKLIST WARNING ALERT */}
          {(isBlacklistTarget || isCurrentlyBlacklisted) && (
            <div className="p-3 rounded-xl border border-rose-300 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 text-xs flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300">
                <AlertTriangle className="size-4 shrink-0 text-rose-600" />
                <span>
                  {isBlacklistTarget
                    ? "Avertissement : Passage en Liste Noire"
                    : "Information : Retrait de la Liste Noire"}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {isBlacklistTarget
                  ? "Inscrire ce client en liste noire bloquera immédiatement toute création de réservation ou check-in ultérieur pour cette personne."
                  : "Retirer ce client de la liste noire rétablira son droit d'effectuer des réservations et check-ins à l'hôtel Makarim."}
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          {/* FOOTER */}
          <DialogFooter className="pt-3 border-t flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="text-xs"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={
                submitting || !motif.trim() || categorie === guest.categorie
              }
              className={`text-xs font-bold gap-2 text-white ${
                isBlacklistTarget
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {submitting ? "Mise à jour…" : "Valider le changement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
