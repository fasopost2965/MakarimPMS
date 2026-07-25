// Une "nuit" = une date d'occupation, de dateArrivee (incluse) à dateDepart
// (exclue) — convention hôtelière standard : le jour de départ n'est pas
// compté comme une nuit occupée.
export function getNightsBetween(
  dateArrivee: string | Date,
  dateDepart: string | Date,
): Date[] {
  const start = new Date(dateArrivee);
  const end = new Date(dateDepart);
  const nights: Date[] = [];

  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    nights.push(new Date(d));
  }

  return nights;
}
