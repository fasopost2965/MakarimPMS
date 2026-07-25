import { useEffect, useState, useCallback } from "react";
import {
  Search,
  UserCheck,
  Calendar,
  AlertCircle,
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
import { Badge } from "@/components/ui/badge";
import { searchGuests, updateGuest } from "@/features/guests/api";
import { listReservations } from "@/features/reservations/api";
import type { Guest } from "@/features/guests/types";
import type { Reservation } from "@/features/reservations/types";
import type { DocumentOcrResult } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  scanResult: DocumentOcrResult | null;
  onAssigned: () => void;
}

export function AssignScanDialog({
  open,
  onClose,
  scanResult,
  onAssigned,
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInitialData = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const [guestList, resList] = await Promise.all([
        searchGuests(query || undefined),
        listReservations(),
      ]);
      setGuests(guestList);
      setReservations(resList.filter((r) => r.statut !== "ANNULEE"));
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchTerm(scanResult?.nom || scanResult?.numeroPiece || "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedGuest(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);

    void loadInitialData(scanResult?.nom || scanResult?.numeroPiece || "");
  }, [open, scanResult, loadInitialData]);

  async function handleSearch(q: string) {
    setSearchTerm(q);
    setLoading(true);
    try {
      const guestList = await searchGuests(q.trim() || undefined);
      setGuests(guestList);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignToGuest(guest: Guest) {
    if (!scanResult) return;
    setSubmitting(true);
    setError(null);

    try {
      // Update guest profile with OCR identity fields
      const updatedNotes = guest.preferences
        ? `${guest.preferences} | Doc OCR: Expiration ${scanResult.dateExpiration || "N/A"}`
        : `Doc OCR: Expiration ${scanResult.dateExpiration || "N/A"}`;

      await updateGuest(guest.id, {
        nom: scanResult.nom || guest.nom,
        prenom: scanResult.prenom || guest.prenom,
        pieceIdentite:
          scanResult.numeroPiece || guest.pieceIdentite || undefined,
        nationalite:
          scanResult.nationalite === "MAR"
            ? "Marocaine"
            : scanResult.nationalite || guest.nationalite || undefined,
        preferences: updatedNotes,
      });

      onAssigned();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de l'attribution du scan au client",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-border">
        <DialogHeader className="p-4 pb-3 bg-muted/30 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <UserCheck className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold">
                Rattacher le Scan OCR à un Client / Réservation
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Mettre à jour la fiche identité d'un client existant ou d'une
                réservation en cours.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {scanResult && (
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Données du Scan à Injecter
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-foreground">
                <span>
                  {scanResult.nom} {scanResult.prenom}
                </span>
                <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">
                  N° {scanResult.numeroPiece}
                </span>
                <span>Nat: {scanResult.nationalite}</span>
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => void handleSearch(e.target.value)}
              placeholder="Rechercher par nom, CIN, passeport, téléphone…"
              className="pl-9 h-9 text-xs"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded bg-destructive/10 text-destructive text-xs border border-destructive/20 flex items-center gap-1.5">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Clients trouvés ({guests.length})
            </p>

            {loading ? (
              <p className="text-xs text-muted-foreground py-2">
                Recherche en cours…
              </p>
            ) : guests.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 italic">
                Aucun client existant ne correspond à la recherche.
              </p>
            ) : (
              <div className="space-y-1.5">
                {guests.map((guest) => {
                  const linkedRes = reservations.find(
                    (r) => r.guestId === guest.id,
                  );
                  return (
                    <div
                      key={guest.id}
                      className={`p-3 rounded-lg border transition-all flex items-center justify-between gap-3 text-xs ${
                        selectedGuest?.id === guest.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:bg-muted/40"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">
                            {guest.nom} {guest.prenom}
                          </span>
                          <Badge variant="outline" className="text-[9px]">
                            {guest.categorie}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                          <span>
                            CIN/Pass: {guest.pieceIdentite || "Non renseigné"}
                          </span>
                          {guest.telephone && (
                            <span>Tel: {guest.telephone}</span>
                          )}
                        </div>
                        {linkedRes && (
                          <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium pt-0.5">
                            <Calendar className="size-3" />
                            <span>
                              Réservation active CH-
                              {linkedRes.roomId || "Non attribuée"} (
                              {linkedRes.dateArrivee} au {linkedRes.dateDepart})
                            </span>
                          </div>
                        )}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        disabled={submitting}
                        onClick={() => void handleAssignToGuest(guest)}
                        className="h-7 text-xs font-bold shrink-0 bg-primary text-primary-foreground"
                      >
                        {submitting && selectedGuest?.id === guest.id
                          ? "Attribution…"
                          : "Rattacher ce scan"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-3 bg-muted/20 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
