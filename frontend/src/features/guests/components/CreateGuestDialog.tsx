import { useState, useEffect } from "react";
import {
  User,
  Phone,
  Mail,
  CreditCard,
  Heart,
  AlertTriangle,
  UserPlus,
  Tag,
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
import type { CreateGuestInput } from "../types";
import { useDuplicateWarning } from "../useDuplicateWarning";
import { NationalitySelect } from "./NationalitySelect";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (input: CreateGuestInput) => Promise<void>;
  submitting: boolean;
  error: string | null;
  initialValues?: Partial<CreateGuestInput>;
}

const PREFERENCE_TAGS = [
  "Non-fumeur",
  "Étage élevé",
  "Chambre calme",
  "Lit King size",
  "Lit bébé",
  "Check-in tardif",
  "Vue Jardin / Mer",
  "PMR / Accès facile",
];

export function CreateGuestDialog({
  open,
  onClose,
  onConfirm,
  submitting,
  error,
  initialValues,
}: Props) {
  const [nom, setNom] = useState(initialValues?.nom || "");
  const [prenom, setPrenom] = useState(initialValues?.prenom || "");
  const [pieceIdentite, setPieceIdentite] = useState(
    initialValues?.pieceIdentite || "",
  );
  const [nationalite, setNationalite] = useState(
    initialValues?.nationalite || "Marocaine",
  );
  const [telephone, setTelephone] = useState(initialValues?.telephone || "");
  const [email, setEmail] = useState(initialValues?.email || "");
  const [preferences, setPreferences] = useState(
    initialValues?.preferences || "",
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Update form fields if initialValues prop changes or when dialog opens
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNom(initialValues?.nom || "");
      setPrenom(initialValues?.prenom || "");
      setPieceIdentite(initialValues?.pieceIdentite || "");
      setNationalite(initialValues?.nationalite || "Marocaine");
      setTelephone(initialValues?.telephone || "");
      setEmail(initialValues?.email || "");
      setPreferences(initialValues?.preferences || "");
    }
  }, [open, initialValues]);

  const duplicates = useDuplicateWarning(email, telephone);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim() || !prenom.trim()) return;

    const combinedPrefs = [...selectedTags, preferences.trim()]
      .filter(Boolean)
      .join(" · ");

    void onConfirm({
      nom: nom.trim(),
      prenom: prenom.trim(),
      pieceIdentite: pieceIdentite.trim() || undefined,
      nationalite: nationalite.trim() || undefined,
      telephone: telephone.trim() || undefined,
      email: email.trim() || undefined,
      preferences: combinedPrefs || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-xl max-w-[calc(100%-1rem)] max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <UserPlus className="size-5 text-amber-600 dark:text-amber-400" />
            <span>Nouveau Client / Fiche CRM</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Renseignez l'identité, les coordonnées et les préférences du client.
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
                htmlFor="guest-nom"
                className="font-bold text-xs flex items-center gap-1.5"
              >
                <User className="size-3.5 text-primary" />
                <span>
                  Nom de Famille <span className="text-rose-500">*</span>
                </span>
              </Label>
              <Input
                id="guest-nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex. El Amrani"
                className="bg-background h-9 text-xs"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="guest-prenom"
                className="font-bold text-xs flex items-center gap-1.5"
              >
                <User className="size-3.5 text-primary" />
                <span>
                  Prénom <span className="text-rose-500">*</span>
                </span>
              </Label>
              <Input
                id="guest-prenom"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                placeholder="Ex. Youssef"
                className="bg-background h-9 text-xs"
                required
              />
            </div>
          </div>

          {/* PIECE D'IDENTITE & NATIONALITE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="guest-cin"
                className="font-bold text-xs flex items-center gap-1.5"
              >
                <CreditCard className="size-3.5 text-blue-600" />
                <span>Pièce d'Identité (CIN / Passeport)</span>
              </Label>
              <Input
                id="guest-cin"
                value={pieceIdentite}
                onChange={(e) => setPieceIdentite(e.target.value)}
                placeholder="Ex. AB123456 ou N° Passeport"
                className="bg-background h-9 text-xs font-mono"
              />
            </div>

            <NationalitySelect
              id="guest-nat"
              value={nationalite}
              onChange={setNationalite}
            />
          </div>

          {/* TELEPHONE & EMAIL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="guest-phone"
                className="font-bold text-xs flex items-center gap-1.5"
              >
                <Phone className="size-3.5 text-amber-600" />
                <span>Téléphone Mobile</span>
              </Label>
              <Input
                id="guest-phone"
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="Ex. +212 661-000000"
                className="bg-background h-9 text-xs font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="guest-email"
                className="font-bold text-xs flex items-center gap-1.5"
              >
                <Mail className="size-3.5 text-purple-600" />
                <span>Adresse Email</span>
              </Label>
              <Input
                id="guest-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex. client@gmail.com"
                className="bg-background h-9 text-xs font-mono"
              />
            </div>
          </div>

          {/* PREFERENCES & TAGS */}
          <div className="flex flex-col gap-2 border-t pt-3">
            <Label className="font-bold text-xs flex items-center gap-1.5">
              <Heart className="size-3.5 text-rose-500" />
              <span>Préférences Client & Demandes Particulières</span>
            </Label>

            <div className="flex flex-wrap gap-1.5 mb-1">
              {PREFERENCE_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all ${
                      isSelected
                        ? "bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-bold"
                        : "bg-card hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <Tag className="size-3" />
                    <span>{tag}</span>
                  </button>
                );
              })}
            </div>

            <Textarea
              rows={2}
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder="Ex. Allergies, demandes spécifiques, notes VIP…"
              className="bg-background text-xs"
            />
          </div>

          {/* DUPLICATE WARNING BANNER */}
          {duplicates.length > 0 && (
            <div className="p-3 rounded-xl border border-amber-300 bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                <span>
                  Attention : Client(s) similaire(s) détecté(s) en base
                </span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <span className="font-bold">
                      {d.nom} {d.prenom}
                    </span>
                    {d.telephone && ` — Tél : ${d.telephone}`}
                    {d.email && ` — Email : ${d.email}`}
                    <Badge variant="outline" className="ml-1.5 text-[9px]">
                      {d.categorie}
                    </Badge>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80 italic mt-0.5">
                Vérification indicative. La création reste autorisée si vous
                confirmez qu'il s'agit de personnes distinctes.
              </p>
            </div>
          )}

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
              {submitting ? "Création en cours…" : "Créer la fiche client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
