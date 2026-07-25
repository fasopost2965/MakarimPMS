import { useState } from "react";
import {
  User,
  BedDouble,
  Receipt,
  FileCheck2,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Phone,
  Mail,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BillingTabContent } from "@/features/billing/components/BillingTabContent";
import { PoliceRecordForm } from "@/features/police/components/PoliceRecordForm";
import type { Stay } from "../types";

interface Props {
  stay: Stay | null;
  onClose: () => void;
  onCheckout: () => void;
  checkingOut: boolean;
  error: string | null;
  soldeDu: string | null;
  onPoliceRecordSaved?: () => void;
}

const STATUT_LABEL: Record<Stay["statut"], string> = {
  EN_COURS: "En Séjour Actif",
  CHECKOUT: "Check-Out Effectué",
};

export function StayDetailsDialog({
  stay,
  onClose,
  onCheckout,
  checkingOut,
  error,
  soldeDu,
  onPoliceRecordSaved,
}: Props) {
  const [activeTab, setActiveTab] = useState<"details" | "facturation" | "police">("details");

  if (!stay) return null;

  const floor = stay.room?.numero?.startsWith("1")
    ? "1er Étage"
    : stay.room?.numero?.startsWith("2")
      ? "2ème Étage"
      : stay.room?.numero?.startsWith("3")
        ? "3ème Étage"
        : "Rez-de-chaussée";

  const totalCharges = stay.folios.reduce((acc, f) => {
    return (
      acc +
      f.lignes
        .filter((l) => !l.annulee)
        .reduce((lAcc, l) => lAcc + Number(l.montant || 0), 0)
    );
  }, 0);

  return (
    <Dialog open={stay !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-3xl max-w-[calc(100%-1rem)] max-h-[92vh] overflow-y-auto p-6">
        {/* HEADER */}
        <DialogHeader className="border-b pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <span>Dossier Séjour #{stay.id}</span>
                <Badge
                  variant={stay.statut === "EN_COURS" ? "success" : "secondary"}
                  className="text-xs font-semibold"
                >
                  {STATUT_LABEL[stay.statut]}
                </Badge>
                {stay.reservationId === null && (
                  <Badge variant="warning" className="text-xs">
                    Walk-In Réception
                  </Badge>
                )}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Check-in effectué le :{" "}
                <strong className="text-foreground">
                  {new Date(stay.dateCheckin).toLocaleString("fr-FR")}
                </strong>
              </p>
            </div>

            {/* POLICE DGSN STATUS BADGE */}
            <div>
              {stay.policeRecord ? (
                <Badge variant="success" className="gap-1 text-xs">
                  <ShieldCheck className="size-3.5" />
                  <span>Fiche Police DGSN Conforme</span>
                </Badge>
              ) : (
                <Badge
                  variant="destructive"
                  className="gap-1 text-xs cursor-pointer"
                  onClick={() => setActiveTab("police")}
                >
                  <ShieldAlert className="size-3.5" />
                  <span>⚠ Fiche Police DGSN Requise</span>
                </Badge>
              )}
            </div>
          </div>

          {/* TAB NAVIGATION BUTTONS */}
          <div className="flex items-center gap-2 mt-4 pt-2 border-t text-xs">
            <Button
              type="button"
              variant={activeTab === "details" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("details")}
              className="gap-1.5 text-xs font-semibold"
            >
              <User className="size-3.5" />
              <span>Aperçu & Folio Général</span>
            </Button>

            <Button
              type="button"
              variant={activeTab === "facturation" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("facturation")}
              className="gap-1.5 text-xs font-semibold"
            >
              <Receipt className="size-3.5" />
              <span>Facturation & Consommations</span>
            </Button>

            <Button
              type="button"
              variant={activeTab === "police" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("police")}
              className={`gap-1.5 text-xs font-semibold ${
                !stay.policeRecord
                  ? "border-amber-500 text-amber-700 dark:text-amber-300"
                  : ""
              }`}
            >
              <FileCheck2 className="size-3.5" />
              <span>Registre de Police DGSN</span>
              {!stay.policeRecord && (
                <span className="ml-1 size-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </Button>
          </div>
        </DialogHeader>

        {/* TAB 1: DETAILS & OVERVIEW */}
        {activeTab === "details" && (
          <div className="flex flex-col gap-4 text-xs">
            {/* CARDS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* CLIENT CARD */}
              <div className="rounded-xl border p-3.5 bg-background flex flex-col gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-2">
                  <User className="size-3.5 text-primary" />
                  Occupant du Séjour
                </h4>
                <div className="flex flex-col gap-1">
                  <p className="font-bold text-sm text-foreground">
                    {stay.guest.nom} {stay.guest.prenom}
                  </p>
                  {stay.guest.telephone && (
                    <p className="text-muted-foreground flex items-center gap-1.5">
                      <Phone className="size-3 text-emerald-600" />
                      <span>{stay.guest.telephone}</span>
                    </p>
                  )}
                  {stay.guest.email && (
                    <p className="text-muted-foreground flex items-center gap-1.5">
                      <Mail className="size-3 text-blue-600" />
                      <span>{stay.guest.email}</span>
                    </p>
                  )}
                  {stay.guest.pieceIdentite && (
                    <p className="text-muted-foreground flex items-center gap-1.5 mt-1 pt-1 border-t text-[11px]">
                      <FileCheck2 className="size-3 text-purple-600" />
                      <span>Pièce ID : {stay.guest.pieceIdentite}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* ROOM & STAY DATES */}
              <div className="rounded-xl border p-3.5 bg-background flex flex-col gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-2">
                  <BedDouble className="size-3.5 text-primary" />
                  Chambre & Planning
                </h4>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">
                      Chambre #{stay.room.numero}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {floor}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Type: {stay.room.roomType.nom} (
                    {stay.room.roomType.prixBase} MAD/nuit)
                  </p>
                  <div className="mt-1 pt-1 border-t flex items-center justify-between text-muted-foreground text-[11px]">
                    <span>Départ prévu :</span>
                    <strong className="text-foreground">
                      {stay.dateCheckoutPrevue.slice(0, 10)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* FOLIO SUMMARY TABLE */}
            <div className="rounded-xl border p-4 bg-background flex flex-col gap-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Receipt className="size-3.5 text-emerald-600" />
                  Extrait du Folio Principal
                </h4>
                <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  Total Cumulé : {totalCharges.toLocaleString("fr-MA")} MAD
                </span>
              </div>

              {stay.folios.length === 0 ? (
                <p className="text-muted-foreground italic text-xs">
                  Aucun folio enregistré pour ce séjour.
                </p>
              ) : (
                <div className="space-y-2">
                  {stay.folios.map((folio) => (
                    <div key={folio.id} className="space-y-1">
                      <ul className="divide-y text-xs border rounded-lg bg-muted/20">
                        {folio.lignes.map((ligne) => (
                          <li
                            key={ligne.id}
                            className="p-2 flex items-center justify-between"
                          >
                            <span
                              className={
                                ligne.annulee
                                  ? "text-muted-foreground line-through"
                                  : "text-foreground font-medium"
                              }
                            >
                              {ligne.libelle}
                            </span>
                            <span className="font-mono font-bold">
                              {Number(ligne.montant).toLocaleString("fr-MA")} MAD
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {soldeDu !== null && (
                <div className="p-3 bg-slate-900 text-white rounded-lg flex items-center justify-between font-bold">
                  <span>Solde Calculé au Check-Out :</span>
                  <span className="text-amber-400 font-mono text-base">
                    {Number(soldeDu).toLocaleString("fr-MA")} MAD
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: BILLING */}
        {activeTab === "facturation" && (
          <div className="pt-2">
            <BillingTabContent stayId={stay.id} />
          </div>
        )}

        {/* TAB 3: POLICE DGSN */}
        {activeTab === "police" && (
          <div className="pt-2">
            <PoliceRecordForm
              stayId={stay.id}
              reservationId={stay.reservationId}
              onSaved={onPoliceRecordSaved}
            />
          </div>
        )}

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-xs font-medium">
            {error}
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <DialogFooter className="pt-3 border-t flex items-center justify-between">
          <Button type="button" variant="outline" onClick={onClose}>
            Fermer le Dossier
          </Button>

          {stay.statut === "EN_COURS" && (
            <Button
              type="button"
              onClick={onCheckout}
              disabled={checkingOut}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
            >
              <LogOut className="size-4" />
              <span>
                {checkingOut
                  ? "Validation du Check-out…"
                  : "Procéder au Check-Out Client"}
              </span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
