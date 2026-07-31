// Numérotation séquentielle basée sur l'id réel (même convention que
// generateInvoiceNumber, backend/src/modules/billing/utils/invoice-calc.ts)
// — créer d'abord la ligne pour obtenir un id, puis réécrire numero.
export function generatePurchaseOrderNumber(purchaseOrderId: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `BC-${year}${month}-${String(purchaseOrderId).padStart(6, '0')}`;
}
