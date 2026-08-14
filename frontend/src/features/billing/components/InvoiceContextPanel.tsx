import { useEffect, useState } from 'react';
import { Download, Printer, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyDisplay } from '@/components/ui/money-display';
import { toastManager } from '@/components/ui/toast';
import {
  createCreditNote,
  downloadInvoicePdf,
  getInvoice,
  requestInvoiceDelivery,
} from '../api';
import type { InvoiceDetail } from '../types';
import { InvoicePrintModal } from './InvoicePrintModal';

const TYPE_LIGNE_LABEL: Record<string, string> = {
  HEBERGEMENT: 'Hébergement',
  EXTRA: 'Extra',
  RESTAURANT: 'Restaurant',
  TAXE_SEJOUR: 'Taxe de séjour',
  PAIEMENT: 'Paiement',
  AJUSTEMENT_HAUSSE: 'Ajustement (hausse)',
  AJUSTEMENT_BAISSE: 'Ajustement (baisse)',
};

interface Props {
  invoiceId: number | null;
  onClose: () => void;
  canWrite: boolean;
  // DESIGN-010 (correction RBAC finale suite) — billing:send, permission
  // dédiée indépendante de billing:write (seed.ts, rôle Réception).
  canSend: boolean;
  onChanged: () => void;
}

// DESIGN-010 (mission §14, corrigé §RBAC finale suite) — panneau facture :
// résumé client/séjour/chambre/période, lignes (signe "-" explicite sur
// AJUSTEMENT_BAISSE, même convention que invoice.pdf.ts), bandeau "figée",
// actions PDF/Imprimer (lecture pure) / Envoyer (billing:send) / Créer
// avoir (billing:write ET statut EMISE).
export function InvoiceContextPanel({
  invoiceId,
  onClose,
  canWrite,
  canSend,
  onChanged,
}: Props) {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [avoirOpen, setAvoirOpen] = useState(false);
  const [avoirMotif, setAvoirMotif] = useState('');
  const [avoirSubmitting, setAvoirSubmitting] = useState(false);

  useEffect(() => {
    if (invoiceId === null) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setInvoice(null);
    getInvoice(invoiceId)
      .then((data) => {
        if (!cancelled) setInvoice(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur de chargement');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  async function handleDownload() {
    if (!invoice) return;
    setDownloading(true);
    try {
      await downloadInvoicePdf(invoice.id);
    } catch (err) {
      toastManager.add({
        title: 'Erreur de téléchargement',
        description: err instanceof Error ? err.message : 'Erreur inconnue',
        type: 'error',
      });
    } finally {
      setDownloading(false);
    }
  }

  async function handleSend() {
    if (!invoice) return;
    setSending(true);
    try {
      await requestInvoiceDelivery(invoice.id);
      toastManager.add({
        title: 'Envoi demandé',
        description:
          'La facture sera envoyée par email/WhatsApp selon les canaux configurés — voir le journal de notifications pour le résultat.',
      });
    } catch (err) {
      toastManager.add({
        title: "Erreur d'envoi",
        description: err instanceof Error ? err.message : 'Erreur inconnue',
        type: 'error',
      });
    } finally {
      setSending(false);
    }
  }

  async function handleCreateCreditNote() {
    if (!invoice || avoirMotif.length < 10) return;
    setAvoirSubmitting(true);
    try {
      await createCreditNote(invoice.id, avoirMotif);
      toastManager.add({
        title: 'Avoir créé',
        description: `Facture ${invoice.numero} annulée par avoir (montant total).`,
        type: 'success',
      });
      setAvoirOpen(false);
      setAvoirMotif('');
      onChanged();
      // Recharge la facture pour refléter le nouveau statut immédiatement
      // dans ce même panneau (jamais un état périmé après un avoir).
      const refreshed = await getInvoice(invoice.id);
      setInvoice(refreshed);
    } catch (err) {
      toastManager.add({
        title: "Erreur de création de l'avoir",
        description: err instanceof Error ? err.message : 'Erreur inconnue',
        type: 'error',
      });
    } finally {
      setAvoirSubmitting(false);
    }
  }

  const open = invoiceId !== null;

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {invoice ? `Facture ${invoice.numero}` : 'Facture'}
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <p className="text-muted-foreground text-sm">Chargement…</p>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}

          {invoice && (
            <div className="flex flex-col gap-4">
              {invoice.statut === 'EMISE' && (
                <div
                  role="status"
                  className="border-warning/40 bg-warning/10 text-warning rounded-md border p-3 text-sm"
                >
                  Cette facture est figée. Toute correction nécessite un avoir
                  puis une nouvelle facture.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs font-semibold uppercase">
                    Client
                  </p>
                  <p className="font-medium">
                    {invoice.folio.stay.guest.nom}{' '}
                    {invoice.folio.stay.guest.prenom}
                  </p>
                  {invoice.folio.stay.guest.email && (
                    <p className="text-muted-foreground text-xs">
                      {invoice.folio.stay.guest.email}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs font-semibold uppercase">
                    Séjour
                  </p>
                  <p className="font-medium">
                    Chambre {invoice.folio.stay.room.numero} (
                    {invoice.folio.stay.room.roomType.nom})
                  </p>
                  <p className="text-muted-foreground text-xs">
                    #{invoice.folio.stay.id} — émise le{' '}
                    {new Date(invoice.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    invoice.statut === 'EMISE' ? 'success' : 'destructive'
                  }
                >
                  {invoice.statut === 'EMISE' ? 'Émise' : 'Annulée par avoir'}
                </Badge>
              </div>

              <div>
                <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                  Lignes
                </p>
                <div className="flex flex-col gap-1 text-sm">
                  {invoice.folio.lignes
                    .filter((l) => !l.annulee && l.type !== 'PAIEMENT')
                    .map((ligne) => (
                      <div
                        key={ligne.id}
                        className="flex items-center justify-between border-b py-1 last:border-0"
                      >
                        <span>
                          {ligne.libelle}
                          <span className="text-muted-foreground ml-2 text-xs">
                            ({TYPE_LIGNE_LABEL[ligne.type] ?? ligne.type})
                          </span>
                        </span>
                        <span className="font-mono">
                          {ligne.type === 'AJUSTEMENT_BAISSE' ? '-' : ''}
                          {Number(ligne.montant).toFixed(2)} MAD
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="flex justify-end">
                <div className="flex w-56 flex-col gap-1 text-sm">
                  <div className="flex justify-between border-t pt-2 text-base font-bold">
                    <span>Total TTC</span>
                    <MoneyDisplay value={invoice.montantTotal} />
                  </div>
                  {invoice.payments.length > 0 && (
                    <div className="text-muted-foreground flex justify-between">
                      <span>Paiements liés</span>
                      <MoneyDisplay
                        value={invoice.payments
                          .reduce((acc, p) => acc + Number(p.montant), 0)
                          .toFixed(2)}
                      />
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={downloading}
                  onClick={() => void handleDownload()}
                >
                  <Download className="size-4" />
                  Télécharger PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setPrinting(true)}
                >
                  <Printer className="size-4" />
                  Imprimer
                </Button>
                {canSend && (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={sending}
                    onClick={() => void handleSend()}
                  >
                    <Send className="size-4" />
                    Envoyer
                  </Button>
                )}
                {canWrite && invoice.statut === 'EMISE' && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setAvoirOpen(true)}
                  >
                    Créer un avoir
                  </Button>
                )}
                <Button type="button" onClick={onClose}>
                  Fermer
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {invoice && (
        <InvoicePrintModal
          open={printing}
          onClose={() => setPrinting(false)}
          invoice={invoice}
          folio={invoice.folio}
          guest={invoice.folio.stay.guest}
          room={invoice.folio.stay.room}
        />
      )}

      <Dialog
        open={avoirOpen}
        onOpenChange={(next) => !next && setAvoirOpen(false)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un avoir</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Avoir total uniquement — annule la facture {invoice?.numero}, permet
            ensuite de régénérer une facture corrigée sur le même folio.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="avoir-motif">Motif (≥ 10 caractères)</Label>
            <Input
              id="avoir-motif"
              value={avoirMotif}
              onChange={(e) => setAvoirMotif(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAvoirOpen(false)}
              disabled={avoirSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={avoirMotif.length < 10 || avoirSubmitting}
              onClick={() => void handleCreateCreditNote()}
            >
              {avoirSubmitting ? 'Création…' : "Confirmer l'avoir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
