import { useState } from "react";
import {
  User,
  Phone,
  Mail,
  BedDouble,
  Receipt,
  FileCheck2,
  Sparkles,
  Printer,
  Send,
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
import { SelfCheckinPanel } from "./SelfCheckinPanel";
import { PrintReservationModal } from "./PrintReservationModal";
import { EmailConfirmationModal } from "./EmailConfirmationModal";
import type { Reservation } from "../types";

interface Props {
  reservation: Reservation | null;
  onClose: () => void;
  onSave: (input: {
    prixTotalFinal?: number;
    motifAjustement?: string;
  }) => void;
  saving: boolean;
  error: string | null;
}

export function ReservationDetailsDialog({
  reservation,
  onClose,
  onSave,
  saving,
  error,
}: Props) {
  return (
    <Dialog
      open={reservation !== null}
      onOpenChange={(next) => !next && onClose()}
    >
      <DialogContent className="sm:max-w-2xl max-w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto p-6">
        {reservation && (
          <ReservationDetailsForm
            key={reservation.id}
            reservation={reservation}
            onClose={onClose}
            onSave={onSave}
            saving={saving}
            error={error}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReservationDetailsForm({
  reservation,
  onClose,
  onSave,
  saving,
  error,
}: Props & { reservation: Reservation }) {
  const [prixTotalFinal, setPrixTotalFinal] = useState(
    reservation.prixTotalFinal,
  );
  const [motifAjustement, setMotifAjustement] = useState(
    reservation.motifAjustement ?? "",
  );

  // Modals state for Print & Email Confirmation
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const priceChanged =
    Number(prixTotalFinal) !== Number(reservation.prixTotalFinal);

  // Parse sourceBrute for notes or extra info
  let parsedSource: {
    notes?: string;
    depositAmount?: number;
    paymentMethod?: string;
  } = {};
  if (reservation.sourceBrute) {
    try {
      parsedSource = JSON.parse(reservation.sourceBrute);
    } catch {
      // Ignore if raw string
    }
  }

  const floor = reservation.room?.numero?.startsWith("1")
    ? "1er Étage"
    : reservation.room?.numero?.startsWith("2")
      ? "2ème Étage"
      : "3ème Étage";

  return (
    <div className="flex flex-col gap-5">
      {/* HEADER */}
      <DialogHeader className="border-b pb-3">
        <div className="flex items-center justify-between">
          <div>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <span>Dossier Réservation #{reservation.id}</span>
              <Badge
                variant={
                  reservation.canal === "BOOKING_COM"
                    ? "info"
                    : reservation.canal === "WALK_IN"
                      ? "warning"
                      : "success"
                }
                className="text-xs font-semibold"
              >
                {reservation.canal === "BOOKING_COM"
                  ? "Booking.com"
                  : reservation.canal === "WALK_IN"
                    ? "Walk-In Réception"
                    : "Réservation Directe"}
              </Badge>
            </DialogTitle>
            <p className="text-muted-foreground text-xs mt-0.5">
              Créée le{" "}
              {new Date(reservation.createdAt).toLocaleDateString("fr-FR")}
            </p>
          </div>

          <Badge
            variant={
              reservation.statut === "CONFIRMEE"
                ? "success"
                : reservation.statut === "TRANSFORMEE_EN_SEJOUR"
                  ? "outline"
                  : "destructive"
            }
            className="text-xs"
          >
            {reservation.statut === "CONFIRMEE"
              ? "Confirmée"
              : reservation.statut === "TRANSFORMEE_EN_SEJOUR"
                ? "En Séjour (Checked-in)"
                : reservation.statut}
          </Badge>
        </div>

        {/* QUICK ACTIONS BAR: PRINT VOUCHER & EMAIL CONFIRMATION */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t text-xs">
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => setShowPrintModal(true)}
            className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs"
          >
            <Printer className="size-3.5" />
            <span>Imprimer Bon de Confirmation</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowEmailModal(true)}
            className="gap-1.5 border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-xs font-semibold"
          >
            <Send className="size-3.5 text-blue-600" />
            <span>Envoyer par E-mail</span>
          </Button>
        </div>
      </DialogHeader>

      {/* SUMMARY CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* CARD 1: CLIENT DETAILS */}
        <div className="rounded-lg border p-3.5 bg-background flex flex-col gap-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-2">
            <User className="size-3.5 text-primary" />
            Client & Coordonnées
          </h4>
          <div className="flex flex-col gap-1 text-xs">
            <p className="font-bold text-sm text-foreground">
              {reservation.guest.nom} {reservation.guest.prenom}
            </p>
            {reservation.guest.telephone && (
              <p className="text-muted-foreground flex items-center gap-1.5">
                <Phone className="size-3 text-emerald-600" />
                <span>{reservation.guest.telephone}</span>
              </p>
            )}
            {reservation.guest.email && (
              <p className="text-muted-foreground flex items-center gap-1.5">
                <Mail className="size-3 text-blue-600" />
                <span>{reservation.guest.email}</span>
              </p>
            )}
            {reservation.guest.pieceIdentite && (
              <p className="text-muted-foreground flex items-center gap-1.5 mt-1 pt-1 border-t">
                <FileCheck2 className="size-3 text-purple-600" />
                <span>Doc: {reservation.guest.pieceIdentite}</span>
              </p>
            )}
          </div>
        </div>

        {/* CARD 2: ROOM & STAY DATES */}
        <div className="rounded-lg border p-3.5 bg-background flex flex-col gap-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-2">
            <BedDouble className="size-3.5 text-primary" />
            Chambre & Dates
          </h4>
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">
                Chambre #{reservation.room.numero}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {floor}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Type: {reservation.room.roomType.nom} (
              {reservation.room.roomType.prixBase} MAD/nuit)
            </p>
            <div className="mt-1 pt-1 border-t flex items-center justify-between text-muted-foreground text-[11px]">
              <span>Arrivée: {reservation.dateArrivee.slice(0, 10)}</span>
              <span>Départ: {reservation.dateDepart.slice(0, 10)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SELF CHECK-IN LINK GENERATOR PANEL */}
      {reservation.statut === "CONFIRMEE" && (
        <div className="rounded-lg border bg-blue-500/5 p-3.5 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-blue-600" />
            <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300">
              Pré-enregistrement Digital (Self Check-in)
            </h4>
          </div>
          <SelfCheckinPanel
            reservationId={reservation.id}
            guestEmail={reservation.guest.email}
          />
        </div>
      )}

      {/* NOTES & SPECIAL REQUESTS IF ANY */}
      {parsedSource.notes && (
        <div className="rounded-lg border p-3 bg-muted/20 text-xs flex flex-col gap-1">
          <span className="font-semibold text-muted-foreground">
            Remarques & Consignes Réception :
          </span>
          <p className="italic text-foreground">{parsedSource.notes}</p>
        </div>
      )}

      {/* PRICING & ADJUSTMENT FORM */}
      <form
        className="flex flex-col gap-3 rounded-lg border p-4 bg-background"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(
            priceChanged
              ? {
                  prixTotalFinal: Number(prixTotalFinal),
                  motifAjustement: motifAjustement || undefined,
                }
              : {},
          );
        }}
      >
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-2">
          <Receipt className="size-3.5 text-emerald-600" />
          Facturation & Tarification
        </h4>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <Label htmlFor="prixTotalCalcule" className="text-[11px]">
              Prix calculé automatique
            </Label>
            <Input
              id="prixTotalCalcule"
              value={`${Number(reservation.prixTotalCalcule).toLocaleString("fr-MA")} MAD`}
              readOnly
              disabled
              className="h-8 font-mono bg-muted/50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="prixTotalFinal" className="text-[11px] font-bold">
                Prix Final Facturé
              </Label>
              {reservation.ajustementManuel && (
                <Badge variant="destructive" className="text-[9px] px-1 py-0">
                  Ajusté
                </Badge>
              )}
            </div>
            <Input
              id="prixTotalFinal"
              type="number"
              min={0}
              step="1"
              value={prixTotalFinal}
              onChange={(e) => setPrixTotalFinal(e.target.value)}
              className="h-8 font-bold text-emerald-700 dark:text-emerald-400"
            />
          </div>
        </div>

        {(reservation.ajustementManuel || priceChanged) && (
          <div className="flex flex-col gap-1 text-xs">
            <Label htmlFor="motifAjustement" className="text-[11px]">
              Motif de l'ajustement de tarif (Audit obligatoire)
            </Label>
            <Input
              id="motifAjustement"
              value={motifAjustement}
              onChange={(e) => setMotifAjustement(e.target.value)}
              placeholder="ex. Geste commercial, partenariat entreprise..."
              className="h-8 text-xs"
            />
          </div>
        )}

        {error && (
          <p className="text-destructive text-xs font-medium">{error}</p>
        )}

        <DialogFooter className="pt-2 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Fermer
          </Button>

          <Button
            type="submit"
            disabled={saving || !priceChanged}
            className="gap-2 text-xs"
          >
            {saving ? "Enregistrement…" : "Enregistrer Ajustement Prix"}
          </Button>
        </DialogFooter>
      </form>

      {/* PRINT VOUCHER MODAL */}
      {showPrintModal && (
        <PrintReservationModal
          reservation={reservation}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* EMAIL CONFIRMATION MODAL */}
      {showEmailModal && (
        <EmailConfirmationModal
          reservation={reservation}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </div>
  );
}
