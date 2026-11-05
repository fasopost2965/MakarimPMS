// Utilitaires de date — tout est manipulé en ISO `YYYY-MM-DD`, jamais en
// objet Date local, pour éviter les décalages de fuseau (même discipline que
// `getTodayRange()` côté backend).

export const BASE_DATE = '2026-11-05';

export function toDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function isoAdd(iso, days) {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isoDiff(a, b) {
  return Math.round((toDate(a) - toDate(b)) / 86_400_000);
}

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function fmtCourt(iso) {
  const d = toDate(iso);
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}

export function fmtJour(iso) {
  const d = toDate(iso);
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()}`;
}

export function fmtLong(iso) {
  const d = toDate(iso);
  return `${JOURS_LONGS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS_LONGS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtHeure(date = new Date()) {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function money(n) {
  return Math.round(n).toLocaleString('fr-FR');
}

export function nuits(arrivee, depart) {
  return Math.max(1, isoDiff(depart, arrivee));
}
