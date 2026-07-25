import { useState } from "react";
import {
  Wrench,
  Building,
  BedDouble,
  AlertTriangle,
  UserCheck,
  Tag,
  Info,
  CheckCircle2,
  Camera,
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
import type { CreateMaintenanceTicketInput, PrioriteTicket } from "../types";
import type { Room } from "../../reservations/types";


interface Props {
  open: boolean;
  rooms: Room[];
  onClose: () => void;
  onConfirm: (input: CreateMaintenanceTicketInput) => Promise<void>;
  submitting: boolean;
  error: string | null;
}

const COMMON_AREAS = [
  "Réception / Lobby principal",
  "Restaurant & Salle Petit-Déjeuner",
  "Cuisine & Arrière-cuisine",
  "Ascenseurs & Cage d'escalier",
  "Piscine & Espace Spa/Sauna",
  "Terrasse & Rooftop",
  "Parking / Extérieurs",
  "Locaux techniques & Buanderie",
];

const CATEGORIES = [
  { label: "Plomberie & Sanitaires", icon: "💧", prefix: "Plomberie" },
  { label: "Climatisation & Chauffage", icon: "❄️", prefix: "Climatisation" },
  { label: "Électricité & Éclairage", icon: "⚡", prefix: "Électricité" },
  { label: "Serrure & Carte d'accès", icon: "🔑", prefix: "Serrurerie" },
  { label: "TV, Wi-Fi & Téléphone", icon: "📺", prefix: "High-Tech / TV" },
  { label: "Mobilier & Peinture", icon: "🛋️", prefix: "Menuiserie / Peinture" },
  { label: "Autre / Incidents divers", icon: "🛠️", prefix: "Divers" },
];

const PRIORITIES: {
  value: PrioriteTicket;
  label: string;
  desc: string;
  badgeClass: string;
  cardClass: string;
}[] = [
  {
    value: "BASSE",
    label: "Basse",
    desc: "Entretien mineur ou prévention",
    badgeClass:
      "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
    cardClass: "hover:border-slate-400 focus:ring-slate-400",
  },
  {
    value: "MOYENNE",
    label: "Moyenne",
    desc: "Dysfonctionnement sous 24-48h",
    badgeClass:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300",
    cardClass: "hover:border-blue-500 focus:ring-blue-500",
  },
  {
    value: "HAUTE",
    label: "Haute",
    desc: "Intervention prioritaire dans la journée",
    badgeClass:
      "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300",
    cardClass: "hover:border-amber-500 focus:ring-amber-500",
  },
  {
    value: "URGENTE",
    label: "Urgente",
    desc: "Rupture de service ou risque immédiat",
    badgeClass:
      "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 font-bold",
    cardClass: "hover:border-rose-500 focus:ring-rose-500",
  },
];

const PRESET_TECHNICIANS = [
  "Électricien Interne",
  "Service Plomberie / Maintenance",
  "Gouvernante Générale",
  "Prestataire Froid & HVAC",
  "Équipe Technique Polyvalente",
];

export function CreateTicketDialog({
  open,
  rooms,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props) {
  const [targetType, setTargetType] = useState<"room" | "common">("room");
  const [roomId, setRoomId] = useState<string>("");
  const [commonArea, setCommonArea] = useState<string>(COMMON_AREAS[0]);

  const [categoryPrefix, setCategoryPrefix] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [priorite, setPriorite] = useState<PrioriteTicket>("MOYENNE");
  const [assigneA, setAssigneA] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string>("");

  const selectedRoom = rooms.find((r) => String(r.id) === roomId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;

    const fullTypePanne = categoryPrefix
      ? `[${categoryPrefix}] ${description.trim()}`
      : description.trim();

    const isRoomTarget = targetType === "room" && roomId !== "";
    const locationInfo = isRoomTarget ? undefined : ` (Zone : ${commonArea})`;

    void onConfirm({
      roomId: isRoomTarget ? Number(roomId) : undefined,
      typePanne: `${fullTypePanne}${locationInfo || ""}`,
      priorite,
      assigneA: assigneA.trim() || undefined,
      photoUrl: photoUrl.trim() || undefined,
    });
  }

  function handleSelectCategory(cat: (typeof CATEGORIES)[number]) {
    setCategoryPrefix(cat.prefix);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-2xl max-w-[calc(100%-1rem)] max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Wrench className="size-5 text-amber-600 dark:text-amber-400" />
            <span>Nouveau Ticket d'Incident Technique</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Signalez une panne ou un besoin d'intervention technique pour le
            personnel de maintenance
          </p>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 text-xs mt-2"
        >
          {/* STEP 1: TARGET LOCATION TYPE */}
          <div className="flex flex-col gap-2">
            <Label className="font-bold text-xs flex items-center gap-1.5 text-foreground">
              <Building className="size-3.5 text-primary" />
              <span>1. Emplacement concerné</span>
            </Label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetType("room")}
                className={`p-3 rounded-xl border flex items-center gap-3 text-left transition-all ${
                  targetType === "room"
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "bg-card hover:bg-muted/40"
                }`}
              >
                <BedDouble
                  className={`size-5 ${targetType === "room" ? "text-primary" : "text-muted-foreground"}`}
                />
                <div>
                  <p className="font-bold text-xs text-foreground">
                    Chambre d'Hôtel
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Associer le ticket à une chambre
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTargetType("common")}
                className={`p-3 rounded-xl border flex items-center gap-3 text-left transition-all ${
                  targetType === "common"
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "bg-card hover:bg-muted/40"
                }`}
              >
                <Building
                  className={`size-5 ${targetType === "common" ? "text-primary" : "text-muted-foreground"}`}
                />
                <div>
                  <p className="font-bold text-xs text-foreground">
                    Zone Commune
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Lobby, restaurant, ascenseurs…
                  </p>
                </div>
              </button>
            </div>

            {/* LOCATION SELECTOR DETAILS */}
            {targetType === "room" ? (
              <div className="flex flex-col gap-1.5 mt-1 p-3 bg-muted/20 border rounded-xl">
                <Label
                  htmlFor="room-select"
                  className="text-[11px] text-muted-foreground font-semibold"
                >
                  Sélectionner la chambre :
                </Label>
                <Select
                  value={roomId}
                  onValueChange={(val) => setRoomId(val || "")}
                  items={[
                    {
                      value: "",
                      label: "Sélectionner une chambre dans la liste…",
                    },
                    ...rooms.map((room) => ({
                      value: String(room.id),
                      label: `Chambre #${room.numero} (${room.roomType.nom}) — Statut: ${room.statut}`,
                    })),
                  ]}
                >
                  <SelectTrigger
                    id="room-select"
                    className="bg-background h-9 text-xs"
                  >
                    <SelectValue placeholder="Choisir une chambre…" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((room) => (
                      <SelectItem
                        key={room.id}
                        value={String(room.id)}
                        className="text-xs"
                      >
                        <span className="font-bold font-mono">
                          #{room.numero}
                        </span>{" "}
                        — {room.roomType.nom}{" "}
                        <span className="text-muted-foreground text-[10px]">
                          ({room.statut})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedRoom && (
                  <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-lg text-[11px] mt-1">
                    <Info className="size-3.5 shrink-0" />
                    <span>
                      Créer ce ticket sur la chambre{" "}
                      <strong>#{selectedRoom.numero}</strong> basculera son
                      statut en <strong>EN_MAINTENANCE</strong> si elle n'est
                      pas occupée.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 mt-1 p-3 bg-muted/20 border rounded-xl">
                <Label
                  htmlFor="common-select"
                  className="text-[11px] text-muted-foreground font-semibold"
                >
                  Espace ou infrastructure publique :
                </Label>
                <Select
                  value={commonArea}
                  onValueChange={(val) => val && setCommonArea(val)}
                  items={COMMON_AREAS.map((area) => ({
                    value: area,
                    label: area,
                  }))}
                >
                  <SelectTrigger
                    id="common-select"
                    className="bg-background h-9 text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_AREAS.map((area) => (
                      <SelectItem key={area} value={area} className="text-xs">
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* STEP 2: CATEGORY SHORTCUTS */}
          <div className="flex flex-col gap-2 border-t pt-3">
            <Label className="font-bold text-xs flex items-center gap-1.5 text-foreground">
              <Tag className="size-3.5 text-amber-600 dark:text-amber-400" />
              <span>2. Catégorie de panne (raccourcis)</span>
            </Label>

            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => {
                const isSelected = categoryPrefix === cat.prefix;
                return (
                  <button
                    key={cat.prefix}
                    type="button"
                    onClick={() => handleSelectCategory(cat)}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 transition-all font-medium ${
                      isSelected
                        ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                        : "bg-card hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 3: DESCRIPTION & DETAILS */}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="description"
              className="font-bold text-xs flex items-center gap-1.5 text-foreground"
            >
              <Wrench className="size-3.5 text-primary" />
              <span>
                3. Description détaillée du problème{" "}
                <span className="text-rose-500">*</span>
              </span>
            </Label>
            <Textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex. Fuite sous le lavabo de la salle de bain, climatisation fait du bruit et ne refroidit plus…"
              className="bg-background text-xs"
              required
            />
          </div>

          {/* STEP 4: PRIORITY SELECTION */}
          <div className="flex flex-col gap-2 border-t pt-3">
            <Label className="font-bold text-xs flex items-center gap-1.5 text-foreground">
              <AlertTriangle className="size-3.5 text-rose-500" />
              <span>4. Degré de priorité & urgence</span>
            </Label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRIORITIES.map((p) => {
                const isSelected = priorite === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriorite(p.value)}
                    className={`p-2.5 rounded-xl border flex flex-col justify-between gap-1 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary"
                        : `bg-card ${p.cardClass}`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Badge className={`text-[10px] ${p.badgeClass}`}>
                        {p.label}
                      </Badge>
                      {isSelected && (
                        <CheckCircle2 className="size-3.5 text-primary" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-1">
                      {p.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 5: ASSIGNMENT & OPTIONAL PHOTO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t pt-3">
            {/* ASSIGNED TECHNICIAN */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="assigneA"
                className="font-bold text-xs flex items-center gap-1.5 text-foreground"
              >
                <UserCheck className="size-3.5 text-emerald-600" />
                <span>5. Assignation (technicien / service)</span>
              </Label>
              <Input
                id="assigneA"
                value={assigneA}
                onChange={(e) => setAssigneA(e.target.value)}
                placeholder="Ex. Youssef (Technicien HVAC)…"
                className="bg-background h-8 text-xs"
              />
              <div className="flex flex-wrap gap-1 mt-0.5">
                {PRESET_TECHNICIANS.slice(0, 3).map((tech) => (
                  <button
                    key={tech}
                    type="button"
                    onClick={() => setAssigneA(tech)}
                    className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground border"
                  >
                    + {tech}
                  </button>
                ))}
              </div>
            </div>

            {/* PHOTO URL / ATTACHMENT / CAMERA CAPTURE */}
            <div className="flex flex-col gap-1.5">
              <Label
                className="font-bold text-xs flex items-center gap-1.5 text-foreground"
              >
                <Camera className="size-3.5 text-blue-600" />
                <span>6. Photo illustrative (Téléversement / Caméra)</span>
              </Label>
              <PhotoUploader value={photoUrl} onChange={setPhotoUrl} />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          {/* FOOTER ACTIONS */}
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
              disabled={
                submitting ||
                !description.trim() ||
                (targetType === "room" && !roomId)
              }
              className="text-xs font-bold gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {submitting ? (
                <span>Création du ticket…</span>
              ) : (
                <>
                  <Wrench className="size-4" />
                  <span>Enregistrer & Créer le Ticket</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
