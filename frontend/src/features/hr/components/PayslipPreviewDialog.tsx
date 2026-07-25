import {
  Printer,
  FileCheck,
  Building,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Employee, PaySlip } from "../types";

interface PayslipPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  slip: PaySlip | null;
  employee: Employee | null;
  onValidate?: (id: number) => Promise<void>;
}

export function PayslipPreviewDialog({
  open,
  onClose,
  slip,
  employee,
  onValidate,
}: PayslipPreviewDialogProps) {
  if (!slip) return null;

  const base = parseFloat(slip.salaireBase) || 0;
  const indemnites = parseFloat(slip.indemnites) || 0;
  const cnss = parseFloat(slip.retenueCnss) || 0;
  const amo = parseFloat(slip.retenueAmo) || 0;
  const net = parseFloat(slip.salaireNet) || 0;
  const charges = slip.chargesPatronales
    ? parseFloat(slip.chargesPatronales)
    : base * 0.2011;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto print:p-0 print:border-none print:shadow-none">
        <DialogHeader className="border-b pb-3 print:hidden">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileCheck className="size-5 text-primary" />
              Bulletin de Paie Officiel —{" "}
              {slip.mois.toString().padStart(2, "0")}/{slip.annee}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrint}
                className="gap-1.5 text-xs"
              >
                <Printer className="size-3.5" />
                Imprimer
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* PRINTABLE SLIP CONTAINER */}
        <div className="p-6 border rounded-lg bg-white text-slate-900 shadow-sm space-y-6 print:border-none print:shadow-none">
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Building className="size-6 text-primary" />
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  HÔTEL MAKARIM SARL
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Complexe Hôtelier & Restauration — Registre du Commerce RC:
                48291
              </p>
              <p className="text-xs text-slate-500">
                ICE: 001849204000038 • IF: 20491823
              </p>
            </div>
            <div className="text-right">
              <Badge
                variant={slip.estValide ? "default" : "outline"}
                className={`text-sm py-1 px-3 ${
                  slip.estValide
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "border-amber-500 text-amber-600"
                }`}
              >
                {slip.estValide ? "OFFICIEL VALIDÉ" : "SIMULATION PROVISOIRE"}
              </Badge>
              <p className="text-xs text-slate-500 mt-2 font-mono">
                Réf: PAY-{slip.annee}-{slip.mois.toString().padStart(2, "0")}-
                {slip.id}
              </p>
            </div>
          </div>

          {/* Period Title */}
          <div className="bg-slate-100 p-3 rounded-md text-center border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 uppercase tracking-wide">
              BULLETIN DE PAIE — MOIS DE {getMonthName(slip.mois)} {slip.annee}
            </h3>
          </div>

          {/* Employee Info Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50/80 p-4 rounded-md border border-slate-200">
            <div>
              <span className="text-slate-500 block">
                Nom & Prénom du Salarié:
              </span>
              <span className="font-bold text-slate-900 text-sm">
                {employee?.user.nom || `Employé #${slip.employeeId}`}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Matricule CNSS:</span>
              <span className="font-mono font-bold text-slate-800">
                {employee?.matriculeCnss || "Non renseigné"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Email / Identifiant:</span>
              <span className="font-mono text-slate-700">
                {employee?.user.email || "-"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Date d'embauche:</span>
              <span className="font-medium text-slate-800">
                {employee?.dateEmbauche
                  ? new Date(employee.dateEmbauche).toLocaleDateString("fr-FR")
                  : "-"}
              </span>
            </div>
          </div>

          {/* Table Breakdown */}
          <table className="w-full text-xs border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-left">
                <th className="p-2 border border-slate-200">
                  Rubrique / Intitulé
                </th>
                <th className="p-2 border border-slate-200 text-right">
                  Base (MAD)
                </th>
                <th className="p-2 border border-slate-200 text-right">
                  Taux / Formule
                </th>
                <th className="p-2 border border-slate-200 text-right">
                  Gains (MAD)
                </th>
                <th className="p-2 border border-slate-200 text-right">
                  Retenues (MAD)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border border-slate-200 font-medium">
                  Salaire de Base Contractuel
                </td>
                <td className="p-2 border border-slate-200 text-right font-mono">
                  {base.toFixed(2)}
                </td>
                <td className="p-2 border border-slate-200 text-right font-mono">
                  100 %
                </td>
                <td className="p-2 border border-slate-200 text-right font-mono font-semibold">
                  {base.toFixed(2)}
                </td>
                <td className="p-2 border border-slate-200 text-right font-mono text-slate-400">
                  -
                </td>
              </tr>
              {indemnites > 0 && (
                <tr>
                  <td className="p-2 border border-slate-200">
                    Indemnités & Primes Spéciales
                  </td>
                  <td className="p-2 border border-slate-200 text-right font-mono">
                    {indemnites.toFixed(2)}
                  </td>
                  <td className="p-2 border border-slate-200 text-right font-mono">
                    -
                  </td>
                  <td className="p-2 border border-slate-200 text-right font-mono font-semibold">
                    {indemnites.toFixed(2)}
                  </td>
                  <td className="p-2 border border-slate-200 text-right font-mono text-slate-400">
                    -
                  </td>
                </tr>
              )}
              <tr>
                <td className="p-2 border border-slate-200">
                  Cotisation CNSS Salariale
                </td>
                <td className="p-2 border border-slate-200 text-right font-mono">
                  {base.toFixed(2)}
                </td>
                <td className="p-2 border border-slate-200 text-right font-mono">
                  4.48 % (Plafonné 6000 DH)
                </td>
                <td className="p-2 border border-slate-200 text-right font-mono text-slate-400">
                  -
                </td>
                <td className="p-2 border border-slate-200 text-right font-mono text-rose-700 font-semibold">
                  {cnss.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-200">
                  Cotisation AMO Salariale
                </td>
                <td className="p-2 border border-slate-200 text-right font-mono">
                  {base.toFixed(2)}
                </td>
                <td className="p-2 border border-slate-200 text-right font-mono">
                  2.26 %
                </td>
                <td className="p-2 border border-slate-200 text-right font-mono text-slate-400">
                  -
                </td>
                <td className="p-2 border border-slate-200 text-right font-mono text-rose-700 font-semibold">
                  {amo.toFixed(2)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold">
                <td
                  colSpan={3}
                  className="p-2 border border-slate-200 text-right"
                >
                  TOTALS BRUT / DÉDUCTIONS:
                </td>
                <td className="p-2 border border-slate-200 text-right font-mono text-emerald-700">
                  {(base + indemnites).toFixed(2)} MAD
                </td>
                <td className="p-2 border border-slate-200 text-right font-mono text-rose-700">
                  {(cnss + amo).toFixed(2)} MAD
                </td>
              </tr>
            </tfoot>
          </table>

          {/* NET PAY HIGHLIGHT */}
          <div className="bg-emerald-50 border-2 border-emerald-500/40 p-4 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-900 uppercase">
                NET À PAYER AU SALARIÉ
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Virement bancaire / Règlement au profit du salarié
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black font-mono text-emerald-800">
                {net.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} MAD
              </span>
            </div>
          </div>

          {/* Employer Contributions & Footer */}
          <div className="grid grid-cols-2 gap-4 text-[11px] text-slate-500 pt-2 border-t">
            <div>
              <p className="font-semibold text-slate-700">
                Estimatif Charges Patronales (CNSS + AMO):
              </p>
              <p className="font-mono mt-0.5">
                ~{charges.toFixed(2)} MAD (Part Employeur ~20.11%)
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-700">
                Cachet & Signature RH:
              </p>
              <p className="italic text-slate-400 mt-4">
                Hôtel Makarim — Direction RH
              </p>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-2 border-t print:hidden">
          <Button variant="outline" size="sm" onClick={onClose}>
            Fermer
          </Button>
          <div className="flex items-center gap-2">
            {!slip.estValide && onValidate && (
              <Button
                size="sm"
                onClick={() => onValidate(slip.id)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                <CheckCircle className="size-4" />
                Valider Officiellement ce Bulletin
              </Button>
            )}
            <Button size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="size-4" />
              Imprimer le Bulletin
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getMonthName(m: number): string {
  const months = [
    "JANVIER",
    "FÉVRIER",
    "MARS",
    "AVRIL",
    "MAI",
    "JUIN",
    "JUILLET",
    "AOÛT",
    "SEPTEMBRE",
    "OCTOBRE",
    "NOVEMBRE",
    "DÉCEMBRE",
  ];
  return months[m - 1] || `MOIS ${m}`;
}
