interface StockItemLike {
  quantiteDisponible: number;
  seuilAlerte: number;
}

// BR-STK-002 : un article est en alerte dès que la quantité disponible
// descend À OU SOUS son seuil (<=, pas <) — fonction pure, testée
// isolément (même pattern que hr/utils/calculer-retenues.util.ts).
export function estSousSeuilAlerte(item: StockItemLike): boolean {
  return item.quantiteDisponible <= item.seuilAlerte;
}
