// Accélérateur post-commit de la validation HousekeepingTask. La source de
// vérité est le registre HousekeepingStockConsumption créé dans la transaction
// de validation : l'événement peut être rejoué ou perdu sans compromettre
// l'idempotence durable.
export class NettoyageValideEvent {
  constructor(
    public readonly housekeepingTaskId: number,
    public readonly cycle: number,
  ) {}
}
