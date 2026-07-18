// Fenêtre [aujourd'hui, demain) en UTC minuit — convention utilisée dans
// tout le projet pour filtrer "aujourd'hui" sur des colonnes @db.Date
// (MySQL stocke ces colonnes sans fuseau horaire, donc comparer avec un
// Date local introduirait un décalage selon le fuseau du serveur). Centralisé
// ici car dupliqué historiquement dans reservations (arrivalsToday) et
// checkin (departsToday) — le bug UTC/local a déjà été corrigé une fois
// (module 5.4), donc toute nouvelle logique de "journée" doit réutiliser
// cette fonction plutôt que recréer sa propre version.
export function getTodayRange(): { today: Date; tomorrow: Date } {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return { today, tomorrow };
}
