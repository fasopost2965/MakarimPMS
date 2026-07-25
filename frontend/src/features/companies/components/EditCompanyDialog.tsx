import { useEffect, useState } from "react";
import { CreditCard, Clock, FileText, Edit3 } from "lucide-react";
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
import type { Company, UpdateCompanyInput } from "../types";

const PAYMENT_PRESETS = [
  "30 jours fin de mois",
  "15 jours net",
  "60 jours",
  "Paiement au comptant",
  "Acompte 50% + Solde à réception",
];

interface Props {
  open: boolean;
  company: Company | null;
  onClose: () => void;
  onConfirm: (id: number, input: UpdateCompanyInput) => Promise<void>;
  submitting: boolean;
  error: string | null;
}

export function EditCompanyDialog({
  open,
  company,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props) {
  const [raisonSociale, setRaisonSociale] = useState("");
  const [ice, setIce] = useState("");
  const [conditionsPaiement, setConditionsPaiement] = useState("");
  const [plafondCredit, setPlafondCredit] = useState("");

  useEffect(() => {
    if (company) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRaisonSociale(company.raisonSociale || "");

      setIce(company.ice || "");

      setConditionsPaiement(company.conditionsPaiement || "");

      setPlafondCredit(
        company.plafondCredit ? String(company.plafondCredit) : "",
      );
    }
  }, [company]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company || !raisonSociale.trim()) return;

    await onConfirm(company.id, {
      raisonSociale: raisonSociale.trim(),
      ice: ice.trim() || undefined,
      conditionsPaiement: conditionsPaiement.trim() || undefined,
      plafondCredit: plafondCredit ? parseFloat(plafondCredit) : undefined,
    });
  }

  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-border">
        <DialogHeader className="p-5 pb-3 bg-muted/30 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Edit3 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Modifier l'entreprise #{company.id}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mise à jour des informations légales et financières
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label
                htmlFor="edit-raison-sociale"
                className="text-xs font-bold"
              >
                Raison Sociale <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-raison-sociale"
                value={raisonSociale}
                onChange={(e) => setRaisonSociale(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label
                htmlFor="edit-ice"
                className="text-xs font-bold flex items-center gap-1"
              >
                <FileText className="size-3 text-muted-foreground" />
                <span>ICE (Identifiant Commun de l'Entreprise)</span>
              </Label>
              <Input
                id="edit-ice"
                value={ice}
                onChange={(e) => setIce(e.target.value)}
                placeholder="Ex. 00123456789012"
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label
                htmlFor="edit-conditions"
                className="text-xs font-bold flex items-center gap-1"
              >
                <Clock className="size-3 text-muted-foreground" />
                <span>Conditions de Paiement</span>
              </Label>
              <Input
                id="edit-conditions"
                value={conditionsPaiement}
                onChange={(e) => setConditionsPaiement(e.target.value)}
                placeholder="Ex. 30 jours fin de mois"
                className="h-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-0.5">
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

            <div className="space-y-1">
              <Label
                htmlFor="edit-plafond"
                className="text-xs font-bold flex items-center gap-1"
              >
                <CreditCard className="size-3 text-muted-foreground" />
                <span>Plafond de Crédit Autorisé (MAD)</span>
              </Label>
              <Input
                id="edit-plafond"
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
              onClick={onClose}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !raisonSociale.trim()}
            >
              {submitting ? "Enregistrement…" : "Enregistrer les modifications"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
