// Émis par HousekeepingService.updateStatus() spécifiquement pour la
// transition A_NETTOYER|EN_NETTOYAGE → LIBRE_PROPRE (BR-STK-001). Cette
// transition est, dans l'implémentation actuelle (Sprint 9 simplifié —
// aucune entité HousekeepingTask, voir DATA_DICTIONARY.md Gap #3), le seul
// signal disponible équivalent à la validation `CONTROLEE` décrite par
// BR-HK-002/003 : c'est elle qui rend la chambre à nouveau vendable.
export class NettoyageValideEvent {
  constructor(
    public readonly roomId: number,
    public readonly capaciteChambre: number,
    public readonly userId?: number,
  ) {}
}
