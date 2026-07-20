import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listFoliosByStay, generateInvoice } from "../api";
import type { Folio } from "../types";

const TYPE_LIGNE_LABEL: Record<string, string> = {
  HEBERGEMENT: "Hébergement",
  EXTRA: "Extra",
  TAXE_SEJOUR: "Taxe de séjour",
  PAIEMENT: "Paiement",
};

const STATUT_FACTURE_LABEL: Record<string, string> = {
  EMISE: "Émise",
  ANNULEE_PAR_AVOIR: "Annulée par avoir",
};

export interface BillingTabContentProps {
  stayId: number;
}

export function BillingTabContent({ stayId }: BillingTabContentProps) {
  const [folios, setFolios] = useState<Folio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<number | null>(
    null,
  );

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFolios(await listFoliosByStay(stayId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
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
        err instanceof Error ? err.message : "Erreur de génération de facture",
      );
    } finally {
      setGeneratingInvoiceId(null);
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
                    <span className="font-mono text-sm font-semibold">
                      {Number(invoice.montantTotal).toFixed(2)} MAD
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
