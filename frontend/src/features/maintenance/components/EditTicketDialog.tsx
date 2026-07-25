import { useEffect, useState } from "react";
import {
  Wrench,
  Building,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  Camera,
  Edit,
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhotoUploader } from "./PhotoUploader";
import type {
  MaintenanceTicket,
  PrioriteTicket,
  UpdateMaintenanceTicketInput,
} from "../types";
import type { Room } from "../../reservations/types";

interface Props {
  open: boolean;
  ticket: MaintenanceTicket | null;
  rooms: Room[];
  onClose: () => void;
  onConfirm: (id: number, input: UpdateMaintenanceTicketInput) => Promise<void>;
  submitting: boolean;
  error: string | null;
}

const PRIORITIES: {
  value: PrioriteTicket;
  label: string;
  badgeClass: string;
}[] = [
  {
    value: "BASSE",
    label: "Basse",
    badgeClass:
      "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
  },
  {
    value: "MOYENNE",
    label: "Moyenne",
    badgeClass:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300",
  },
  {
    value: "HAUTE",
    label: "Haute",
    badgeClass:
      "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300",
  },
  {
    value: "URGENTE",
    label: "Urgente",
    badgeClass:
      "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 font-bold",
  },
];

export function EditTicketDialog({
  open,
  ticket,
  rooms,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props) {
  const [roomId, setRoomId] = useState<string>("");
  const [typePanne, setTypePanne] = useState<string>("");
  const [priorite, setPriorite] = useState<PrioriteTicket>("MOYENNE");
  const [assigneA, setAssigneA] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string>("");

  useEffect(() => {
    if (ticket) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoomId(ticket.roomId ? String(ticket.roomId) : "common");
      setTypePanne(ticket.typePanne || "");
      setPriorite(ticket.priorite || "MOYENNE");
      setAssigneA(ticket.assigneA || "");
      setPhotoUrl(ticket.photoUrl || "");
    }
  }, [ticket]);

  if (!ticket) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket || !typePanne.trim()) return;

    const parsedRoomId = roomId === "common" ? null : Number(roomId);

    void onConfirm(ticket.id, {
      roomId: parsedRoomId,
      typePanne: typePanne.trim(),
      priorite,
      assigneA: assigneA.trim() || null,
      photoUrl: photoUrl.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-xl max-w-[calc(100%-1rem)] max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Edit className="size-5 text-amber-600 dark:text-amber-400" />
            <span>Modifier le Ticket #{ticket.id}</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mettez à jour les détails, la priorité, l'assignation ou la photo de
            l'incident.
          </p>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 text-xs mt-2"
        >
          {/* LOCATION */}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="edit-room-select"
              className="font-bold text-xs flex items-center gap-1.5"
            >
              <Building className="size-3.5 text-primary" />
              <span>Emplacement / Chambre</span>
            </Label>
            <Select
              value={roomId}
              onValueChange={(val) => setRoomId(val || "common")}
              items={[
                {
                  value: "common",
                  label: "Zone commune (Non liée à une chambre)",
                },
                ...rooms.map((room) => ({
                  value: String(room.id),
                  label: `Chambre #${room.numero} (${room.roomType.nom})`,
                })),
              ]}
            >
              <SelectTrigger
                id="edit-room-select"
                className="bg-background h-9 text-xs"
              >
                <SelectValue placeholder="Chambre ou zone commune…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="common" className="text-xs">
                  Zone commune / Infrastructure publique
                </SelectItem>
                {rooms.map((room) => (
                  <SelectItem
                    key={room.id}
                    value={String(room.id)}
                    className="text-xs"
                  >
                    Chambre{" "}
                    <span className="font-mono font-bold">#{room.numero}</span>{" "}
                    ({room.roomType.nom})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* DESCRIPTION */}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="edit-description"
              className="font-bold text-xs flex items-center gap-1.5"
            >
              <Wrench className="size-3.5 text-primary" />
              <span>
                Description / Nature de la Panne{" "}
                <span className="text-rose-500">*</span>
              </span>
            </Label>
            <Textarea
              id="edit-description"
              rows={3}
              value={typePanne}
              onChange={(e) => setTypePanne(e.target.value)}
              className="bg-background text-xs"
              required
            />
          </div>

          {/* PRIORITY */}
          <div className="flex flex-col gap-2">
            <Label className="font-bold text-xs flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-rose-500" />
              <span>Degré de Priorité</span>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRIORITIES.map((p) => {
                const isSelected = priorite === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriorite(p.value)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary"
                        : "bg-card hover:bg-muted/50"
                    }`}
                  >
                    <Badge className={`text-[10px] ${p.badgeClass}`}>
                      {p.label}
                    </Badge>
                    {isSelected && (
                      <CheckCircle2 className="size-3.5 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TECHNICIAN */}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="edit-assigneA"
              className="font-bold text-xs flex items-center gap-1.5"
            >
              <UserCheck className="size-3.5 text-emerald-600" />
              <span>Technicien / Prestataire Assigné</span>
            </Label>
            <Input
              id="edit-assigneA"
              value={assigneA}
              onChange={(e) => setAssigneA(e.target.value)}
              placeholder="Ex. Électricien, Service technique…"
              className="bg-background h-8 text-xs"
            />
          </div>

          {/* PHOTO ATTACHMENT */}
          <div className="flex flex-col gap-1.5 border-t pt-3">
            <Label className="font-bold text-xs flex items-center gap-1.5">
              <Camera className="size-3.5 text-blue-600" />
              <span>Photo de l'Incident (Téléversement ou Caméra)</span>
            </Label>
            <PhotoUploader value={photoUrl} onChange={setPhotoUrl} />
          </div>

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
              disabled={submitting || !typePanne.trim()}
              className="text-xs font-bold gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {submitting ? "Mise à jour…" : "Enregistrer les modifications"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
