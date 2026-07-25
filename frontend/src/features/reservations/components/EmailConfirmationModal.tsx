import { useState } from "react";
import {
  Mail,
  Send,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Reservation } from "../types";

interface Props {
  reservation: Reservation | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EmailConfirmationModal({ reservation, onClose, onSuccess }: Props) {
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const guestEmail = reservation?.guest.email || "";
  const [recipientEmail, setRecipientEmail] = useState(guestEmail);
  const [emailSubject, setEmailSubject] = useState(
    reservation
      ? `Confirmation de votre réservation #RES-2026-${String(reservation.id).padStart(4, "0")} — Hôtel Makarim ****`
      : "",
  );
  const [customMessage, setCustomMessage] = useState(
    reservation
      ? `Bonjour ${reservation.guest.prenom} ${reservation.guest.nom},\n\nNous avons le plaisir de vous confirmer votre réservation à l'Hôtel Makarim ****.\nNous vous souhaitons par avance un excellent séjour parmi nous !`
      : "",
  );

  if (!reservation) return null;

  const nights = Math.max(
    1,
    Math.round(
      (new Date(reservation.dateDepart).getTime() -
        new Date(reservation.dateArrivee).getTime()) /
        86400000,
    ) || 1,
  );

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim()) return;

    setSending(true);

    // Simulate sending email via backend notification system
    setTimeout(() => {
      setSending(false);
      setSentSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setSentSuccess(false);
        onClose();
      }, 1800);
    }, 1200);
  };

  return (
    <Dialog open={reservation !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-w-[calc(100%-1rem)] max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Mail className="size-5 text-blue-600" />
            <span>Envoyer la Confirmation de Réservation par E-mail</span>
          </DialogTitle>
        </DialogHeader>

        {sentSuccess ? (
          <div className="py-10 flex flex-col items-center justify-center text-center gap-3">
            <div className="size-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="size-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground">
              E-mail Envoyé avec Succès !
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Le bon de confirmation a été transmis à{" "}
              <strong className="text-foreground">{recipientEmail}</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSendEmail} className="flex flex-col gap-4 text-xs">
            {/* RECIPIENT & SUBJECT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="recipientEmail" className="font-semibold text-xs">
                  Adresse e-mail du destinataire *
                </Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="exemple@domaine.com"
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emailSubject" className="font-semibold text-xs">
                  Objet de l'e-mail
                </Label>
                <Input
                  id="emailSubject"
                  required
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="h-9 text-xs font-medium"
                />
              </div>
            </div>

            {/* CUSTOM MESSAGE INTRO */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customMessage" className="font-semibold text-xs">
                Message personnalisé d'accompagnement
              </Label>
              <textarea
                id="customMessage"
                rows={3}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

            {/* PREVIEW CARD OF EMAIL HTML ATTACHMENT */}
            <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-amber-500" />
                  Aperçu de la Fiche de Réservation jointe
                </span>
                <Badge variant="outline" className="text-[10px]">
                  Fichier HTML & PDF
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px] text-muted-foreground bg-background p-3 rounded border">
                <div>
                  <span className="font-semibold text-foreground block">
                    Client : {reservation.guest.nom} {reservation.guest.prenom}
                  </span>
                  <span>Chambre #{reservation.room.numero} ({reservation.room.roomType.nom})</span>
                </div>
                <div>
                  <span className="font-semibold text-foreground block">
                    Séjour : {nights} nuit(s)
                  </span>
                  <span>
                    Du {reservation.dateArrivee.slice(0, 10)} au {reservation.dateDepart.slice(0, 10)}
                  </span>
                </div>
                <div className="col-span-2 border-t pt-1.5 flex justify-between font-bold text-foreground">
                  <span>Montant Total TTC :</span>
                  <span className="text-emerald-600 font-mono">
                    {Number(reservation.prixTotalFinal).toLocaleString("fr-MA")} MAD
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={sending}>
                Annuler
              </Button>
              <Button type="submit" disabled={sending || !recipientEmail.trim()} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                {sending ? (
                  <span>Envoi en cours…</span>
                ) : (
                  <>
                    <Send className="size-3.5" />
                    <span>Envoyer la Confirmation</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
