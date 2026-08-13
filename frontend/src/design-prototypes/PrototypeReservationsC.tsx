import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  ListTodo,
  LogIn,
  Phone,
  Plus,
  Search,
  Smartphone,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { MoneyDisplay } from '@/components/ui/money-display';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  addDays,
  formatDayLabel,
  getDateRange,
  getVisibleReservationSpan,
  isSameDay,
  startOfDay,
  toISODate,
} from '../features/reservations/date-utils';
import { CreateReservationDialog } from '../features/reservations/components/CreateReservationDialog';
import { CANAL_LABEL } from '../features/reservations/reservation-presentation';
import type {
  Reservation,
  StatutReservation,
} from '../features/reservations/types';
import { MOCK_RESERVATIONS_C, MOCK_ROOMS } from './mock-data-reservations-c';

// DESIGN-007 — Prototype C : convergence de A (table opérationnelle dense)
// et B (planning chambres × jours), en un seul module à deux vues
// [Liste] [Planning] partageant le même header, la même bande KPI, la même
// barre d'outils et le même panneau contextuel au clic. Philosophie Dashboard
// D3 (DESIGN-005) + interaction contextuelle DESIGN-006. Exploration isolée
// : aucune mutation, aucun appel réseau d'écriture (createReservation n'est
// jamais appelé, les actions du panneau sont visuelles uniquement).
//
// Données : MOCK_RESERVATIONS_C (mock-data-reservations-c.ts) — étend le jeu
// A/B avec un unique scénario supplémentaire (réservation confirmée en
// retard d'arrivée) pour pouvoir démontrer "À traiter" et l'emplacement du
// no-show sans toucher aux fichiers de A/B.

const VISIBLE_DAYS = 7;
const ROW_HEIGHT = 48;

type ViewMode = 'liste' | 'planning';

const STATUS_BADGE: Record<
  StatutReservation,
  { label: string; variant: 'success' | 'destructive' | 'warning' | 'info' }
> = {
  CONFIRMEE: { label: 'Confirmée', variant: 'success' },
  ANNULEE: { label: 'Annulée', variant: 'destructive' },
  NO_SHOW: { label: 'No-show', variant: 'warning' },
  TRANSFORMEE_EN_SEJOUR: { label: 'En séjour', variant: 'info' },
};

const CANAL_DOT: Record<Reservation['canal'], string> = {
  DIRECT: 'bg-primary',
  WALK_IN: 'bg-canal-walkin',
  BOOKING_COM: 'bg-info',
  EXPEDIA: 'bg-warning',
  AIRBNB: 'bg-violet',
};

const CANAL_BAR_CLASS: Record<Reservation['canal'], string> = {
  DIRECT: 'border-primary/40 bg-primary-soft text-primary',
  WALK_IN: 'border-canal-walkin/40 bg-canal-walkin-soft text-canal-walkin',
  BOOKING_COM: 'border-info/40 bg-info-soft text-info',
  EXPEDIA: 'border-warning/40 bg-warning-soft text-warning',
  AIRBNB: 'border-violet/40 bg-violet-soft text-violet',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nights(dateArrivee: string, dateDepart: string) {
  return Math.round(
    (new Date(dateDepart).getTime() - new Date(dateArrivee).getTime()) /
      86_400_000,
  );
}

export default function PrototypeReservationsC() {
  const [view, setView] = useState<ViewMode>('liste');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StatutReservation>(
    'ALL',
  );
  const [canalFilter, setCanalFilter] = useState<'ALL' | Reservation['canal']>(
    'ALL',
  );
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [windowStart, setWindowStart] = useState(() => startOfDay(new Date()));

  const today = todayISO();

  // Bande KPI — DERIVED : agrégation client de MOCK_RESERVATIONS_C. En
  // production chaque compteur viendrait d'un GET /reservations filtré
  // côté serveur (du/au/statut existent déjà, voir rapport §8). Choix
  // volontairement différent de A/B : "à traiter" remplace le duo
  // no-show/annulées, jugé insuffisamment actionnable pour occuper une carte
  // KPI permanente (mission §3) — ces deux états restent signalés ailleurs
  // dans l'interface (badge discret dans la barre d'outils, badge de statut
  // dans la table/le panneau).
  const arrivalsToday = MOCK_RESERVATIONS_C.filter(
    (r) => r.dateArrivee === today && r.statut === 'CONFIRMEE',
  );
  // "À traiter" — réservations confirmées dont la date d'arrivée est déjà
  // atteinte (aujourd'hui ou dépassée) sans qu'un check-in ait eu lieu
  // (statut encore CONFIRMEE, jamais TRANSFORMEE_EN_SEJOUR). Représente une
  // décision réelle qui incombe à la réception : check-in ou no-show.
  // Réellement calculable dès aujourd'hui (GET /reservations?statut=
  // CONFIRMEE&au=<aujourd'hui>) — NEEDS UI, pas NEEDS BACKEND.
  const toHandle = MOCK_RESERVATIONS_C.filter(
    (r) => r.statut === 'CONFIRMEE' && r.dateArrivee <= today,
  );
  const upcoming = MOCK_RESERVATIONS_C.filter(
    (r) => r.dateArrivee > today && r.statut === 'CONFIRMEE',
  );
  // Charge de la semaine — arrivées confirmées sur les 7 prochains jours
  // (aujourd'hui inclus). Utile à la réception pour anticiper la charge,
  // même logique de filtrage du/au déjà exposée par l'API.
  const weekEnd = toISODate(addDays(startOfDay(new Date()), VISIBLE_DAYS));
  const thisWeek = MOCK_RESERVATIONS_C.filter(
    (r) =>
      r.statut === 'CONFIRMEE' &&
      r.dateArrivee >= today &&
      r.dateArrivee < weekEnd,
  );
  const noShows = MOCK_RESERVATIONS_C.filter((r) => r.statut === 'NO_SHOW');
  const cancelled = MOCK_RESERVATIONS_C.filter((r) => r.statut === 'ANNULEE');

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('fr');
    return MOCK_RESERVATIONS_C.filter((r) => {
      const searchable =
        `${r.guest.nom} ${r.guest.prenom} ${r.room.numero} ${CANAL_LABEL[r.canal]}`.toLocaleLowerCase(
          'fr',
        );
      return (
        (!needle || searchable.includes(needle)) &&
        (statusFilter === 'ALL' || r.statut === statusFilter) &&
        (canalFilter === 'ALL' || r.canal === canalFilter)
      );
    }).sort((a, b) => a.dateArrivee.localeCompare(b.dateArrivee));
  }, [query, statusFilter, canalFilter]);

  const days = useMemo(
    () => getDateRange(windowStart, VISIBLE_DAYS),
    [windowStart],
  );
  const windowEnd = addDays(windowStart, VISIBLE_DAYS);
  const visiblePlanningReservations = MOCK_RESERVATIONS_C.filter(
    (r) =>
      r.statut !== 'ANNULEE' &&
      new Date(r.dateArrivee) < windowEnd &&
      new Date(r.dateDepart) > windowStart,
  );

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto flex max-w-[1700px] flex-col gap-4 p-4 sm:p-6">
        {/* HEADER COMPACT */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <p className="text-muted-foreground text-[11px] font-bold tracking-[0.03em] uppercase">
              Exploitation hôtel
            </p>
            <h1 className="truncate text-xl font-extrabold tracking-[-0.01em]">
              Réservations
            </h1>
            <p className="text-muted-foreground text-xs first-letter:uppercase">
              ·{' '}
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
          </div>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Nouvelle réservation
          </Button>
        </div>

        {/* BANDE OPÉRATIONNELLE COMPACTE */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Arrivées aujourd'hui"
            value={String(arrivalsToday.length)}
            hint="Réservations confirmées"
            icon={LogIn}
            tone={arrivalsToday.length > 0 ? 'success' : 'neutral'}
          />
          <KpiCard
            label="À traiter"
            value={String(toHandle.length)}
            hint="Arrivée atteinte, check-in en attente"
            icon={ListTodo}
            tone={toHandle.length > 0 ? 'warning' : 'neutral'}
          />
          <KpiCard
            label="Réservations à venir"
            value={String(upcoming.length)}
            hint="Confirmées, arrivée future"
            icon={CalendarClock}
            tone="primary"
          />
          <KpiCard
            label="Cette semaine"
            value={String(thisWeek.length)}
            hint="Arrivées sur 7 jours"
            icon={ListChecks}
            tone="neutral"
          />
        </div>

        {/* BARRE OUTILS : switch de vue + filtres */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
            <div
              role="tablist"
              aria-label="Mode d'affichage"
              className="bg-surface-2 flex shrink-0 gap-1 rounded-md p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={view === 'liste'}
                onClick={() => setView('liste')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors',
                  view === 'liste'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <ListChecks className="size-3.5" />
                Liste
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'planning'}
                onClick={() => setView('planning')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors',
                  view === 'planning'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <CalendarRange className="size-3.5" />
                Planning
              </button>
            </div>

            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                aria-label="Rechercher une réservation"
                className="h-9 pl-9"
                placeholder="Client, chambre ou canal…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                v && setStatusFilter(v as typeof statusFilter)
              }
            >
              <SelectTrigger className="h-9 w-full lg:w-40">
                <SelectValue>
                  {() =>
                    statusFilter === 'ALL'
                      ? 'Tous les statuts'
                      : STATUS_BADGE[statusFilter].label
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les statuts</SelectItem>
                {(Object.keys(STATUS_BADGE) as StatutReservation[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_BADGE[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={canalFilter}
              onValueChange={(v) =>
                v && setCanalFilter(v as typeof canalFilter)
              }
            >
              <SelectTrigger className="h-9 w-full lg:w-40">
                <SelectValue>
                  {() =>
                    canalFilter === 'ALL'
                      ? 'Tous les canaux'
                      : CANAL_LABEL[canalFilter]
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les canaux</SelectItem>
                {(Object.keys(CANAL_LABEL) as Reservation['canal'][]).map(
                  (c) => (
                    <SelectItem key={c} value={c}>
                      {CANAL_LABEL[c]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>

            {/* No-show/annulées signalés ici (mission §3) plutôt que par une
                carte KPI permanente — visibles sans occuper la bande. */}
            {(noShows.length > 0 || cancelled.length > 0) && (
              <p className="text-muted-foreground shrink-0 text-xs">
                {noShows.length > 0 && `${noShows.length} no-show`}
                {noShows.length > 0 && cancelled.length > 0 && ' · '}
                {cancelled.length > 0 &&
                  `${cancelled.length} annulée${cancelled.length > 1 ? 's' : ''}`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ZONE DE TRAVAIL */}
        {view === 'liste' ? (
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>
                {filtered.length} réservation{filtered.length > 1 ? 's' : ''}
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs font-bold tracking-wide uppercase">
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Arrivée → Départ</th>
                    <th className="px-3 py-2">Nuits</th>
                    <th className="px-3 py-2">Chambre</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2">Canal</th>
                    <th className="px-3 py-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const isToday = r.dateArrivee === today;
                    return (
                      <tr
                        key={r.id}
                        tabIndex={0}
                        role="button"
                        aria-label={`Ouvrir la réservation de ${r.guest.nom} ${r.guest.prenom}`}
                        onClick={() => setSelected(r)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelected(r);
                          }
                        }}
                        className="hover:bg-surface-2 focus-visible:bg-surface-2 cursor-pointer border-b transition-colors duration-[var(--duration-fast)] last:border-b-0 focus-visible:outline-none"
                      >
                        <td className="px-3 py-2">
                          <p className="font-semibold">
                            {r.guest.nom} {r.guest.prenom}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            Réf #{r.id}
                            {r.guest.telephone ? ` · ${r.guest.telephone}` : ''}
                          </p>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              isToday ? 'text-primary font-semibold' : undefined
                            }
                          >
                            {r.dateArrivee}
                          </span>{' '}
                          → {r.dateDepart}
                          {isToday && (
                            <Badge variant="brand" className="ml-2">
                              Aujourd'hui
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {nights(r.dateArrivee, r.dateDepart)}
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium">{r.room.numero}</p>
                          <p className="text-muted-foreground text-xs">
                            {r.room.roomType.nom}
                          </p>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={STATUS_BADGE[r.statut].variant}>
                            {STATUS_BADGE[r.statut].label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                            <span
                              className={`size-2 rounded-full ${CANAL_DOT[r.canal]}`}
                            />
                            {CANAL_LABEL[r.canal]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <MoneyDisplay value={r.prixTotalFinal} />
                          {r.ajustementManuel && (
                            <p className="text-muted-foreground text-[10px]">
                              ajusté
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="gap-3 p-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-lg"
                  aria-label="Période précédente"
                  onClick={() =>
                    setWindowStart((d) => addDays(d, -VISIBLE_DAYS))
                  }
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setWindowStart(startOfDay(new Date()))}
                >
                  Aujourd'hui
                </Button>
                <Button
                  variant="outline"
                  size="icon-lg"
                  aria-label="Période suivante"
                  onClick={() =>
                    setWindowStart((d) => addDays(d, VISIBLE_DAYS))
                  }
                >
                  <ChevronRight />
                </Button>
                <p className="text-muted-foreground ml-2 text-xs font-medium">
                  {toISODate(windowStart)} →{' '}
                  {toISODate(addDays(windowStart, VISIBLE_DAYS - 1))}
                </p>
              </div>

              <div className="overflow-x-auto">
                <TimelineGrid
                  days={days}
                  reservations={visiblePlanningReservations}
                  onSelect={setSelected}
                />
              </div>
              <p className="text-muted-foreground text-[11px]">
                Reprend la mécanique déjà en production
                (ReservationsCalendarPage : chambres × jours, glisser-déposer
                revalidé côté serveur) — non reproduite ici, exploration de
                présentation uniquement.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <ReservationPanel
        reservation={selected}
        today={today}
        onClose={() => setSelected(null)}
      />
      <CreateReservationDialog
        open={createOpen}
        selection={null}
        rooms={MOCK_ROOMS}
        onClose={() => setCreateOpen(false)}
        onConfirm={() => {
          // Prototype : aucune création réelle (aucun appel à
          // createReservation) — exploration visuelle uniquement.
          setCreateOpen(false);
        }}
        submitting={false}
        error={null}
      />
    </div>
  );
}

function TimelineGrid({
  days,
  reservations,
  onSelect,
}: {
  days: Date[];
  reservations: Reservation[];
  onSelect: (r: Reservation) => void;
}) {
  const columns = `150px repeat(${VISIBLE_DAYS}, minmax(90px, 1fr))`;
  return (
    <div
      className="grid min-w-[820px]"
      style={{ gridTemplateColumns: columns }}
    >
      <div className="bg-surface-2 border-r border-b px-3 py-2 text-xs font-bold tracking-wide uppercase">
        Chambre
      </div>
      {days.map((day) => {
        const today = isSameDay(day, new Date());
        return (
          <div
            key={toISODate(day)}
            className={cn(
              'border-b border-l px-1 py-2 text-center text-xs font-semibold capitalize',
              today ? 'bg-primary-soft text-primary' : 'bg-surface',
            )}
          >
            {formatDayLabel(day)}
          </div>
        );
      })}
      {MOCK_ROOMS.map((room) => {
        const roomReservations = reservations.filter(
          (r) => r.roomId === room.id,
        );
        const spans = roomReservations
          .map((r) => ({
            reservation: r,
            placement: getVisibleReservationSpan(
              r.dateArrivee,
              r.dateDepart,
              days,
            ),
          }))
          .filter(
            (
              item,
            ): item is typeof item & {
              placement: { startIndex: number; span: number };
            } => item.placement !== null,
          );
        return (
          <div key={room.id} className="contents">
            <div
              className="flex items-center justify-between gap-2 border-r border-b px-3"
              style={{ height: ROW_HEIGHT }}
            >
              <div>
                <p className="text-sm font-bold">{room.numero}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {room.roomType.nom}
                </p>
              </div>
            </div>
            {days.map((day, dayIndex) => {
              const today = isSameDay(day, new Date());
              const visible = spans.find(
                (s) => s.placement.startIndex === dayIndex,
              );
              return (
                <div
                  key={toISODate(day)}
                  className={cn(
                    'relative border-b border-l',
                    today && 'bg-primary/3',
                  )}
                  style={{ height: ROW_HEIGHT }}
                >
                  {visible && (
                    <button
                      type="button"
                      onClick={() => onSelect(visible.reservation)}
                      title={`${visible.reservation.guest.nom} ${visible.reservation.guest.prenom}`}
                      style={{
                        width: `calc(${visible.placement.span * 100}% - 6px)`,
                      }}
                      className={cn(
                        'absolute inset-y-1 left-1 z-10 flex min-w-0 items-center overflow-hidden rounded-md border px-2 text-xs font-semibold shadow-sm transition-[box-shadow,transform] duration-[var(--duration-fast)] hover:-translate-y-px hover:shadow-[var(--shadow-card-hover)] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                        CANAL_BAR_CLASS[visible.reservation.canal],
                      )}
                    >
                      <span className="truncate">
                        {visible.reservation.guest.nom}{' '}
                        {visible.reservation.guest.prenom}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// Panneau contextuel partagé Liste/Planning — même philosophie que
// RoomContextModal (DESIGN-006) : premier niveau = CONSULTATION, puis zone
// ACTIONS dont le contenu dépend du statut/de la date (mission §8/§9).
// Actions neutres ici (aucun appel réseau) ; en production chacune resterait
// gatée par sa permission réelle (reservations:write/delete, checkin:write)
// — exactement comme les sous-panneaux de RoomContextModal.
type PanelAction = {
  key: string;
  label: string;
  icon: typeof LogIn;
  tone?: 'default' | 'warning' | 'destructive';
  note: string;
};

function computeActions(r: Reservation, today: string): PanelAction[] {
  if (r.statut !== 'CONFIRMEE') return [];
  const actions: PanelAction[] = [];
  const arrived = r.dateArrivee <= today;
  const future = r.dateArrivee > today;

  if (arrived) {
    actions.push({
      key: 'checkin',
      label: 'Effectuer le check-in',
      icon: LogIn,
      note: "REAL (StayService.checkinFromReservation) — NEEDS UI : aucun pont exposé depuis le module Réservations aujourd'hui (voir rapport §7/§11).",
    });
  }
  if (future) {
    actions.push({
      key: 'self-checkin',
      label: 'Envoyer le lien self check-in',
      icon: Smartphone,
      note: 'REAL — POST /reservations/:id/self-checkin-link existe déjà (F6), jamais exposé ici avant ce prototype.',
    });
  }
  actions.push({
    key: 'edit',
    label: 'Modifier dates / chambre',
    icon: CalendarPlus,
    note: 'REAL — PATCH /reservations/:id (reservations:write).',
  });
  actions.push({
    key: 'cancel',
    label: 'Annuler la réservation',
    icon: XCircle,
    tone: 'destructive',
    note: 'REAL — DELETE /reservations/:id (reservations:delete).',
  });
  if (arrived) {
    actions.push({
      key: 'no-show',
      label: 'Marquer no-show',
      icon: AlertTriangle,
      tone: 'warning',
      note: "REAL — POST /reservations/:id/no-show existe côté backend mais n'est exposé nulle part dans l'UI actuelle (mission §10). Prototype visuel uniquement, aucun appel.",
    });
  }
  return actions;
}

function ReservationPanel({
  reservation,
  today,
  onClose,
}: {
  reservation: Reservation | null;
  today: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={reservation !== null} onOpenChange={(n) => !n && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col overflow-y-auto sm:max-w-lg">
        {reservation && (
          <ReservationPanelBody reservation={reservation} today={today} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReservationPanelBody({
  reservation,
  today,
}: {
  reservation: Reservation;
  today: string;
}) {
  const actions = computeActions(reservation, today);
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {reservation.guest.nom} {reservation.guest.prenom}
        </DialogTitle>
      </DialogHeader>

      {/* CONSULTATION — uniquement des champs réellement présents sur
          Reservation (types.ts). Aucun badge VIP/Entreprise : Guest.categorie
          existe côté backend mais le type frontend `Reservation.guest` ne
          l'expose pas aujourd'hui (voir rapport §8, NEEDS UI + élargissement
          de type au build — mission §14, "sinon ne pas l'afficher"). */}
      <div className="bg-muted/30 flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_BADGE[reservation.statut].variant}>
            {STATUS_BADGE[reservation.statut].label}
          </Badge>
          <Badge variant="outline">{CANAL_LABEL[reservation.canal]}</Badge>
          {reservation.dateArrivee === today &&
            reservation.statut === 'CONFIRMEE' && (
              <Badge variant="brand">Aujourd'hui</Badge>
            )}
        </div>
        <p className="text-muted-foreground text-sm">
          Chambre {reservation.room.numero} ({reservation.room.roomType.nom}) —{' '}
          {reservation.dateArrivee} → {reservation.dateDepart} (
          {nights(reservation.dateArrivee, reservation.dateDepart)} nuits)
        </p>
      </div>

      <div className="flex flex-col gap-3 pt-1">
        {reservation.guest.telephone && (
          <Info
            icon={<Phone className="size-4" />}
            label="Téléphone"
            value={reservation.guest.telephone}
          />
        )}
        {reservation.nombreOccupants !== null && (
          <Info label="Occupants" value={String(reservation.nombreOccupants)} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-2 rounded-md p-3">
            <p className="text-muted-foreground text-xs font-semibold">
              Prix calculé
            </p>
            <MoneyDisplay
              className="mt-1 block text-base font-bold"
              value={reservation.prixTotalCalcule}
            />
          </div>
          <div className="bg-primary-soft rounded-md p-3">
            <p className="text-primary text-xs font-semibold">Prix final</p>
            <MoneyDisplay
              className="mt-1 block text-base font-bold"
              value={reservation.prixTotalFinal}
            />
          </div>
        </div>
        {reservation.motifAjustement && (
          <p className="text-muted-foreground text-xs">
            Ajustement : {reservation.motifAjustement}
          </p>
        )}
      </div>

      {/* ACTIONS — dynamiques selon statut/date (mission §9). Vide pour
          ANNULEE/NO_SHOW/TRANSFORMEE_EN_SEJOUR : rien à faire depuis ce
          panneau (un séjour en cours se gère depuis le module Stay). */}
      <div className="flex flex-col gap-2 border-t pt-3">
        <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
          Actions
        </p>
        {actions.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            {reservation.statut === 'TRANSFORMEE_EN_SEJOUR'
              ? 'Client déjà en séjour — actions disponibles depuis le module Séjour.'
              : 'Aucune action disponible pour ce statut.'}
          </p>
        ) : (
          actions.map((a) => (
            <Button
              key={a.key}
              variant="outline"
              title={a.note}
              className={cn(
                'justify-start gap-2',
                a.tone === 'destructive' && 'text-destructive',
                a.tone === 'warning' && 'text-warning',
              )}
            >
              <a.icon className="size-4" />
              {a.label}
            </Button>
          ))
        )}
        <p className="text-muted-foreground mt-1 text-[11px]">
          Actions présentées à titre d'exploration UX — en production, chacune
          reste gatée par sa permission réelle (reservations:write/delete,
          checkin:write), exactement comme les panneaux de RoomContextModal
          (DESIGN-006). Survoler un bouton affiche son statut REAL/NEEDS UI.
        </p>
      </div>
    </>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {icon && <span className="text-primary">{icon}</span>}
      <span className="text-muted-foreground">{label} :</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
