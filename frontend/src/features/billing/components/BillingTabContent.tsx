import { useCallback, useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { listFoliosByStay, generateInvoice, downloadInvoicePdf } from '../api';
import { RecordPaymentDialog } from '@/features/payments/components/RecordPaymentDialog';
import { InvoicePrintModal } from './InvoicePrintModal';
import { AddFolioLineDialog } from './AddFolioLineDialog';
import type { Folio, Invoice } from '../types';

const TYPE_LIGNE_LABEL: Record<string, string> = {
  HEBERGEMENT: 'Hébergement',
  EXTRA: 'Extra',
  TAXE_SEJOUR: 'Taxe de séjour',
  PAIEMENT: 'Paiement',
};

const STATUT_FACTURE_LABEL: Record<string, string> = {
  EMISE: 'Émise',
  ANNULEE_PAR_AVOIR: 'Annulée par avoir',
};

export interface BillingTabContentProps {
  stayId: number;
  // CH-042 — l'aperçu imprimable a besoin de l'identité du client et de la
  // chambre, que ce composant n'a jamais chargées lui-même (le folio ne les
  // porte pas). Le parent (StayDetailsDialog) les a déjà via `stay` — plus
  // simple à faire transiter en props qu'un nouvel appel réseau dédié.
  guest?: { nom: string; prenom: string; email?: string | null };
  room?: { numero: string; roomType: { nom: string } };
}

export function BillingTabContent({
  stayId,
  guest,
  room,
}: BillingTabContentProps) {
  const [folios, setFolios] = useState<Folio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<number | null>(
    null,
  );
  const [payingFolioId, setPayingFolioId] = useState<number | null>(null);
  const [addingLineFolioId, setAddingLineFolioId] = useState<number | null>(
    null,
  );
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<
    number | null
  >(null);
  const [printingInvoice, setPrintingInvoice] = useState<{
    invoice: Invoice;
    folio: Folio;
  } | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFolios(await listFoliosByStay(stayId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [stayId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  async function handleGenerateInvoice(folioId: number) {
    setGeneratingInvoiceId(folioId);
    try {
      await generateInvoice(folioId);
      await refetch();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur de génération de facture',
      );
    } finally {
      setGeneratingInvoiceId(null);
    }
  }

  async function handleDownloadPdf(invoiceId: number) {
    setDownloadingInvoiceId(invoiceId);
    try {
      await downloadInvoicePdf(invoiceId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur de téléchargement PDF',
      );
    } finally {
      setDownloadingInvoiceId(null);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Chargement…</p>;
  }

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  if (folios.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Aucun folio pour ce séjour.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {folios.map((folio) => (
        <div key={folio.id} className="rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium">{folio.libelle}</h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={folio.invoices.some((i) => i.statut === 'EMISE')}
                title={
                  folio.invoices.some((i) => i.statut === 'EMISE')
                    ? "Impossible : une facture active existe déjà sur ce folio, elle n'inclurait jamais cette charge"
                    : undefined
                }
                onClick={() => setAddingLineFolioId(folio.id)}
              >
                Ajouter une charge
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPayingFolioId(folio.id)}
              >
                Encaisser un paiement
              </Button>
            </div>
          </div>

          {/* Lignes du folio */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              Lignes
            </p>
            <div className="mt-2 space-y-1">
              {folio.lignes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune ligne</p>
              ) : (
                folio.lignes.map((ligne) => (
                  <div
                    key={ligne.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {TYPE_LIGNE_LABEL[ligne.type] || ligne.type}
                    </span>
                    <span className="font-mono">
                      {Number(ligne.montant).toFixed(2)} MAD
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Factures */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              Factures
            </p>
            {folio.invoices.length === 0 ? (
              <Button
                size="sm"
                onClick={() => handleGenerateInvoice(folio.id)}
                disabled={generatingInvoiceId === folio.id}
                className="mt-2"
              >
                Générer une facture
              </Button>
            ) : (
              <div className="mt-2 space-y-2">
                {folio.invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between rounded bg-gray-50 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">
                        {invoice.numero}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {STATUT_FACTURE_LABEL[invoice.statut] || invoice.statut}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold">
                        {Number(invoice.montantTotal).toFixed(2)} MAD
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        title="Télécharger la facture en PDF"
                        disabled={downloadingInvoiceId === invoice.id}
                        onClick={() => handleDownloadPdf(invoice.id)}
                      >
                        <Download className="size-4" />
                      </Button>
                      {guest && room && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title="Imprimer la facture"
                          onClick={() => setPrintingInvoice({ invoice, folio })}
                        >
                          <Printer className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {payingFolioId !== null && (
        <RecordPaymentDialog
          open
          folioId={payingFolioId}
          onClose={() => setPayingFolioId(null)}
          onRecorded={() => {
            setPayingFolioId(null);
            void refetch();
          }}
        />
      )}

      {addingLineFolioId !== null && (
        <AddFolioLineDialog
          open
          folioId={addingLineFolioId}
          onClose={() => setAddingLineFolioId(null)}
          onAdded={() => {
            setAddingLineFolioId(null);
            void refetch();
          }}
        />
      )}

      {guest && room && (
        <InvoicePrintModal
          open={printingInvoice !== null}
          onClose={() => setPrintingInvoice(null)}
          invoice={printingInvoice?.invoice ?? null}
          folio={printingInvoice?.folio ?? { libelle: '', lignes: [] }}
          guest={guest}
          room={room}
        />
      )}
    </div>
  );
}
