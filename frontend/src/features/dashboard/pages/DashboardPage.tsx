import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  BedDouble,
  Gauge,
  LogIn,
  LogOut,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { KpiCard, KpiCardSkeleton } from '@/components/ui/kpi-card';
import { MoneyDisplay } from '@/components/ui/money-display';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getDashboardResume } from '../api';
import { listRooms } from '../../reservations/api';
import { listTickets } from '../../maintenance/api';
import type { DashboardResume } from '../types';
import type { Room } from '../../reservations/types';
import type { MaintenanceTicket } from '../../maintenance/types';
import { QuickAccessModules } from '../components/QuickAccessModules';
import { RoomsStateGrid } from '../components/RoomsStateGrid';
import { ATraiterPanel } from '../components/ATraiterPanel';
import { TodayPanel } from '../components/TodayPanel';
import { RoomContextModal } from '../components/RoomContextModal';

// DESIGN-005 (intégration Prototype D3 validée, /design-preview/d3) —
// remplace l'ancienne prévision en aire (OccupancyForecastCard, fichier
// conservé mais plus monté ici) par la présentation horizontale compacte
// validée. Recharts n'étant plus utilisé sur ce composant, ce lazy import
// reste néanmoins nécessaire pour ne charger le calcul/l'appel réseau que
// si reporting:read est accordée (même logique qu'avant ce lot).
const OperationalForecastStrip = lazy(() =>
  import('../components/OperationalForecastStrip').then((m) => ({
    default: m.OperationalForecastStrip,
  })),
);

export type DashboardTarget =
  | 'reservations'
  | 'checkin'
  | 'housekeeping'
  | 'maintenance'
  | 'restaurant'
  | 'guests';

interface Props {
  onNavigate: (target: DashboardTarget) => void;
  permissions: string[] | null;
}

function dateDuJour() {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Vue d'ensemble opérationnelle — DESIGN-005 (intégration du Prototype D3
// validé par le propriétaire produit, ce lot transplante sa composition
// dans les composants réels : header compact, Accès rapides, KPI, grille
// opérationnelle Chambres/À traiter/Aujourd'hui, prévision). Toutes les
// valeurs proviennent des mêmes endpoints REAL déjà utilisés par l'écran
// précédent (GET /dashboard/resume, GET /rooms, GET /maintenance-tickets,
// GET /reservations/arrivees-du-jour, GET /stays/departs-du-jour, GET
// /reporting/yield-forecast) : aucun indicateur inventé, aucune nouvelle
// route. RevPAR/ADR restent volontairement absents — aucun endpoint ne les
// expose.
export function DashboardPage({ onNavigate, permissions }: Props) {
  const [resume, setResume] = useState<DashboardResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [tickets, setTickets] = useState<MaintenanceTicket[] | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResume(await getDashboardResume());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => refetch());
  }, [refetch]);

  const can = (permission: string) =>
    permissions?.includes(permission) ?? false;

  // Chambres/tickets : sections non critiques (RoomsStateGrid/ATraiterPanel/
  // badges Accès rapides), échec silencieux comme les anciens widgets
  // qu'elles remplacent — jamais de bannière d'erreur pour ces deux appels,
  // seule la section correspondante reste simplement non affichée.
  const refreshRooms = useCallback(() => {
    if (!can('housekeeping:read')) return;
    listRooms()
      .then(setRooms)
      .catch(() => setRooms(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions]);

  useEffect(() => {
    refreshRooms();
  }, [refreshRooms]);

  useEffect(() => {
    if (!can('maintenance:read')) return;

    listTickets({ ouvert: true })
      .then(setTickets)
      .catch(() => setTickets(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions]);

  const urgentTickets = tickets?.filter((t) => t.priorite === 'URGENTE') ?? [];

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      {/* Header compact — une ligne (mission D3 §1), titre + contexte de
          la journée + alerte urgente + rafraîchissement. Les notifications
          réelles et le titre de page vivent déjà dans AppTopbar
          (NotificationCenter, déjà réel/fonctionnel) : pas de doublon ici. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <p className="text-muted-foreground text-[11px] font-bold tracking-[0.03em] uppercase">
            Vue opérationnelle
          </p>
          <h1 className="truncate text-xl font-extrabold tracking-[-0.01em]">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-xs first-letter:uppercase">
            · {dateDuJour()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {urgentTickets.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="size-3" />
              {urgentTickets.length} urgent
              {urgentTickets.length > 1 ? 's' : ''}
            </Badge>
          )}
          <Button
            type="button"
            variant="outline"
            className="min-h-11 shrink-0 sm:min-h-8"
            onClick={() => void refetch()}
            disabled={loading}
            aria-label="Actualiser les indicateurs"
          >
            <RefreshCw className={cn(loading && 'animate-spin')} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Accès rapides — mission D3 §2/§3 : élément majeur, immédiatement
          sous le header, avant les KPI. */}
      <QuickAccessModules
        permissions={permissions}
        resume={resume}
        onNavigate={onNavigate}
      />

      {loading && (
        <div
          aria-label="Chargement des indicateurs"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <KpiCardSkeleton key={index} />
          ))}
        </div>
      )}
      {error && !loading && (
        <ErrorState
          title="Impossible de charger les indicateurs"
          description={error}
          onRetry={() => void refetch()}
        />
      )}

      {resume && !loading && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Taux d'occupation"
            value={`${resume.tauxOccupation}%`}
            // Définition explicite : dénominateur = TOUTES les chambres.
            // Différent du taux net de la prévision plus bas, qui exclut
            // les chambres en maintenance (docs/modules/reporting.md §12).
            hint={`Sur les ${resume.totalChambres} chambres, maintenance incluse`}
            icon={Gauge}
            tone="primary"
            progress={resume.tauxOccupation}
            onClick={
              can('housekeeping:read')
                ? () => onNavigate('housekeeping')
                : undefined
            }
          />
          <KpiCard
            label="Chambres occupées"
            value={`${resume.chambresOccupees} / ${resume.totalChambres}`}
            hint="Chambres actuellement occupées"
            icon={BedDouble}
            onClick={
              can('housekeeping:read')
                ? () => onNavigate('housekeeping')
                : undefined
            }
          />
          <KpiCard
            label="Arrivées aujourd'hui"
            value={String(resume.arriveesAujourdhui)}
            hint="Check-in prévus"
            icon={LogIn}
            tone={resume.arriveesAujourdhui > 0 ? 'success' : 'neutral'}
            onClick={
              can('checkin:read') ? () => onNavigate('checkin') : undefined
            }
          />
          <KpiCard
            label="Départs aujourd'hui"
            value={String(resume.departsAujourdhui)}
            hint="Check-out prévus"
            icon={LogOut}
            tone={resume.departsAujourdhui > 0 ? 'warning' : 'neutral'}
            onClick={
              can('checkin:read') ? () => onNavigate('checkin') : undefined
            }
          />
          <KpiCard
            label="Chambres à nettoyer"
            value={String(resume.chambresANettoyer)}
            hint="En attente de nettoyage"
            icon={Sparkles}
            tone={resume.chambresANettoyer > 0 ? 'warning' : 'neutral'}
            onClick={
              can('housekeeping:read')
                ? () => onNavigate('housekeeping')
                : undefined
            }
          />
          <KpiCard
            label="Encaissé aujourd'hui"
            // §1.4 / §8 — tout montant MAD en font-mono tabular-nums,
            // jamais animé (§7 : pas de count-up financier).
            value={
              <MoneyDisplay
                value={resume.encaisseAujourdhui}
                className="text-[19px] whitespace-nowrap"
              />
            }
            hint="Paiements du jour"
            icon={Banknote}
          />
        </div>
      )}

      {/* Zone opérationnelle — mission D3 §4 : Chambres (dominant) | À
          traiter | Aujourd'hui, sur une même bande desktop. */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[2fr_1fr_1fr]">
        {can('housekeeping:read') && (
          <RoomsStateGrid
            rooms={rooms}
            onNavigate={() => onNavigate('housekeeping')}
            onRoomClick={setSelectedRoom}
          />
        )}
        {(can('housekeeping:read') || can('maintenance:read')) && (
          <ATraiterPanel
            rooms={can('housekeeping:read') ? rooms : null}
            tickets={can('maintenance:read') ? tickets : null}
          />
        )}
        <TodayPanel
          canRead={can('checkin:read')}
          onNavigate={() => onNavigate('checkin')}
        />
      </div>

      {can('reporting:read') && (
        <Suspense fallback={<Skeleton className="h-[130px] w-full" />}>
          <OperationalForecastStrip />
        </Suspense>
      )}

      <RoomContextModal
        room={selectedRoom}
        rooms={rooms ?? []}
        permissions={permissions}
        onClose={() => setSelectedRoom(null)}
        onNavigate={onNavigate}
        onRoomsChanged={refreshRooms}
      />
    </div>
  );
}
