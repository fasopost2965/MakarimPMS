import { useEffect, useState } from "react";
import {
  Calendar,
  CreditCard,
  User,
  CheckCircle2,
  Sparkles,
  BedDouble,
  Receipt,
  Phone,
  ArrowRight,
  ArrowLeft,
  PhoneCall,
  ShieldCheck,
  Check,
  Building,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  GuestPicker,
  type GuestSelection,
} from "@/features/guests/components/GuestPicker";
import { searchCompanies } from "@/features/companies/api";
import type { Company } from "@/features/companies/types";
import type { CanalReservation, FormuleHebergement, Room } from "../types";

export interface CreateReservationSelection {
  room: Room;
  dateArrivee: string;
  dateDepart: string;
}

export interface EnrichedReservationPayload {
  guestSelection: GuestSelection;
  roomId: number;
  dateArrivee: string;
  dateDepart: string;
  canal: CanalReservation;
  formule: FormuleHebergement;
  sourceBrute?: string;
  prixTotalFinal?: number;
  motifAjustement?: string;
  companyId?: number;
}

interface Props {
  selection: CreateReservationSelection | null;
  allRooms?: Room[];
  isOpenDirectly?: boolean;
  onClose: () => void;
  onConfirm: (payload: EnrichedReservationPayload) => void;
  submitting: boolean;
  error: string | null;
}

const ADDON_OPTIONS = [
  { id: "breakfast", label: "Petit-déjeuner Buffet Extra", pricePerNight: 80 },
  {
    id: "city_tax",
    label: "Taxe de Séjour Municipale (15 MAD / pers / nuit)",
    pricePerNight: 15,
  },
  { id: "shuttle", label: "Navette Aéroport Tanger/Tétouan", flatPrice: 250 },
  {
    id: "extra_bed",
    label: "Lit Supplémentaire Enfant/Adulte",
    pricePerNight: 120,
  },
];

export function CreateReservationDialog({
  selection,
  allRooms = [],
  isOpenDirectly = false,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props) {
  const open = selection !== null || isOpenDirectly;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-4xl max-w-[calc(100%-1rem)] max-h-[92vh] overflow-y-auto p-5 sm:p-7">
        {open && (
          <EnrichedReservationForm
            selection={selection}
            allRooms={allRooms}
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

function EnrichedReservationForm({
  selection,
  allRooms = [],
  onClose,
  onConfirm,
  submitting,
  error,
}: Omit<Props, "isOpenDirectly">) {
  const roomsList = allRooms || [];

  // Stepper state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Booking Flow Mode: "PHONE_CALL_OPTION" (Fast pre-reservation) vs "FULL_CONFIRMED"
  const [bookingMode, setBookingMode] = useState<"PHONE_CALL_OPTION" | "FULL_CONFIRMED">(
    "FULL_CONFIRMED",
  );

  // Step 1: Dates & Room state
  const [roomId, setRoomId] = useState<number>(
    selection?.room.id || (roomsList.length > 0 ? roomsList[0].id : 0),
  );
  const [dateArrivee, setDateArrivee] = useState<string>(() => {
    if (selection?.dateArrivee) return selection.dateArrivee;
    return new Date().toISOString().slice(0, 10);
  });
  const [dateDepart, setDateDepart] = useState<string>(() => {
    if (selection?.dateDepart) return selection.dateDepart;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });

  const selectedRoom =
    roomsList.find((r) => r.id === roomId) || selection?.room;

  const nights = Math.max(
    1,
    Math.round(
      (new Date(dateDepart).getTime() - new Date(dateArrivee).getTime()) /
        86400000,
    ) || 1,
  );

  // Step 2: Guest & Corporate CRM
  const [guestSelection, setGuestSelection] = useState<GuestSelection | null>(
    null,
  );
  const [isCompanyBilling, setIsCompanyBilling] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Step 3: Channel & Formule & Addons & Pricing
  const [canal, setCanal] = useState<CanalReservation>(
    selection ? "DIRECT" : "WALK_IN",
  );
  const [formule, setFormule] =
    useState<FormuleHebergement>("BED_AND_BREAKFAST");
  const [selectedAddons, setSelectedAddons] = useState<string[]>(["city_tax"]);

  const basePricePerNight = Number(selectedRoom?.roomType.prixBase || 650);
  const rawSubtotal = basePricePerNight * nights;

  let addonsTotal = 0;
  if (selectedAddons.includes("breakfast")) addonsTotal += 80 * nights;
  if (selectedAddons.includes("city_tax")) addonsTotal += 15 * nights;
  if (selectedAddons.includes("shuttle")) addonsTotal += 250;
  if (selectedAddons.includes("extra_bed")) addonsTotal += 120 * nights;

  const calculatedTotal = rawSubtotal + addonsTotal;

  const [enableCustomPrice, setEnableCustomPrice] = useState(false);
  const [customPrice, setCustomPrice] = useState<number>(calculatedTotal);
  const [discountReason, setDiscountReason] = useState("");

  // Step 4: Guarantee, Deposit & Reservation Status
  const [reservationStatus, setReservationStatus] = useState<"CONFIRMEE" | "OPTION">(
    bookingMode === "PHONE_CALL_OPTION" ? "OPTION" : "CONFIRMEE",
  );
  const [depositAmount, setDepositAmount] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState<string>("ESPECES");
  const [notes, setNotes] = useState("");

  // Company Search API hook
  useEffect(() => {
    if (!isCompanyBilling || !companySearch.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompanies([]);
      return;
    }
    const timer = setTimeout(() => {
      searchCompanies(companySearch.trim())
        .then(setCompanies)
        .catch(() => setCompanies([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [isCompanyBilling, companySearch]);

  const finalTotal = enableCustomPrice ? customPrice : calculatedTotal;

  const handleFinalSubmit = (overrideStatus?: "OPTION" | "CONFIRMEE") => {
    if (!guestSelection) return;
    if (!roomId) return;

    const effectiveStatus = overrideStatus || reservationStatus;

    const sourceData = {
      notes: notes.trim() || (bookingMode === "PHONE_CALL_OPTION" ? "Prise de réservation par téléphone (Option / Pré-réservation)" : undefined),
      addons: selectedAddons,
      depositAmount: Number(depositAmount) || 0,
      paymentMethod,
      companyName: selectedCompany?.raisonSociale,
      bookingMode,
      isOption: effectiveStatus === "OPTION",
    };

    onConfirm({
      guestSelection,
      roomId,
      dateArrivee,
      dateDepart,
      canal: bookingMode === "PHONE_CALL_OPTION" ? "DIRECT" : canal,
      formule,
      sourceBrute: JSON.stringify(sourceData),
      prixTotalFinal: enableCustomPrice ? customPrice : calculatedTotal,
      motifAjustement: enableCustomPrice
        ? discountReason || "Remise commerciale"
        : undefined,
      companyId: selectedCompany?.id,
    });
  };

  const guestNameDisplay = guestSelection
    ? "guest" in guestSelection
      ? `${guestSelection.guest.nom} ${guestSelection.guest.prenom}`
      : `Client #${guestSelection.guestId}`
    : "Non spécifié";

  return (
    <div className="flex flex-col gap-5">
      {/* DIALOG HEADER & STEP PROGRESS */}
      <DialogHeader className="border-b pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="size-5 text-amber-500" />
              <span>Création de Réservation PMS</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Système de réservation guidée — Hôtel Makarim
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 font-mono text-xs">
              <Calendar className="size-3 text-primary" />
              {nights} {nights > 1 ? "Nuitées" : "Nuitée"}
            </Badge>
            {selectedRoom && (
              <Badge variant="secondary" className="text-xs">
                Ch. #{selectedRoom.numero} ({selectedRoom.roomType.nom})
              </Badge>
            )}
          </div>
        </div>

        {/* STEPPER TABS INDICATOR */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-2 border-t text-xs">
          {[
            { num: 1, label: "1. Chambre & Dates" },
            { num: 2, label: "2. Client (CRM)" },
            { num: 3, label: "3. Prestations & Tarifs" },
            { num: 4, label: "4. Confirmation" },
          ].map((s) => {
            const isActive = step === s.num;
            const isDone = step > s.num;
            return (
              <button
                type="button"
                key={s.num}
                onClick={() => {
                  if (s.num <= step || (s.num === 2 && roomId) || (s.num === 3 && guestSelection)) {
                    setStep(s.num as 1 | 2 | 3 | 4);
                  }
                }}
                className={`flex items-center gap-1.5 p-2 rounded-lg border text-left font-semibold transition-all ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                    : isDone
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                      : "border-muted bg-muted/30 text-muted-foreground opacity-70"
                }`}
              >
                <div
                  className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isDone
                      ? "bg-emerald-600 text-white"
                      : isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check className="size-3" /> : s.num}
                </div>
                <span className="truncate hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>
      </DialogHeader>

      {/* ERROR MESSAGE DISPLAY */}
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-xs font-medium">
          {error}
        </div>
      )}

      {/* STEP 1: ROOM, DATES & FLOW TYPE */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          {/* FLOW MODE TOGGLE: FAST PHONE CALL VS FULL CONFIRMED */}
          <div className="p-3.5 rounded-xl border bg-muted/20 flex flex-col gap-2">
            <Label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <PhoneCall className="size-4 text-amber-600" />
              Type de prise de réservation
            </Label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setBookingMode("PHONE_CALL_OPTION");
                  setReservationStatus("OPTION");
                  setCanal("DIRECT");
                }}
                className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                  bookingMode === "PHONE_CALL_OPTION"
                    ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30"
                    : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs flex items-center gap-1 text-amber-900 dark:text-amber-300">
                    <Phone className="size-3.5 text-amber-600" />
                    Appel Téléphonique Rapide (Option)
                  </span>
                  {bookingMode === "PHONE_CALL_OPTION" && (
                    <Badge variant="warning" className="text-[9px]">
                      Sélectionné
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Création rapide en 2 étapes pour réservation par téléphone ou pré-réservation simple.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBookingMode("FULL_CONFIRMED");
                  setReservationStatus("CONFIRMEE");
                }}
                className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                  bookingMode === "FULL_CONFIRMED"
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs flex items-center gap-1 text-foreground">
                    <ShieldCheck className="size-3.5 text-primary" />
                    Réservation Complète Confirmée
                  </span>
                  {bookingMode === "FULL_CONFIRMED" && (
                    <Badge variant="default" className="text-[9px]">
                      Sélectionné
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Workflow complet avec extras, acompte, facturation société et bon imprimable.
                </p>
              </button>
            </div>
          </div>

          {/* DATES & ROOM SELECTOR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ROOM SELECTION */}
            <div className="rounded-xl border p-4 bg-background flex flex-col gap-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-2">
                <BedDouble className="size-3.5 text-primary" />
                Sélection de la Chambre
              </h4>

              {selection ? (
                <div className="p-3 rounded-lg border bg-muted/20 text-xs flex flex-col gap-1">
                  <span className="font-bold text-sm">
                    Chambre #{selection.room.numero} — {selection.room.roomType.nom}
                  </span>
                  <p className="text-muted-foreground text-[11px]">
                    Tarif de base: {selection.room.roomType.prixBase} MAD / nuit | Capacité: {selection.room.roomType.capacite} pers
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="room-select" className="text-xs font-semibold">
                    Choisir parmi les chambres disponibles
                  </Label>
                  <select
                    id="room-select"
                    value={roomId}
                    onChange={(e) => setRoomId(Number(e.target.value))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {roomsList.map((room) => {
                      const floor = room.numero.startsWith("1")
                        ? "1er Étage"
                        : room.numero.startsWith("2")
                          ? "2ème Étage"
                          : "3ème Étage";
                      return (
                        <option key={room.id} value={room.id}>
                          Ch. #{room.numero} ({room.roomType.nom}) — {floor} —{" "}
                          {room.roomType.prixBase} MAD/nuit
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* DATES SELECTION */}
            <div className="rounded-xl border p-4 bg-background flex flex-col gap-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-2">
                <Calendar className="size-3.5 text-primary" />
                Dates du Séjour
              </h4>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="dateArrivee" className="font-medium text-[11px]">
                    Date d'arrivée
                  </Label>
                  <Input
                    id="dateArrivee"
                    type="date"
                    required
                    value={dateArrivee}
                    onChange={(e) => setDateArrivee(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="dateDepart" className="font-medium text-[11px]">
                    Date de départ
                  </Label>
                  <Input
                    id="dateDepart"
                    type="date"
                    required
                    value={dateDepart}
                    onChange={(e) => setDateDepart(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="p-2 rounded bg-muted/40 text-center font-mono text-xs text-foreground mt-1">
                Total Séjour : <strong>{nights} {nights > 1 ? "nuitées" : "nuitée"}</strong> (Du {dateArrivee} au {dateDepart})
              </div>
            </div>
          </div>

          {/* NEXT STEP BUTTON */}
          <div className="flex justify-between items-center pt-3 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => setStep(2)}
              disabled={!roomId}
              className="gap-2"
            >
              <span>Étape suivante : Client & Contact</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: GUEST & CORPORATE CRM */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border p-4 bg-background flex flex-col gap-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="size-3.5 text-primary" />
                Fiche Client (Recherche CRM ou Saisie Rapide)
              </h4>
              <Badge variant="outline" className="text-[10px]">
                {guestSelection ? "Client Sélectionné" : "Saisie requise"}
              </Badge>
            </div>

            <GuestPicker onChange={setGuestSelection} />
          </div>

          {/* CORPORATE BILLING CHECKBOX */}
          <div className="rounded-xl border p-4 bg-background flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="company-billing"
                checked={isCompanyBilling}
                onChange={(e) => {
                  setIsCompanyBilling(e.target.checked);
                  if (!e.target.checked) setSelectedCompany(null);
                }}
                className="size-4 rounded border-input"
              />
              <Label htmlFor="company-billing" className="text-xs font-bold cursor-pointer flex items-center gap-1.5">
                <Building className="size-3.5 text-indigo-600" />
                Facturation Prise en Charge par une Société / Entreprise
              </Label>
            </div>

            {isCompanyBilling && (
              <div className="p-3 bg-indigo-500/5 rounded-lg border border-indigo-500/20 flex flex-col gap-2.5 text-xs">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="company-search" className="text-[11px] font-semibold">
                    Rechercher une Entreprise
                  </Label>
                  <Input
                    id="company-search"
                    placeholder="Tapez le nom de l'entreprise..."
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>

                {companies.length > 0 && (
                  <div className="max-h-28 overflow-y-auto border rounded bg-background divide-y">
                    {companies.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => {
                          setSelectedCompany(c);
                          setCompanySearch(c.raisonSociale);
                          setCompanies([]);
                        }}
                        className="w-full p-2 text-left hover:bg-muted text-xs flex justify-between"
                      >
                        <span className="font-bold">{c.raisonSociale}</span>
                        <span className="text-muted-foreground">{c.ice || "I.C.E"}</span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedCompany && (
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded text-indigo-950 dark:text-indigo-200 font-semibold flex justify-between items-center text-xs">
                    <span>Société : {selectedCompany.raisonSociale}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => setSelectedCompany(null)}
                    >
                      Modifier
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* NAVIGATION BUTTONS WITH QUICK PHONE CALL DIRECT CREATION */}
          <div className="flex items-center justify-between pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              className="gap-2"
            >
              <ArrowLeft className="size-4" />
              <span>Précédent</span>
            </Button>

            <div className="flex items-center gap-2">
              {/* FAST PHONE CALL INSTANT VALIDATION BUTTON */}
              {bookingMode === "PHONE_CALL_OPTION" && (
                <Button
                  type="button"
                  variant="default"
                  onClick={() => handleFinalSubmit("OPTION")}
                  disabled={!guestSelection || submitting}
                  className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs text-xs"
                >
                  <PhoneCall className="size-4" />
                  <span>⚡ Valider la Pré-réservation (Option) Maintenant</span>
                </Button>
              )}

              <Button
                type="button"
                onClick={() => setStep(3)}
                disabled={!guestSelection}
                className="gap-2"
              >
                <span>Continuer : Prestations & Tarification</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: ADDONS & PRICING */}
      {step === 3 && (
        <div className="flex flex-col gap-5">
          {/* CANAL & FORMULE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border p-4 bg-background flex flex-col gap-2 text-xs">
              <Label className="font-bold text-muted-foreground uppercase text-[10px]">
                Canal de Réservation
              </Label>
              <select
                value={canal}
                onChange={(e) => setCanal(e.target.value as CanalReservation)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="DIRECT">Téléphone / Direct Réception</option>
                <option value="WALK_IN">Walk-In Réception</option>
                <option value="BOOKING_COM">Booking.com / OTA</option>
              </select>
            </div>

            <div className="rounded-xl border p-4 bg-background flex flex-col gap-2 text-xs">
              <Label className="font-bold text-muted-foreground uppercase text-[10px]">
                Formule d'Hébergement
              </Label>
              <select
                value={formule}
                onChange={(e) => setFormule(e.target.value as FormuleHebergement)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="BED_AND_BREAKFAST">Chambre & Petit-Déjeuner (B&B)</option>
                <option value="LOGEMENT_SEUL">Logement Seul</option>
                <option value="DEMI_PENSION">Demi-Pension (Repas inclus)</option>
                <option value="PENSION_COMPLETE">Pension Complète</option>
              </select>
            </div>
          </div>

          {/* PRESTATIONS & ADDONS */}
          <div className="rounded-xl border p-4 bg-background flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">
              Prestations Annexes & Options
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {ADDON_OPTIONS.map((addon) => {
                const isChecked = selectedAddons.includes(addon.id);
                return (
                  <label
                    key={addon.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isChecked
                        ? "border-emerald-500 bg-emerald-500/10 font-semibold"
                        : "border-border hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAddons([...selectedAddons, addon.id]);
                          } else {
                            setSelectedAddons(selectedAddons.filter((id) => id !== addon.id));
                          }
                        }}
                        className="size-4 rounded border-input"
                      />
                      <span>{addon.label}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {addon.pricePerNight ? `+${addon.pricePerNight} MAD/nuit` : `+${addon.flatPrice} MAD`}
                    </Badge>
                  </label>
                );
              })}
            </div>
          </div>

          {/* FINANCIAL SUMMARY & CUSTOM DISCOUNT */}
          <div className="rounded-xl border p-4 bg-muted/20 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Receipt className="size-4 text-emerald-600" />
                Ajustement Tarifaire Commercial
              </h4>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enable-discount"
                  checked={enableCustomPrice}
                  onChange={(e) => setEnableCustomPrice(e.target.checked)}
                  className="size-4 rounded border-input"
                />
                <Label htmlFor="enable-discount" className="text-xs cursor-pointer font-medium">
                  Appliquer un prix personnalisé / Remise
                </Label>
              </div>
            </div>

            {enableCustomPrice && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-background p-3 rounded-lg border">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="custom-price" className="font-semibold text-xs">
                    Nouveau Prix Final TTC (MAD)
                  </Label>
                  <Input
                    id="custom-price"
                    type="number"
                    min={0}
                    value={customPrice}
                    onChange={(e) => setCustomPrice(Number(e.target.value))}
                    className="h-8 font-bold text-emerald-700"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="discount-reason" className="font-semibold text-xs">
                    Motif de la remise (Audité)
                  </Label>
                  <Input
                    id="discount-reason"
                    placeholder="Geste commercial, tarif groupe..."
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-slate-900 text-white rounded-lg font-bold text-sm">
              <span>Décompte Estimé TTC ({nights} nuitées) :</span>
              <span className="text-amber-400 font-mono text-base">
                {finalTotal.toLocaleString("fr-MA")} MAD
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(2)}
              className="gap-2"
            >
              <ArrowLeft className="size-4" />
              <span>Précédent</span>
            </Button>
            <Button type="button" onClick={() => setStep(4)} className="gap-2">
              <span>Étape suivante : Finalisation & Acompte</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: GUARANTEE, DEPOSIT & CONFIRMATION */}
      {step === 4 && (
        <div className="flex flex-col gap-5">
          {/* STATUS SELECTOR: CONFIRMED VS OPTION */}
          <div className="rounded-xl border p-4 bg-background flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">
              Statut de la Réservation & Garantie
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <label
                className={`p-3 rounded-lg border cursor-pointer flex flex-col gap-1 ${
                  reservationStatus === "CONFIRMEE"
                    ? "border-emerald-600 bg-emerald-500/10 font-bold text-emerald-950 dark:text-emerald-300"
                    : "border-border hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="res-status"
                    checked={reservationStatus === "CONFIRMEE"}
                    onChange={() => setReservationStatus("CONFIRMEE")}
                    className="size-4"
                  />
                  <span>Réservation Confirmée</span>
                </div>
                <p className="text-[10.5px] text-muted-foreground font-normal">
                  Chambre définitivement bloquée avec garantie ou acompte versé.
                </p>
              </label>

              <label
                className={`p-3 rounded-lg border cursor-pointer flex flex-col gap-1 ${
                  reservationStatus === "OPTION"
                    ? "border-amber-600 bg-amber-500/10 font-bold text-amber-950 dark:text-amber-300"
                    : "border-border hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="res-status"
                    checked={reservationStatus === "OPTION"}
                    onChange={() => setReservationStatus("OPTION")}
                    className="size-4"
                  />
                  <span>Pré-réservation (Option)</span>
                </div>
                <p className="text-[10.5px] text-muted-foreground font-normal">
                  Pose d'option temporaire en attente de confirmation du client.
                </p>
              </label>
            </div>
          </div>

          {/* DEPOSIT & PAYMENT METHOD */}
          <div className="rounded-xl border p-4 bg-background flex flex-col gap-3 text-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-2 flex items-center gap-1.5">
              <CreditCard className="size-3.5 text-emerald-600" />
              Acompte Reçu à la Réservation
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="deposit" className="font-semibold text-xs">
                  Montant de l'acompte (MAD)
                </Label>
                <Input
                  id="deposit"
                  type="number"
                  min={0}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0 MAD"
                  className="h-9 font-bold text-emerald-700 text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pay-method" className="font-semibold text-xs">
                  Mode de règlement de l'acompte
                </Label>
                <select
                  id="pay-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="ESPECES">Espèces (MAD)</option>
                  <option value="CARTE_BANCAIRE">Carte Bancaire (CMI / Visa / MC)</option>
                  <option value="VIREMENT">Virement Bancaire</option>
                  <option value="CHEQUE">Chèque Bancaire</option>
                </select>
              </div>
            </div>
          </div>

          {/* REMARKS / RECEPTION NOTES */}
          <div className="rounded-xl border p-4 bg-background flex flex-col gap-2 text-xs">
            <Label htmlFor="notes" className="font-semibold text-xs">
              Remarques et consignes de Réception (Optionnel)
            </Label>
            <textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ex: Arrivée tardive vers 22h, lit bébé demandé..."
              className="w-full rounded-md border border-input bg-background p-2.5 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* RECAP CARD BEFORE FINAL CONFIRMATION */}
          <div className="p-4 rounded-xl border bg-slate-900 text-white flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <span className="font-bold flex items-center gap-1.5 text-amber-400">
                <CheckCircle2 className="size-4" />
                Récapitulatif de la Réservation
              </span>
              <Badge variant="outline" className="text-white border-slate-600">
                {reservationStatus === "CONFIRMEE" ? "Confirmée" : "Pré-réservation (Option)"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
              <div>
                <span>Client : </span>
                <strong className="text-white">{guestNameDisplay}</strong>
              </div>
              <div>
                <span>Chambre : </span>
                <strong className="text-white">Ch. #{selectedRoom?.numero} ({selectedRoom?.roomType.nom})</strong>
              </div>
              <div>
                <span>Période : </span>
                <strong className="text-white">{dateArrivee} → {dateDepart} ({nights} nuitées)</strong>
              </div>
              <div>
                <span>Montant TTC : </span>
                <strong className="text-amber-400 font-mono">{finalTotal.toLocaleString("fr-MA")} MAD</strong>
              </div>
            </div>
          </div>

          {/* FINAL SUBMIT BUTTONS */}
          <div className="flex items-center justify-between pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(3)}
              disabled={submitting}
              className="gap-2"
            >
              <ArrowLeft className="size-4" />
              <span>Précédent</span>
            </Button>

            <Button
              type="button"
              onClick={() => handleFinalSubmit()}
              disabled={submitting || !guestSelection || !roomId}
              className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 shadow-xs"
            >
              <CheckCircle2 className="size-4" />
              <span>{submitting ? "Enregistrement en cours…" : "Valider et Créer la Réservation"}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
