// Toutes les dates manipulées ici sont des "jours calendaires" purs (sans
// heure), alignés sur la convention UTC déjà utilisée côté backend
// (Reservation.dateArrivee/dateDepart en @db.Date, voir getNightsBetween).
// On reste volontairement en UTC de bout en bout pour éviter tout décalage
// d'un jour selon le fuseau du poste (ex. Africa/Casablanca = UTC+1) — la
// notion de fuseau horaire de l'hôtel viendra avec HotelConfig (module core).

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export function getDateRange(start: Date, days: number): Date[] {
  return Array.from({ length: days }, (_, i) => addDays(start, i));
}

export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b);
}

export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function getVisibleReservationSpan(
  dateArrivee: string,
  dateDepart: string,
  days: Date[],
): { startIndex: number; span: number } | null {
  if (days.length === 0) return null;

  const arrivee = startOfDay(new Date(dateArrivee));
  const depart = startOfDay(new Date(dateDepart));
  const firstVisibleDay = days[0];
  const lastVisibleBoundary = addDays(days[days.length - 1], 1);
  if (depart <= firstVisibleDay || arrivee >= lastVisibleBoundary) return null;

  const startIndex = Math.max(
    0,
    days.findIndex((day) => day >= arrivee),
  );
  let span = 0;
  for (
    let index = startIndex;
    index < days.length && days[index] < depart;
    index++
  ) {
    span++;
  }
  return span > 0 ? { startIndex, span } : null;
}
