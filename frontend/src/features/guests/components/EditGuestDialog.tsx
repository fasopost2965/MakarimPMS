import { useEffect, useState } from "react";
import {
  User,
  Phone,
  Mail,
  CreditCard,
  Heart,
  Edit3,
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
import type { Guest, UpdateGuestInput } from "../types";
import { NationalitySelect } from "./NationalitySelect";

interface Props {
  open: boolean;
  guest: Guest | null;
  onClose: () => void;
  onConfirm: (id: number, input: UpdateGuestInput) => Promise<void>;
  submitting: boolean;
  error: string | null;
}

export function EditGuestDialog({
  open,
  guest,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props) {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [pieceIdentite, setPieceIdentite] = useState("");
  const [nationalite, setNationalite] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [preferences, setPreferences] = useState("");

  useEffect(() => {
    if (guest) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNom(guest.nom || "");
      setPrenom(guest.prenom || "");
      setPieceIdentite(guest.pieceIdentite || "");
      setNationalite(guest.nationalite || "");
      setTelephone(guest.telephone || "");
      setEmail(guest.email || "");
      setPreferences(guest.preferences || "");
    }
  }, [guest]);

  if (!guest) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guest || !nom.trim() || !prenom.trim()) return;

    void onConfirm(guest.id, {
      nom: nom.trim(),
      prenom: prenom.trim(),
      pieceIdentite: pieceIdentite.trim() || undefined,
      nationalite: nationalite.trim() || undefined,
      telephone: telephone.trim() || undefined,
      email: email.trim() || undefined,
      preferences: preferences.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-xl max-w-[calc(100%-1rem)] max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Edit3 className="size-5 text-amber-600 dark:text-amber-400" />
            <span>Modifier la Fiche Client #{guest.id}</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mettez à jour l'identité, les coordonnées ou les préférences de{" "}
            <span className="font-bold text-foreground">
              {guest.nom} {guest.prenom}
            </span>
            .
          </p>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 text-xs mt-2"
        >
          {/* NOM ET PRENOM */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="edit-guest-nom"
                className="font-bold text-xs flex items-center gap-1.5"
              >
                <User className="size-3.5 text-primary" />
                <span>
                  Nom <span className="text-rose-500">*</span>
                </span>
              </Label>
              <Input
                id="edit-guest-nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="bg-background h-9 text-xs"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="edit-guest-prenom"
                className="font-bold text-xs flex items-center gap-1.5"
              >
                <User className="size-3.5 text-primary" />
                <span>
                  Prénom <span className="text-rose-500">*</span>
                </span>
              </Label>
              <Input
                id="edit-guest-prenom"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                className="bg-background h-9 text-xs"
                required
              />
            </div>
          </div>

          {/* PIECE D'IDENTITE & NATIONALITE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="edit-guest-cin"
                className="font-bold text-xs flex items-center gap-1.5"
              >
                <CreditCard className="size-3.5 text-blue-600" />
                <span>Pièce d'Identité (CIN / Passeport)</span>
              </Label>
              <Input
                id="edit-guest-cin"
                value={pieceIdentite}
                onChange={(e) => setPieceIdentite(e.target.value)}
                placeholder="Ex. AB123456"
                className="bg-background h-9 text-xs font-mono"
              />
            </div>

            <NationalitySelect
              id="edit-guest-nat"
              value={nationalite}
              onChange={setNationalite}
            />
          </div>

          {/* TELEPHONE & EMAIL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="edit-guest-phone"
                className="font-bold text-xs flex items-center gap-1.5"
              >
                <Phone className="size-3.5 text-amber-600" />
                <span>Téléphone Mobile</span>
              </Label>
              <Input
                id="edit-guest-phone"
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                className="bg-background h-9 text-xs font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="edit-guest-email"
                className="font-bold text-xs flex items-center gap-1.5"
              >
                <Mail className="size-3.5 text-purple-600" />
                <span>Adresse Email</span>
              </Label>
              <Input
                id="edit-guest-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background h-9 text-xs font-mono"
              />
            </div>
          </div>

          {/* PREFERENCES */}
          <div className="flex flex-col gap-1.5 border-t pt-3">
            <Label
              htmlFor="edit-guest-prefs"
              className="font-bold text-xs flex items-center gap-1.5"
            >
              <Heart className="size-3.5 text-rose-500" />
              <span>Préférences Client & Notes Hôtel</span>
            </Label>
            <Textarea
              id="edit-guest-prefs"
              rows={3}
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder="Ex. Non-fumeur, étage élevé, demandes particulières…"
              className="bg-background text-xs"
            />
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
              disabled={submitting || !nom.trim() || !prenom.trim()}
              className="text-xs font-bold gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {submitting ? "Enregistrement…" : "Mettre à jour la fiche"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
