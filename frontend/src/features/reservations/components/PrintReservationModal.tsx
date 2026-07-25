import { useRef } from "react";
import {
  Printer,
  X,
  Building,
  User,
  BedDouble,
  CreditCard,
  Phone,
  Mail,
  ShieldCheck,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Reservation } from "../types";

interface Props {
  reservation: Reservation | null;
  onClose: () => void;
}

export function PrintReservationModal({ reservation, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!reservation) return null;

  // Parse sourceBrute for deposit, addons, notes
  let sourceData: {
    notes?: string;
    addons?: string[];
    depositAmount?: number;
    paymentMethod?: string;
    companyName?: string;
  } = {};
  if (reservation.sourceBrute) {
    try {
      sourceData = JSON.parse(reservation.sourceBrute);
    } catch {
      // ignore
    }
  }

  const nights = Math.max(
    1,
    Math.round(
      (new Date(reservation.dateDepart).getTime() -
        new Date(reservation.dateArrivee).getTime()) /
        86400000,
    ) || 1,
  );

  const totalTtc = Number(reservation.prixTotalFinal);
  const depositPaid = Number(sourceData.depositAmount || 0);
  const balanceDue = Math.max(0, totalTtc - depositPaid);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={reservation !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-w-[calc(100%-1rem)] max-h-[92vh] overflow-y-auto p-0 border-none bg-background shadow-2xl">
        {/* MODAL ACTION BAR (NOT PRINTED) */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-muted/80 backdrop-blur px-6 py-3 print:hidden">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            <span className="text-sm font-semibold text-foreground">
              Aperçu avant Impression — Voucher / Confirmation
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="default" onClick={handlePrint} className="gap-2 font-medium bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs">
              <Printer className="size-4" />
              Imprimer le Bon de Confirmation
            </Button>
            <Button size="sm" variant="outline" onClick={onClose} className="size-8 p-0 rounded-full">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* PRINTABLE VOUCHER CONTAINER */}
        <div ref={printRef} className="p-8 sm:p-10 bg-white text-slate-900 font-sans print:p-0 print:m-0 print:shadow-none">
          {/* HEADER: HOTEL BRANDING */}
          <div className="flex items-start justify-between border-b-2 border-amber-600 pb-6 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-lg bg-amber-600 flex items-center justify-center text-white font-serif font-bold text-xl shadow-xs">
                  M
                </div>
                <div>
                  <h1 className="text-xl font-serif font-bold text-slate-900 tracking-tight">
                    HÔTEL MAKARIM ****
                  </h1>
                  <p className="text-[11px] text-amber-700 font-semibold tracking-widest uppercase">
                    Luxury Hotel & Suites — Tanger / Tétouan
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Avenue Mohammed V, Tanger, Maroc | Tél: +212 5 39 94 00 00
                <br />
                Email: reservation@hotelmakarim.ma | Web: www.hotelmakarim.ma
              </p>
            </div>

            <div className="text-right flex flex-col items-end">
              <div className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-xs font-bold font-mono inline-block">
                BON DE CONFIRMATION
              </div>
              <p className="text-sm font-mono font-bold text-slate-800 mt-2">
                N° #RES-2026-{String(reservation.id).padStart(4, "0")}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Émis le : {new Date().toLocaleDateString("fr-FR")}
              </p>
              <Badge
                variant={reservation.statut === "CONFIRMEE" ? "success" : "outline"}
                className="mt-1.5 text-[10px] uppercase font-bold"
              >
                {reservation.statut === "CONFIRMEE"
                  ? "RÉSERVATION CONFIRMÉE"
                  : reservation.statut === "TRANSFORMEE_EN_SEJOUR"
                    ? "CLIENT EN SÉJOUR"
                    : "PRÉ-RÉSERVATION (OPTION)"}
              </Badge>
            </div>
          </div>

          {/* GUEST & STAY HIGHLIGHT GRID */}
          <div className="grid grid-cols-2 gap-6 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {/* GUEST INFO */}
            <div>
              <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5 mb-2">
                <User className="size-3.5 text-amber-600" />
                Informations Client
              </h3>
              <div className="space-y-1 text-xs text-slate-700">
                <p className="font-bold text-sm text-slate-900">
                  {reservation.guest.nom.toUpperCase()} {reservation.guest.prenom}
                </p>
                {reservation.guest.telephone && (
                  <p className="flex items-center gap-1 text-slate-600">
                    <Phone className="size-3 text-slate-400" />
                    <span>{reservation.guest.telephone}</span>
                  </p>
                )}
                {reservation.guest.email && (
                  <p className="flex items-center gap-1 text-slate-600">
                    <Mail className="size-3 text-slate-400" />
                    <span>{reservation.guest.email}</span>
                  </p>
                )}
                {reservation.guest.pieceIdentite && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Pièce ID / C.I.N :{" "}
                    <span className="font-mono font-semibold text-slate-800">
                      {reservation.guest.pieceIdentite}
                    </span>
                  </p>
                )}
                {sourceData.companyName && (
                  <p className="text-[11px] text-indigo-700 font-medium flex items-center gap-1 mt-1">
                    <Building className="size-3" />
                    <span>Facturation Société : {sourceData.companyName}</span>
                  </p>
                )}
              </div>
            </div>

            {/* STAY DATES & ROOM */}
            <div>
              <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5 mb-2">
                <BedDouble className="size-3.5 text-amber-600" />
                Détails du Séjour
              </h3>
              <div className="space-y-1 text-xs text-slate-700">
                <p className="font-bold text-slate-900">
                  Chambre #{reservation.room.numero} — {reservation.room.roomType.nom}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2 pt-1 border-t border-slate-200/80 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Arrivée (Check-in)</span>
                    <span className="font-bold text-slate-900">
                      {new Date(reservation.dateArrivee).toLocaleDateString("fr-FR", {
                        weekday: "short",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-[10px] text-slate-500 block">À partir de 15:00</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Départ (Check-out)</span>
                    <span className="font-bold text-slate-900">
                      {new Date(reservation.dateDepart).toLocaleDateString("fr-FR", {
                        weekday: "short",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-[10px] text-slate-500 block">Jusqu'à 12:00</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] font-medium bg-amber-100/60 text-amber-950 px-2.5 py-1 rounded">
                  <span>Durée : {nights} {nights > 1 ? "nuitées" : "nuitée"}</span>
                  <span className="capitalize">Canal : {reservation.canal.toLowerCase()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* FINANCIAL ITEMIZED TABLE */}
          <div className="mb-6">
            <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <CreditCard className="size-3.5 text-amber-600" />
              Décompte Financier et Prestations (TTC)
            </h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-left border-b border-slate-300">
                  <th className="py-2 px-3 font-semibold">Désignation</th>
                  <th className="py-2 px-3 font-semibold text-center">Qté / Nuitées</th>
                  <th className="py-2 px-3 font-semibold text-right">Tarif Unitaire</th>
                  <th className="py-2 px-3 font-semibold text-right">Total MAD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                <tr>
                  <td className="py-2 px-3 font-medium">
                    Hébergement Chambre #{reservation.room.numero} ({reservation.room.roomType.nom})
                  </td>
                  <td className="py-2 px-3 text-center">{nights} nuit(s)</td>
                  <td className="py-2 px-3 text-right">
                    {Number(reservation.room.roomType.prixBase).toLocaleString("fr-MA")} MAD
                  </td>
                  <td className="py-2 px-3 text-right font-semibold">
                    {(Number(reservation.room.roomType.prixBase) * nights).toLocaleString("fr-MA")} MAD
                  </td>
                </tr>

                {sourceData.addons?.includes("breakfast") && (
                  <tr>
                    <td className="py-2 px-3">Petit-déjeuner Buffet Extra</td>
                    <td className="py-2 px-3 text-center">{nights} nuit(s)</td>
                    <td className="py-2 px-3 text-right">80 MAD</td>
                    <td className="py-2 px-3 text-right font-semibold">
                      {(80 * nights).toLocaleString("fr-MA")} MAD
                    </td>
                  </tr>
                )}

                {sourceData.addons?.includes("city_tax") && (
                  <tr>
                    <td className="py-2 px-3">Taxe de Séjour Municipale Officielle</td>
                    <td className="py-2 px-3 text-center">{nights} nuit(s)</td>
                    <td className="py-2 px-3 text-right">15 MAD / pers</td>
                    <td className="py-2 px-3 text-right font-semibold">
                      {(15 * nights).toLocaleString("fr-MA")} MAD
                    </td>
                  </tr>
                )}

                {sourceData.addons?.includes("shuttle") && (
                  <tr>
                    <td className="py-2 px-3">Navette VIP Aéroport Tanger/Tétouan</td>
                    <td className="py-2 px-3 text-center">1 Forfait</td>
                    <td className="py-2 px-3 text-right">250 MAD</td>
                    <td className="py-2 px-3 text-right font-semibold">250 MAD</td>
                  </tr>
                )}

                {sourceData.addons?.includes("extra_bed") && (
                  <tr>
                    <td className="py-2 px-3">Lit Supplémentaire Adulte / Enfant</td>
                    <td className="py-2 px-3 text-center">{nights} nuit(s)</td>
                    <td className="py-2 px-3 text-right">120 MAD</td>
                    <td className="py-2 px-3 text-right font-semibold">
                      {(120 * nights).toLocaleString("fr-MA")} MAD
                    </td>
                  </tr>
                )}

                {reservation.ajustementManuel && (
                  <tr className="bg-amber-50 text-amber-900 italic">
                    <td colSpan={3} className="py-2 px-3">
                      Ajustement Tarifaire / Remise Accordée ({reservation.motifAjustement || "Remise commerciale"})
                    </td>
                    <td className="py-2 px-3 text-right font-bold">Inclus</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-900 bg-slate-900 text-white font-bold text-sm">
                  <td colSpan={3} className="py-2.5 px-3 text-right uppercase">
                    Montant Total Général TTC :
                  </td>
                  <td className="py-2.5 px-3 text-right text-amber-400 font-mono text-base">
                    {totalTtc.toLocaleString("fr-MA")} MAD
                  </td>
                </tr>
                {depositPaid > 0 && (
                  <tr className="bg-emerald-50 text-emerald-950 font-semibold text-xs border-t border-emerald-200">
                    <td colSpan={3} className="py-2 px-3 text-right">
                      Acompte reçu ({sourceData.paymentMethod || "Espèces"}) :
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-700">
                      - {depositPaid.toLocaleString("fr-MA")} MAD
                    </td>
                  </tr>
                )}
                <tr className="bg-slate-100 font-bold text-xs border-t border-slate-300">
                  <td colSpan={3} className="py-2 px-3 text-right text-slate-700">
                    Solde restant à régler à l'arrivée (Check-in) :
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-slate-900 text-sm">
                    {balanceDue.toLocaleString("fr-MA")} MAD
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* REMARQUES & CONDITIONS D'HÔTELLERIE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px] text-slate-600 border-t border-slate-200 pt-4 mb-6">
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-amber-600" />
                Conditions Générales de Séjour
              </h4>
              <ul className="list-disc pl-4 space-y-0.5 text-[10.5px]">
                <li>
                  Présentation obligatoire d'une pièce d'identité originale valide (C.I.N ou Passeport) au check-in selon la réglementation policière marocaine.
                </li>
                <li>
                  Arrivée à partir de 15h00 | Départ au plus tard à 12h00.
                </li>
                <li>
                  Annulation sans frais jusqu'à 48 heures avant la date d'arrivée prévue.
                </li>
              </ul>
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1">
                <Clock className="size-3.5 text-amber-600" />
                Services & Remarques
              </h4>
              <p className="text-[10.5px]">
                Petit-déjeuner servi en salle de 07h00 à 10h30. Connexion Wi-Fi haute vitesse gratuite disponible dans tout l'établissement.
              </p>
              {sourceData.notes && (
                <p className="mt-1 p-2 bg-amber-50 text-amber-900 rounded border border-amber-200 text-[10px] italic">
                  Note : {sourceData.notes}
                </p>
              )}
            </div>
          </div>

          {/* FOOTER & SIGNATURE STAMP */}
          <div className="flex items-end justify-between border-t border-slate-200 pt-6">
            <div className="text-[10px] text-slate-400">
              <p>Hôtel Makarim SARL — R.C. 45892 Tanger — Patente 1284920</p>
              <p>Document généré électroniquement par le PMS Hôtel Makarim</p>
            </div>
            <div className="text-center w-44">
              <div className="h-12 border-b border-dashed border-slate-300 flex items-center justify-center text-slate-300 text-[10px] italic">
                Cachet & Signature Réception
              </div>
              <p className="text-[10px] font-semibold text-slate-500 mt-1">
                La Réception — Hôtel Makarim
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
