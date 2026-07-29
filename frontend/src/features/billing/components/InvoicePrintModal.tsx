import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getHotelConfig } from '@/features/parameters/api';
import type { HotelConfig } from '@/features/parameters/types';
import type { Folio, Invoice } from '../types';

const TYPE_LIGNE_LABEL: Record<string, string> = {
  HEBERGEMENT: 'Hébergement',
  EXTRA: 'Extra',
  TAXE_SEJOUR: 'Taxe de séjour',
  PAIEMENT: 'Paiement',
};

interface Props {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  folio: Pick<Folio, 'libelle' | 'lignes'>;
  guest: { nom: string; prenom: string; email?: string | null };
  room: { numero: string; roomType: { nom: string } };
}

// CH-042 (docs/execution/PLAN_MISE_EN_PRODUCTION_BETA.md, Phase B) —
// inspiré de MakarimPMS_v2 (InvoicePrintModal.tsx) pour le principe d'un
// aperçu imprimable, mais réécrit : v2 recalculait la TVA côté client avec
// des taux codés en dur (10%/20%) et affichait des coordonnées légales
// entièrement fabriquées (téléphone, email, ICE/RC/Patente/CNSS factices)
// jamais reliées à HotelConfig — deux défauts qu'une facture réelle envoyée
// à un client ne peut pas se permettre. Ici : uniquement les champs
// réellement présents dans HotelConfig (aucun téléphone/patente/CNSS en
// base, donc jamais affichés), et aucun recalcul de TVA — Invoice.montantTotal
// est déjà le total TTC figé au moment de l'émission (ADR-004, immuable),
// seule source de vérité pour le total affiché.
export function InvoicePrintModal({
  open,
  onClose,
  invoice,
  folio,
  guest,
  room,
}: Props) {
  const [hotelConfig, setHotelConfig] = useState<HotelConfig | null>(null);

  useEffect(() => {
    if (!open) return;
    getHotelConfig()
      .then(setHotelConfig)
      .catch(() => setHotelConfig(null));
  }, [open]);

  function handlePrint() {
    const content = document.getElementById('facture-imprimable');
    if (!content) return;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(`<html><head><title>${invoice?.numero ?? 'Facture'}</title>`);
    document.head
      .querySelectorAll('style, link[rel="stylesheet"]')
      .forEach((el) => doc.write(el.outerHTML));
    doc.write(
      '<style>@page { size: A4; margin: 12mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; margin: 0; }</style>',
    );
    doc.write('</head><body>');
    doc.write(content.outerHTML);
    doc.write('</body></html>');
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 100);
    }, 400);
  }

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Facture {invoice.numero}</DialogTitle>
        </DialogHeader>

        <div id="facture-imprimable" className="flex flex-col gap-6 p-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold">
              {hotelConfig?.raisonSociale || 'Hôtel'}
            </h2>
            {hotelConfig?.adresse && (
              <p className="text-muted-foreground text-sm">
                {hotelConfig.adresse}
              </p>
            )}
            {(hotelConfig?.ice ||
              hotelConfig?.rc ||
              hotelConfig?.identifiantFiscal) && (
              <p className="text-muted-foreground text-xs">
                {[
                  hotelConfig.ice ? `ICE: ${hotelConfig.ice}` : null,
                  hotelConfig.rc ? `RC: ${hotelConfig.rc}` : null,
                  hotelConfig.identifiantFiscal
                    ? `IF: ${hotelConfig.identifiantFiscal}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' — ')}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs font-semibold uppercase">
                Facturé à
              </p>
              <p className="font-medium">
                {guest.nom} {guest.prenom}
              </p>
              {guest.email && (
                <p className="text-muted-foreground">{guest.email}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs font-semibold uppercase">
                Séjour
              </p>
              <p className="font-medium">
                Chambre {room.numero} ({room.roomType.nom})
              </p>
              <p className="text-muted-foreground">{folio.libelle}</p>
              <p className="text-muted-foreground">
                {new Date(invoice.createdAt).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 font-semibold">Description</th>
                <th className="py-2 text-right font-semibold">
                  Montant HT (MAD)
                </th>
              </tr>
            </thead>
            <tbody>
              {folio.lignes
                .filter((l) => l.type !== 'PAIEMENT' && !l.annulee)
                .map((ligne) => (
                  <tr key={ligne.id} className="border-b">
                    <td className="py-2">
                      {ligne.libelle}
                      <span className="text-muted-foreground ml-2 text-xs">
                        ({TYPE_LIGNE_LABEL[ligne.type] ?? ligne.type})
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono">
                      {Number(ligne.montant).toFixed(2)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="flex w-56 flex-col gap-1 text-sm">
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <span>Total TTC</span>
                <span className="font-mono">
                  {Number(invoice.montantTotal).toFixed(2)} MAD
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button type="button" onClick={handlePrint}>
            <Printer className="size-4" />
            Imprimer / PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
