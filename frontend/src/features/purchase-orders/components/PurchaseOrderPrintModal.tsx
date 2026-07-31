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
import type { PurchaseOrder } from '../types';

const STATUT_LABEL: Record<PurchaseOrder['statut'], string> = {
  BROUILLON: 'Brouillon',
  EN_ATTENTE_VALIDATION: 'En attente de validation',
  VALIDEE: 'Validé',
  ANNULEE: 'Annulé',
};

interface Props {
  open: boolean;
  onClose: () => void;
  purchaseOrder: PurchaseOrder | null;
}

// Lot 8 (Handoff final) — aperçu imprimable calqué sur
// docs/design/design_handoff_final/screens/BonCommandeFournisseur.dc.html,
// même architecture que InvoicePrintModal.tsx (CH-042/CH-077) : iframe
// masquée réutilisant les styles de la page, aucune donnée fabriquée.
//
// Écart assumé vis-à-vis du mockup : pas de détail Sous-total/TVA (20%)
// avant le Total. Contrairement à la facture client (TaxRateConfig existe
// pour la TVA collectée sur l'hébergement/les extras), ce projet ne modélise
// aucun taux de TVA déductible sur les achats fournisseurs — inventer un
// taux fixe (comme le faisait v2 avec 10%/20% codés en dur, déjà rejeté
// pour InvoicePrintModal) aurait été la même fabrication que CLAUDE.md
// interdit. Seul un « Total HT » réel (somme des lignes) est affiché.
export function PurchaseOrderPrintModal({
  open,
  onClose,
  purchaseOrder,
}: Props) {
  const [hotelConfig, setHotelConfig] = useState<HotelConfig | null>(null);

  useEffect(() => {
    if (!open) return;
    getHotelConfig()
      .then(setHotelConfig)
      .catch(() => setHotelConfig(null));
  }, [open]);

  function handlePrint() {
    const content = document.getElementById('bon-commande-imprimable');
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
    doc.write(
      `<html><head><title>${purchaseOrder?.numero ?? 'Bon de commande'}</title>`,
    );
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

  if (!purchaseOrder) return null;

  const totalHt = purchaseOrder.lignes.reduce(
    (sum, l) => sum + Number(l.montant),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bon de commande {purchaseOrder.numero}</DialogTitle>
        </DialogHeader>

        <div id="bon-commande-imprimable" className="flex flex-col gap-6 p-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              {hotelConfig?.logoUrl && (
                <img
                  src={hotelConfig.logoUrl}
                  alt="Logo"
                  className="h-12 w-12 object-contain"
                />
              )}
              <h2 className="text-lg font-bold">
                {hotelConfig?.raisonSociale || 'Hôtel'}
              </h2>
              {hotelConfig?.adresse && (
                <p className="text-muted-foreground text-sm">
                  {hotelConfig.adresse}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-primary text-lg font-bold">BON DE COMMANDE</p>
              <p className="text-sm font-medium">N° {purchaseOrder.numero}</p>
              <p className="text-muted-foreground text-xs">
                Émis le{' '}
                {new Date(purchaseOrder.createdAt).toLocaleDateString('fr-FR')}
              </p>
              <p className="text-muted-foreground mt-1 text-xs font-bold">
                {STATUT_LABEL[purchaseOrder.statut]}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs font-semibold uppercase">
                Fournisseur
              </p>
              <p className="font-medium">{purchaseOrder.supplier.nom}</p>
              {purchaseOrder.supplier.adresse && (
                <p className="text-muted-foreground">
                  {purchaseOrder.supplier.adresse}
                </p>
              )}
              {(purchaseOrder.supplier.email ||
                purchaseOrder.supplier.telephone) && (
                <p className="text-muted-foreground">
                  {[
                    purchaseOrder.supplier.email,
                    purchaseOrder.supplier.telephone,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs font-semibold uppercase">
                Livraison
              </p>
              <p className="font-medium">
                Demandeur : {purchaseOrder.demandeur}
              </p>
              {purchaseOrder.dateLivraisonSouhaitee && (
                <p className="text-muted-foreground">
                  Livraison souhaitée avant le{' '}
                  {new Date(
                    purchaseOrder.dateLivraisonSouhaitee,
                  ).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 font-semibold">Désignation</th>
                <th className="py-2 text-right font-semibold">Qté</th>
                <th className="py-2 text-right font-semibold">PU (MAD)</th>
                <th className="py-2 text-right font-semibold">Total (MAD)</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrder.lignes.map((ligne) => (
                <tr key={ligne.id} className="border-b">
                  <td className="py-2">
                    {ligne.designation}
                    {ligne.reference && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        ({ligne.reference})
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {ligne.quantite}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {Number(ligne.prixUnitaire).toFixed(2)}
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
                <span>Total HT</span>
                <span className="font-mono">{totalHt.toFixed(2)} MAD</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-4 text-xs">
            <div>
              <p className="text-muted-foreground mb-6 font-semibold uppercase">
                Établi par (Économat)
              </p>
              <p className="border-t pt-1.5">{purchaseOrder.createdBy.nom}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-6 font-semibold uppercase">
                Validé par (Direction)
              </p>
              <p className="border-t pt-1.5">
                {purchaseOrder.validatedBy
                  ? `${purchaseOrder.validatedBy.nom} — ${new Date(
                      purchaseOrder.validatedAt!,
                    ).toLocaleDateString('fr-FR')}`
                  : '—'}
              </p>
            </div>
          </div>

          <p className="text-muted-foreground border-t pt-3 text-xs">
            Ce bon de commande engage {hotelConfig?.raisonSociale || "l'hôtel"}{' '}
            sur les quantités et prix indiqués ci-dessus.
          </p>
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
