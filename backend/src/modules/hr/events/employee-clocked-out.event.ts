// Émis par AttendanceService.terminer() une fois le TimeShift scellé
// (statut TERMINE, endedAt renseigné). Symétrique à EmployeeClockedInEvent
// (docs/events/EVENT_CATALOG.md §3.4).
export class EmployeeClockedOutEvent {
  constructor(
    public readonly employeeId: number,
    public readonly timeShiftId: number,
    public readonly endedAt: Date,
    public readonly userId?: number,
  ) {}
}
