// Émis par AttendanceService.demarrer() une fois le TimeShift + segment
// TRAVAIL commités (docs/events/EVENT_CATALOG.md §3.4, SPRINT_11.md
// critère d'acceptation). Consommateurs prévus : reporting (Phase 3, pas
// encore de listener), audit (déjà couvert nativement — chaque pointage
// n'est pas une "correction" au sens INV-TSH-004, donc pas de ligne
// AuditLog dédiée, seul l'événement porte la traçabilité temps réel).
export class EmployeeClockedInEvent {
  constructor(
    public readonly employeeId: number,
    public readonly timeShiftId: number,
    public readonly startedAt: Date,
    public readonly userId?: number,
  ) {}
}
