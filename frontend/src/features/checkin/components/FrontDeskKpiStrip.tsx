import { AlertTriangle, BedDouble, LogIn, LogOut } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';

interface Props {
  /** GET /reservations/arrivees-du-jour (déjà filtré CONFIRMEE + aujourd'hui côté serveur). */
  arriveesAujourdhui: number;
  /** Même définition que l'ancienne alerte "fiche police manquante" de
   * CheckinPage.tsx (production précédente) : fiche de police (registre
   * légal DGSN) manquante, cumulée sur séjours en cours + départs du jour.
   * Libellé volontairement plus explicite que "À traiter" (mission
   * DESIGN-009). */
  fichesPoliceACompleter: number;
  /** GET /stays/en-cours .length (Stay.statut = EN_COURS). */
  sejoursEnCours: number;
  /** GET /stays/departs-du-jour .length. */
  departsAujourdhui: number;
}

// DESIGN-009 — bande de 4 indicateurs dérivés côté client des données déjà
// chargées par la page (aucun nouveau calcul serveur, aucun nouvel
// endpoint) — même convention que HousekeepingKpiStrip (DESIGN-008).
export function FrontDeskKpiStrip({
  arriveesAujourdhui,
  fichesPoliceACompleter,
  sejoursEnCours,
  departsAujourdhui,
}: Props) {
  return (
    <div
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
      aria-label="Indicateurs Front Desk"
    >
      <KpiCard
        label="Arrivées aujourd'hui"
        value={String(arriveesAujourdhui)}
        hint="Réservations confirmées, arrivée aujourd'hui"
        icon={LogIn}
        tone="primary"
      />
      <KpiCard
        label="Fiches police à compléter"
        value={String(fichesPoliceACompleter)}
        hint="Registre légal DGSN manquant (séjours en cours + départs)"
        icon={AlertTriangle}
        tone={fichesPoliceACompleter > 0 ? 'warning' : 'neutral'}
      />
      <KpiCard
        label="Séjours en cours"
        value={String(sejoursEnCours)}
        hint="Stay.statut = EN_COURS"
        icon={BedDouble}
        tone="success"
      />
      <KpiCard
        label="Départs aujourd'hui"
        value={String(departsAujourdhui)}
        hint="Départ prévu aujourd'hui"
        icon={LogOut}
        tone={departsAujourdhui > 0 ? 'warning' : 'neutral'}
      />
    </div>
  );
}
