// ARCH-011A — abstraction UNIQUE pour résoudre "aujourd'hui" dans le fuseau
// horaire de l'hôtel (jamais le fuseau du navigateur client, jamais l'UTC
// implicite du serveur — voir CLAUDE.md, mission ARCH-011A). Le fuseau
// lui-même vient toujours de HotelConfig.timezone (façade
// ParametersService.getHotelConfig(), jamais codé en dur ici) ; seul le
// nom de fuseau par défaut du seed ("Africa/Casablanca") est une valeur
// concrète, jamais cette fonction.
//
// Retourne un Date "UTC minuit" représentant la date calendaire locale de
// `now` dans `timezone` — même convention de représentation que
// common/utils/date-range.ts (colonnes @db.Date comparées sans dérive de
// fuseau), pour rester comparable telle quelle à Reservation.dateArrivee /
// Stay.dateCheckoutPrevue / BusinessDay.date.
export function resolveLocalDate(
  timezone: string,
  now: Date = new Date(),
): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA -> "YYYY-MM-DD" garanti par le format ISO de cette locale.
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return new Date(Date.UTC(year, month - 1, day));
}

// Fenêtre [date, date+1) en UTC minuit — même convention que
// common/utils/date-range.ts, pour filtrer les colonnes @db.Date sur une
// journée précise (pas nécessairement "aujourd'hui").
export function dayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// Format d'idempotencyKey des NightAuditStep : "NIGHT_AUDIT:{businessDate}:{TYPE}"
// (mission ARCH-011A) — businessDate au format YYYY-MM-DD.
export function formatBusinessDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
