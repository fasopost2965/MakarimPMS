import { useState } from "react";
import {
  Building2,
  CreditCard,
  UserPlus,
  Phone,
  Mail,
  Briefcase,
  FileText,
  Clock,
} from "lucide-react";
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
import type { CreateCompanyContactInput, CreateCompanyInput } from "../types";

const PAYMENT_PRESETS = [
  "30 jours fin de mois",
  "15 jours net",
  "60 jours",
  "Paiement au comptant",
  "Acompte 50% + Solde à réception",
];

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (
    input: CreateCompanyInput,
    initialContact?: CreateCompanyContactInput,
  ) => Promise<void>;
  submitting: boolean;
  error: string | null;
}

export function CreateCompanyDialog({
  open,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props) {
  const [raisonSociale, setRaisonSociale] = useState("");
  const [ice, setIce] = useState("");
  const [conditionsPaiement, setConditionsPaiement] = useState("");
  const [plafondCredit, setPlafondCredit] = useState("");

  // Initial Contact fields
  const [addContact, setAddContact] = useState(true);
  const [contactNom, setContactNom] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactTelephone, setContactTelephone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!raisonSociale.trim()) return;

    const input: CreateCompanyInput = {
      raisonSociale: raisonSociale.trim(),
      ice: ice.trim() || undefined,
      conditionsPaiement: conditionsPaiement.trim() || undefined,
      plafondCredit: plafondCredit ? parseFloat(plafondCredit) : undefined,
    };

    let initialContact: CreateCompanyContactInput | undefined;
    if (addContact && contactNom.trim()) {
      initialContact = {
        nom: contactNom.trim(),
        role: contactRole.trim() || undefined,
        telephone: contactTelephone.trim() || undefined,
        email: contactEmail.trim() || undefined,
      };
    }

    await onConfirm(input, initialContact);
  }

  function handleReset() {
    setRaisonSociale("");
    setIce("");
    setConditionsPaiement("");
    setPlafondCredit("");
    setAddContact(true);
    setContactNom("");
    setContactRole("");
    setContactTelephone("");
    setContactEmail("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleReset()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-border">
        <DialogHeader className="p-5 pb-3 bg-muted/30 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Building2 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Nouvelle Entreprise (Compte City Ledger)
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Création d'une fiche société avec conditions tarifaires et contact
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* SECTION 1: IDENTIFICATION */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="size-3.5 text-primary" />
              <span>Identification de la Société</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="create-raison-sociale" className="text-xs font-bold">
                  Raison Sociale <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="create-raison-sociale"
                  value={raisonSociale}
                  onChange={(e) => setRaisonSociale(e.target.value)}
                  placeholder="Ex. OCP Group, Royal Air Maroc…"
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="create-ice" className="text-xs font-bold flex items-center gap-1">
                  <span>ICE (Fiscal)</span>
                  <FileText className="size-3 text-muted-foreground" />
                </Label>
                <Input
                  id="create-ice"
                  value={ice}
                  onChange={(e) => setIce(e.target.value)}
                  placeholder="Ex. 00123456789012"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: CONDITIONS FINANCIERES */}
          <div className="space-y-3 pt-2 border-t border-border/60">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="size-3.5 text-amber-500" />
              <span>Conditions de Règlement & Crédit</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="create-conditions" className="text-xs font-bold flex items-center gap-1">
                  <Clock className="size-3 text-muted-foreground" />
                  <span>Conditions de Paiement</span>
                </Label>
                <Input
                  id="create-conditions"
                  value={conditionsPaiement}
                  onChange={(e) => setConditionsPaiement(e.target.value)}
                  placeholder="Ex. 30 jours fin de mois"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="create-plafond" className="text-xs font-bold">
                  Plafond de Crédit (MAD)
                </Label>
                <Input
                  id="create-plafond"
                  type="number"
                  min="0"
                  step="100"
                  value={plafondCredit}
                  onChange={(e) => setPlafondCredit(e.target.value)}
                  placeholder="Ex. 50000"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* PRESETS DE PAIEMENT */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PAYMENT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setConditionsPaiement(preset)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                    conditionsPaiement === preset
                      ? "bg-amber-100 text-amber-900 border-amber-300 font-bold dark:bg-amber-950 dark:text-amber-200"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 3: PREMIER CONTACT */}
          <div className="space-y-3 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <UserPlus className="size-3.5 text-blue-500" />
                <span>Premier Contact Référent</span>
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="add-contact-check"
                  checked={addContact}
                  onChange={(e) => setAddContact(e.target.checked)}
                  className="size-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="add-contact-check" className="text-xs font-normal cursor-pointer">
                  Ajouter un contact initial
                </Label>
              </div>
            </div>

            {addContact && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="contact-nom" className="text-[11px] font-semibold">
                      Nom complet du contact
                    </Label>
                    <Input
                      id="contact-nom"
                      value={contactNom}
                      onChange={(e) => setContactNom(e.target.value)}
                      placeholder="Ex. M. Amine Benjelloun"
                      className="h-8 text-xs bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="contact-role" className="text-[11px] font-semibold flex items-center gap-1">
                      <Briefcase className="size-3 text-muted-foreground" />
                      <span>Rôle / Fonction</span>
                    </Label>
                    <Input
                      id="contact-role"
                      value={contactRole}
                      onChange={(e) => setContactRole(e.target.value)}
                      placeholder="Ex. Responsable RH, Directeur Achats"
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="contact-phone" className="text-[11px] font-semibold flex items-center gap-1">
                      <Phone className="size-3 text-muted-foreground" />
                      <span>Téléphone</span>
                    </Label>
                    <Input
                      id="contact-phone"
                      value={contactTelephone}
                      onChange={(e) => setContactTelephone(e.target.value)}
                      placeholder="Ex. +212 661 12 34 56"
                      className="h-8 text-xs bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="contact-email" className="text-[11px] font-semibold flex items-center gap-1">
                      <Mail className="size-3 text-muted-foreground" />
                      <span>Email professionnel</span>
                    </Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="Ex. a.benjelloun@company.ma"
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {error}
            </div>
          )}

          <DialogFooter className="pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={submitting || !raisonSociale.trim()}>
              {submitting ? "Création en cours…" : "Enregistrer la Société"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
