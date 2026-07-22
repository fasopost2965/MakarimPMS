// Émis par StockService dès qu'un mouvement de sortie fait passer
// StockItem.quantiteDisponible à ou sous son seuilAlerte (BR-STK-002).
export class StockThresholdAlertEvent {
  constructor(
    public readonly stockItemId: number,
    public readonly code: string,
    public readonly quantiteDisponible: number,
    public readonly seuilAlerte: number,
  ) {}
}
