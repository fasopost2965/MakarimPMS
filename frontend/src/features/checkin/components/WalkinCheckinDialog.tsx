import { useState } from "react";
import {
  LogIn,
  BedDouble,
  Sparkles,
  CreditCard,
  UserCheck,
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
import { SelectSearch } from "@/components/ui/select-search";
import { GuestPicker } from "@/features/guests/components/GuestPicker";
import type { GuestSelection } from "@/features/guests/components/GuestPicker";
import type { Room } from "../../reservations/types";
import type { WalkinCheckinInput } from "../types";

interface Props {
  open: boolean;
  rooms: Room[];
  onClose: () => void;
  onConfirm: (input: WalkinCheckinInput) => void;
  submitting: boolean;
  error: string | null;
}

export function WalkinCheckinDialog({
  open,
  rooms,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-2xl max-w-[calc(100%-1rem)] max-h-[92vh] overflow-y-auto p-6">
        {open && (
          <WalkinForm
            rooms={rooms}
            onClose={onClose}
            onConfirm={onConfirm}
            submitting={submitting}
            error={error}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function WalkinForm({
  rooms,
  onClose,
  onConfirm,
  submitting,
  error,
}: Omit<Props, "open">) {
  const [roomId, setRoomId] = useState("");
  const [dateCheckoutPrevue, setDateCheckoutPrevue] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [guestSelection, setGuestSelection] = useState<GuestSelection | null>(
    null,
  );
  const [paymentMethod, setPaymentMethod] = useState("ESPECES");

  const selectedRoom = rooms.find((r) => String(r.id) === roomId);

  const floor = selectedRoom?.numero?.startsWith("1")
    ? "1er Étage"
    : selectedRoom?.numero?.startsWith("2")
      ? "2ème Étage"
      : selectedRoom?.numero?.startsWith("3")
        ? "3ème Étage"
        : "Rez-de-chaussée";

  const nights = dateCheckoutPrevue
    ? Math.max(
        1,
        Math.round(
          (new Date(dateCheckoutPrevue).getTime() -
            new Date(new Date().toISOString().slice(0, 10)).getTime()) /
            86400000,
        ) || 1,
      )
    : 1;

  const estimatedTotal = selectedRoom
    ? Number(selectedRoom.roomType.prixBase) * nights
    : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* HEADER */}
      <DialogHeader className="border-b pb-3">
        <div className="flex items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <LogIn className="size-5 text-emerald-600" />
              <span>Enregistrement Direct (Walk-In Réception)</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Arrivée spontanée sans réservation préalable — Attribution immédiate de la chambre
            </p>
          </div>
          <Badge variant="warning" className="text-xs gap-1 font-semibold">
            <Sparkles className="size-3" />
            Walk-In Immediate
          </Badge>
        </div>
      </DialogHeader>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!roomId || !dateCheckoutPrevue || !guestSelection) return;
          onConfirm({
            roomId: Number(roomId),
            dateCheckoutPrevue,
            ...guestSelection,
          });
        }}
      >
        {/* ROOM & DATES SELECTOR */}
        <div className="rounded-xl border p-4 bg-background flex flex-col gap-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-2">
            <BedDouble className="size-3.5 text-primary" />
            Attribution de la Chambre & Séjour
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="room" className="font-semibold text-xs">
                Sélectionner la Chambre disponible *
              </Label>
              <SelectSearch
                id="room"
                value={roomId}
                onValueChange={setRoomId}
                placeholder="Numéro ou catégorie de chambre…"
                emptyMessage="Aucune chambre libre ne correspond."
                items={rooms.map((room) => ({
                  value: String(room.id),
                  label: `Ch. #${room.numero} — ${room.roomType.nom} (${room.roomType.prixBase} MAD)`,
                }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateCheckoutPrevue" className="font-semibold text-xs">
                Date de départ prévue *
              </Label>
              <div className="relative">
                <Input
                  id="dateCheckoutPrevue"
                  type="date"
                  value={dateCheckoutPrevue}
                  onChange={(e) => setDateCheckoutPrevue(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>

          {selectedRoom && (
            <div className="p-2.5 rounded-lg border bg-emerald-500/5 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {floor}
                </Badge>
                <span className="font-bold text-foreground">
                  Ch. #{selectedRoom.numero} ({selectedRoom.roomType.nom})
                </span>
              </div>
              <div className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                {nights} {nights > 1 ? "nuitées" : "nuitée"} | Total :{" "}
                {estimatedTotal.toLocaleString("fr-MA")} MAD
              </div>
            </div>
          )}
        </div>

        {/* GUEST CRM SELECTION */}
        <div className="rounded-xl border p-4 bg-background flex flex-col gap-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-2">
            <UserCheck className="size-3.5 text-primary" />
            Identification du Client (Fiche CRM)
          </h4>

          <GuestPicker onChange={setGuestSelection} />
        </div>

        {/* PAYMENT METHOD & NOTES */}
        <div className="rounded-xl border p-4 bg-background flex flex-col gap-3 text-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-2">
            <CreditCard className="size-3.5 text-emerald-600" />
            Mode de Règlement à l'Arrivée
          </h4>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "ESPECES", label: "Espèces (MAD)" },
              { id: "CARTE_BANCAIRE", label: "Carte Bancaire" },
              { id: "VIREMENT", label: "Virement / Chèque" },
            ].map((method) => (
              <button
                type="button"
                key={method.id}
                onClick={() => setPaymentMethod(method.id)}
                className={`p-2 rounded-lg border text-center font-medium transition-all ${
                  paymentMethod === method.id
                    ? "border-emerald-600 bg-emerald-500/10 text-emerald-950 dark:text-emerald-300 font-bold"
                    : "border-border hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                {method.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-xs font-medium">
            {error}
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={
              submitting || !roomId || !dateCheckoutPrevue || !guestSelection
            }
            className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
          >
            {submitting ? (
              <span>Enregistrement en cours…</span>
            ) : (
              <>
                <LogIn className="size-4" />
                <span>Valider le Check-In Walk-In</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </div>
  );
}
