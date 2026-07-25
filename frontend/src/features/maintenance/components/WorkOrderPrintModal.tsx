import { Printer, X, Wrench, Building, BedDouble, UserCheck, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { MaintenanceTicket } from "../types";

interface WorkOrderPrintModalProps {
  ticket: MaintenanceTicket | null;
  open: boolean;
  onClose: () => void;
}

export function WorkOrderPrintModal({
  ticket,
  open,
  onClose,
}: WorkOrderPrintModalProps) {
  if (!ticket) return null;

  const handlePrint = () => {
    window.print();
  };

  const isUrgent = ticket.priorite === "URGENTE" || ticket.priorite === "HAUTE";

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 border shadow-2xl print:shadow-none print:border-none print:m-0 print:p-0 print:max-w-none">
        {/* MODAL ACTION BAR (HIDDEN IN PRINT) */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/40 print:hidden">
          <div className="flex items-center gap-2">
            <Wrench className="size-5 text-amber-600" />
            <DialogTitle className="text-sm font-bold text-foreground">
              Aperçu de la Fiche d'Intervention #TKT-{ticket.id.toString().padStart(5, "0")}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handlePrint}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
            >
              <Printer className="size-4" />
              <span>Imprimer Bon de Travail</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="size-8 p-0"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* PRINTABLE WORK ORDER CONTAINER */}
        <div
          id="printable-work-order"
          className="p-8 bg-white text-slate-900 font-sans print:p-6 print:text-black"
        >
          {/* EMBEDDED PRINT CSS RULES */}
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-work-order, #printable-work-order * {
                visibility: visible !important;
              }
              #printable-work-order {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                padding: 15mm !important;
                margin: 0 !important;
                background: white !important;
                color: black !important;
              }
              .print\\:hidden {
                display: none !important;
              }
            }
          `}</style>

          {/* BRANDED HEADER */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-6">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight uppercase text-slate-900">
                Hôtel Makarim ****
              </h1>
              <p className="text-xs text-slate-600 font-semibold tracking-wider uppercase mt-0.5">
                Service Maintenance & Technique
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Direction de l'Hébergement — Ordre de Service Officiel
              </p>
            </div>

            <div className="text-right">
              <div className="inline-block bg-slate-900 text-white px-3 py-1 font-mono font-bold text-sm rounded">
                ORDRE #TKT-{ticket.id.toString().padStart(5, "0")}
              </div>
              <p className="text-[11px] text-slate-600 font-mono mt-1">
                Émis le : {new Date(ticket.createdAt).toLocaleDateString("fr-FR")} à{" "}
                {new Date(ticket.createdAt).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {/* URGENCY ALERT BANNER */}
          {isUrgent && (
            <div className="mb-6 p-3 border-2 border-rose-600 bg-rose-50 text-rose-900 rounded-lg flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
              <ShieldAlert className="size-5 text-rose-600 shrink-0" />
              <span>Intervention Prioritaire — Priorité : {ticket.priorite}</span>
            </div>
          )}

          {/* LOCATION & PRIORITY DETAILS GRID */}
          <div className="grid grid-cols-2 gap-4 border rounded-xl p-4 bg-slate-50 mb-6 print:bg-white print:border-slate-400">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Emplacement / Zone d'intervention
              </span>
              {ticket.room ? (
                <div className="flex items-center gap-2">
                  <BedDouble className="size-5 text-amber-600" />
                  <div>
                    <p className="font-extrabold text-base text-slate-900">
                      Chambre #{ticket.room.numero}
                    </p>
                    <p className="text-xs text-slate-600">
                      Étage {ticket.room.numero.charAt(0)} — {ticket.room.roomType?.nom || "Chambre"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Building className="size-5 text-blue-600" />
                  <div>
                    <p className="font-extrabold text-base text-slate-900">
                      Zone Commune / Espaces Publics
                    </p>
                    <p className="text-xs text-slate-600">Hôtel Général</p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Technicien Assigné & Priorité
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <UserCheck className="size-4 text-emerald-600" />
                  <span>{ticket.assigneA || "Non assigné (Équipe de garde)"}</span>
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-600">Niveau de Priorité :</span>
                  <span className="font-bold text-xs uppercase px-2 py-0.5 bg-slate-200 text-slate-800 rounded">
                    {ticket.priorite}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* INCIDENT DESCRIPTION */}
          <div className="mb-6">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Wrench className="size-4 text-amber-600" />
              <span>Description de l'Incident Technique</span>
            </h3>
            <div className="p-4 border-2 border-slate-300 rounded-xl bg-white">
              <p className="font-bold text-base text-slate-900 mb-2">
                {ticket.typePanne}
              </p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                Intervention signalée pour la maintenance technique de la chambre ou des espaces communs. Merci d'effectuer un diagnostic complet des équipements sur site.
              </p>
            </div>
          </div>

          {/* CHECKLIST FOR MAINTENANCE STAFF */}
          <div className="mb-6">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Checklist de Contrôle sur Site
            </h3>
            <div className="border rounded-xl p-4 space-y-2.5 text-xs font-medium text-slate-800 bg-slate-50 print:bg-white">
              <div className="flex items-center gap-3">
                <div className="size-4 border-2 border-slate-700 rounded bg-white shrink-0" />
                <span>Diagnostic des composants & identification de la panne</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-4 border-2 border-slate-700 rounded bg-white shrink-0" />
                <span>Remplacement des pièces défectueuses / Réparation effectuée</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-4 border-2 border-slate-700 rounded bg-white shrink-0" />
                <span>Test de fonctionnement à chaud & contrôle de sécurité</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-4 border-2 border-slate-700 rounded bg-white shrink-0" />
                <span>Nettoyage du chantier et réintégration de la chambre en stock propre</span>
              </div>
            </div>
          </div>

          {/* WRITE-IN SECTION FOR TECHNICIAN NOTES & SUPPLIES */}
          <div className="mb-8">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Observations & Pièces / Fournitures Utilisées (Manuscrit)
            </h3>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 h-24 space-y-3">
              <div className="border-b border-slate-200 h-6" />
              <div className="border-b border-slate-200 h-6" />
              <div className="border-b border-slate-200 h-6" />
            </div>
          </div>

          {/* SIGNATURES & VALIDATION FOOTER */}
          <div className="grid grid-cols-2 gap-8 border-t-2 border-slate-900 pt-6 mt-8">
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-12">
                Signature du Technicien Intervenant :
              </p>
              <div className="border-t border-slate-400 pt-1 text-[10px] text-slate-500 font-mono">
                Nom & Prénom Technicien — Date : ___ / ___ / 2026
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-12">
                Validation Gouvernante / Réception :
              </p>
              <div className="border-t border-slate-400 pt-1 text-[10px] text-slate-500 font-mono">
                Remise en service validée à ___h___
              </div>
            </div>
          </div>

          {/* FOOTER CONFIDENTIALITY */}
          <div className="mt-8 text-center text-[9px] text-slate-400 font-mono border-t pt-3">
            Hôtel Makarim **** — Document interne de travail — Service Général Maintenance
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
