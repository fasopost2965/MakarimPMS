import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BedDouble,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
} from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { NAV_ITEMS } from '@/components/layout/nav-items';
import type { Tab } from '@/App';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { MoneyDisplay } from '@/components/ui/money-display';
import { cn } from '@/lib/utils';
import { RoomContextModal } from '../features/dashboard/components/RoomContextModal';
import {
  CANAL_LABEL,
  FORMULE_LABEL,
} from '../features/reservations/reservation-presentation';
import type { Reservation, Room } from '../features/reservations/types';
import type { Stay } from '../features/checkin/types';
import {
  MOCK_ARRIVALS,
  MOCK_DEPARTS,
  MOCK_ROOMS,
  MOCK_STAYS_EN_COURS,
} from './mock-data-frontdesk';

// DESIGN-009 — Front Desk / Séjours / Check-in, prototype de convergence
// unique (audit + prototype, mission §15 : « je préfère un prototype de
// convergence fort plutôt que deux variantes cosmétiques »). L'audit
// (rapport séparé) a montré que l'écran de production actuel
// (frontend/src/features/checkin/pages/CheckinPage.tsx) est déjà un flux
// complet (check-in réservation, walk-in, check-out, prolongation, ET
// changement de chambre — POST /stays/:id/change-room, contrairement à ce
// que la mission envisageait comme un possible NEEDS BACKEND) mais organisé
// comme 3 listes empilées plutôt que comme un board Arrivées/Séjours/Départs
// avec bande KPI et panneau contextuel. Ce prototype réorganise les mêmes
// données réelles (aucun champ inventé, voir mock-data-frontdesk.ts) sans
// aucune nouvelle capacité serveur.
//
// Isolation totale (mission §4/§19) : aucun import depuis
// features/checkin/pages/CheckinPage.tsx, aucune mutation (checkinFromReservation/
// checkinWalkIn/checkoutStay/changeRoom/extendStay ne sont jamais appelés —
// tous les boutons d'action sont visuels/no-op). AppSidebar et
// RoomContextModal (DESIGN-006) sont réutilisés strictement en lecture,
// jamais modifiés — RoomContextModal déclenche de vrais GET (lecture seule)
// contre les façades room-context/* : sans backend actif il affiche son
// propre état d'erreur déjà géré en production, choix assumé plutôt que de
// dupliquer un second composant de contexte (même précédent que
// PrototypeHousekeepingA, DESIGN-008).

type ViewMode = 'arrivees' | 'sejours' | 'departs';
type ContextTarget =
  | { kind: 'arrival'; reservation: Reservation }
  | { kind: 'stay'; stay: Stay }
  | { kind: 'depart'; stay: Stay };

const CANAL_TEXT_CLASS: Record<Reservation['canal'], string> = {
  DIRECT: 'text-primary',
  WALK_IN: 'text-warning',
  BOOKING_COM: 'text-info',
  EXPEDIA: 'text-warning',
  AIRBNB: 'text-violet',
};

// Chassis réel : la sidebar filtre déjà par permission (AppSidebar.tsx) —
// pour montrer « tous les autres modules visibles » (même convention que
// PrototypeHousekeepingA) sans modifier AppSidebar, on lui donne l'ensemble
// des permissions déclarées dans NAV_ITEMS plutôt qu'une liste partielle.
const ALL_NAV_PERMISSIONS = [...new Set(NAV_ITEMS.map((i) => i.permission))];
// stay:change-room / stay:extend — Administrateur + Réception uniquement
// (backend/prisma/seed.ts:557-582), non listées dans docs/RBAC_MATRIX.md
// (matrice résumée désynchronisée sur ce point précis, CLAUDE.md : « les
// specs de module détaillées font foi sur les vues résumées ») mais
// confirmées dans le code (StayController.ts:104/130, seed.ts).
const MOCK_PERMISSIONS = [
  ...ALL_NAV_PERMISSIONS,
  'checkin:write',
  'stay:change-room',
  'stay:extend',
];

// Capturé une fois au chargement du module (jamais dans le corps du
// composant) — un appel direct à `Date.now()` pendant le rendu est un appel
// impur (react-hooks/purity), même règle que le calcul de nuits restantes
// ci-dessous.
const NOW_MS = Date.now();

function initials(nom: string, prenom: string) {
  return `${nom.charAt(0)}${prenom.charAt(0)}`.toUpperCase();
}

function matchesSearch(
  query: string,
  guest: { nom: string; prenom: string },
  roomNumero: string,
) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    guest.nom.toLowerCase().includes(q) ||
    guest.prenom.toLowerCase().includes(q) ||
    roomNumero.toLowerCase().includes(q)
  );
}

// Réplique exacte de la formule serveur (backend/src/modules/stay/utils/solde.ts,
// computeSoldeDu) appliquée aux lignes de folio réellement incluses dans la
// réponse de GET /stays/departs-du-jour (STAY_INCLUDE) — jamais une valeur
// inventée ni une seconde formule : charges hors PAIEMENT additionnées,
// lignes PAIEMENT soustraites, lignes annulées ignorées. Affiché uniquement
// en vue Départs (mission §10 : ne jamais afficher un solde non prouvé).
function computeSoldeDu(stay: Stay): number {
  let total = 0;
  for (const f of stay.folios) {
    for (const l of f.lignes) {
      if (l.annulee) continue;
      total += l.type === 'PAIEMENT' ? -Number(l.montant) : Number(l.montant);
    }
  }
  return total;
}

export default function PrototypeFrontDeskA() {
  const [view, setView] = useState<ViewMode>('arrivees');
  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [contextTarget, setContextTarget] = useState<ContextTarget | null>(
    null,
  );

  const todayISO = new Date().toISOString().slice(0, 10);

  // BANDE KPI — mission §4/§13 : uniquement des compteurs réellement
  // calculables côté client à partir de données mock conformes aux types
  // réels (aucun nouvel endpoint requis, les 3 listes sont déjà celles de
  // production : arrivalsToday(), listStaysEnCours(), listDepartsDuJour()).
  const kpis = useMemo(() => {
    const arriveesAujourdhui = MOCK_ARRIVALS.length;
    // « À traiter » — même définition que le badge d'alerte déjà en
    // production (CheckinPage.tsx:166-169) : fiche de police (registre
    // légal DGSN) manquante, cumulée sur séjours en cours + départs du
    // jour (obligation légale, pas une notion inventée pour ce prototype).
    const aTraiter =
      MOCK_STAYS_EN_COURS.filter((s) => !s.policeRecord).length +
      MOCK_DEPARTS.filter((s) => !s.policeRecord).length;
    const sejoursEnCours = MOCK_STAYS_EN_COURS.length;
    const departsAujourdhui = MOCK_DEPARTS.length;
    return { arriveesAujourdhui, aTraiter, sejoursEnCours, departsAujourdhui };
  }, []);

  const filteredArrivals = useMemo(
    () =>
      MOCK_ARRIVALS.filter((r) =>
        matchesSearch(search, r.guest, r.room.numero),
      ),
    [search],
  );
  const filteredStays = useMemo(
    () =>
      MOCK_STAYS_EN_COURS.filter((s) =>
        matchesSearch(search, s.guest, s.room.numero),
      ),
    [search],
  );
  const filteredDeparts = useMemo(
    () =>
      MOCK_DEPARTS.filter((s) => matchesSearch(search, s.guest, s.room.numero)),
    [search],
  );

  return (
    <div className="bg-background flex h-screen">
      <AppSidebar
        activeTab={'checkin' as Tab}
        onNavigate={() => {}}
        collapsed={false}
        onToggleCollapsed={() => {}}
        mobileOpen={false}
        onMobileClose={() => {}}
        permissions={MOCK_PERMISSIONS}
        logoUrl={null}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-auto">
        <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-4 p-4 sm:p-6">
          {/* HEADER COMPACT */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <p className="text-muted-foreground text-[11px] font-bold tracking-[0.03em] uppercase">
                Exploitation hôtel
              </p>
              <h1 className="truncate text-xl font-extrabold tracking-[-0.01em]">
                Front Desk
              </h1>
              {/* Aucune "Business Date" — non modélisée côté backend, voir
                  rapport d'audit §21. Date du jour réelle uniquement. */}
              <p className="text-muted-foreground text-xs first-letter:uppercase">
                ·{' '}
                {new Date().toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
            </div>
            <Button variant="outline" className="gap-2">
              <RefreshCw className="size-4" />
              Actualiser
            </Button>
          </div>

          {/* BANDE KPI */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="Arrivées aujourd'hui"
              value={String(kpis.arriveesAujourdhui)}
              hint="Réservations CONFIRMEE, arrivée aujourd'hui"
              icon={LogIn}
              tone="primary"
            />
            <KpiCard
              label="À traiter"
              value={String(kpis.aTraiter)}
              hint="Fiche de police (DGSN) manquante"
              icon={AlertTriangle}
              tone={kpis.aTraiter > 0 ? 'warning' : 'neutral'}
            />
            <KpiCard
              label="Séjours en cours"
              value={String(kpis.sejoursEnCours)}
              hint="Stay.statut = EN_COURS"
              icon={BedDouble}
              tone="success"
            />
            <KpiCard
              label="Départs aujourd'hui"
              value={String(kpis.departsAujourdhui)}
              hint="Départ prévu aujourd'hui"
              icon={LogOut}
              tone={kpis.departsAujourdhui > 0 ? 'warning' : 'neutral'}
            />
          </div>

          {/* BARRE OUTILS */}
          <Card>
            <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
              <div
                role="tablist"
                aria-label="Vue"
                className="bg-surface-2 flex shrink-0 gap-1 rounded-md p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'arrivees'}
                  onClick={() => setView('arrivees')}
                  className={cn(
                    'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                    view === 'arrivees'
                      ? 'bg-card shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <LogIn className="size-3.5" />
                  Arrivées
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'sejours'}
                  onClick={() => setView('sejours')}
                  className={cn(
                    'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                    view === 'sejours'
                      ? 'bg-card shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <BedDouble className="size-3.5" />
                  Séjours
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'departs'}
                  onClick={() => setView('departs')}
                  className={cn(
                    'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                    view === 'departs'
                      ? 'bg-card shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <LogOut className="size-3.5" />
                  Départs
                </button>
              </div>

              <div className="relative min-w-0 flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un client ou une chambre…"
                  className="pl-8"
                />
              </div>
            </CardContent>
          </Card>

          {/* ZONE PRINCIPALE */}
          {view === 'arrivees' && (
            <div className="flex flex-col gap-2">
              {filteredArrivals.length === 0 && (
                <p className="text-muted-foreground py-10 text-center text-sm">
                  Aucune arrivée ne correspond aux filtres.
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {filteredArrivals.map((reservation) => (
                  <button
                    key={reservation.id}
                    type="button"
                    onClick={() =>
                      setContextTarget({ kind: 'arrival', reservation })
                    }
                    className="bg-card hover:border-primary/50 flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="bg-primary/15 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                          {initials(
                            reservation.guest.nom,
                            reservation.guest.prenom,
                          )}
                        </span>
                        <span className="flex flex-col">
                          <span className="text-sm font-semibold">
                            {reservation.guest.nom} {reservation.guest.prenom}
                          </span>
                          <span
                            className={`text-xs ${CANAL_TEXT_CLASS[reservation.canal]}`}
                          >
                            {CANAL_LABEL[reservation.canal]}
                          </span>
                        </span>
                      </span>
                      <Badge variant="outline">
                        Ch. {reservation.room.numero}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                      <span>
                        {reservation.nombreOccupants ?? '—'} occupant
                        {(reservation.nombreOccupants ?? 0) > 1 ? 's' : ''}
                      </span>
                      <span>·</span>
                      <span>{FORMULE_LABEL[reservation.formule]}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {view === 'sejours' && (
            <div className="flex flex-col gap-2">
              {filteredStays.length === 0 && (
                <p className="text-muted-foreground py-10 text-center text-sm">
                  Aucun séjour ne correspond aux filtres.
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {filteredStays.map((stay) => {
                  const nuitsRestantes = Math.max(
                    0,
                    Math.round(
                      (new Date(stay.dateCheckoutPrevue).getTime() - NOW_MS) /
                        86_400_000,
                    ),
                  );
                  return (
                    <button
                      key={stay.id}
                      type="button"
                      onClick={() => setContextTarget({ kind: 'stay', stay })}
                      className="bg-card hover:border-primary/50 flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="bg-success/15 text-success flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                            {initials(stay.guest.nom, stay.guest.prenom)}
                          </span>
                          <span className="flex flex-col">
                            <span className="text-sm font-semibold">
                              {stay.guest.nom} {stay.guest.prenom}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {FORMULE_LABEL[stay.formule]}
                            </span>
                          </span>
                        </span>
                        <Badge variant="outline">Ch. {stay.room.numero}</Badge>
                      </div>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                        <span>
                          {nuitsRestantes} nuit{nuitsRestantes > 1 ? 's' : ''}{' '}
                          restante{nuitsRestantes > 1 ? 's' : ''}
                        </span>
                        <span>·</span>
                        <span>
                          {stay.nombreOccupants ?? '—'} occupant
                          {(stay.nombreOccupants ?? 0) > 1 ? 's' : ''}
                        </span>
                        {!stay.policeRecord && (
                          <Badge variant="warning" className="ml-auto">
                            <AlertTriangle className="size-3" />
                            Fiche police manquante
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'departs' && (
            <div className="flex flex-col gap-2">
              {filteredDeparts.length === 0 && (
                <p className="text-muted-foreground py-10 text-center text-sm">
                  Aucun départ ne correspond aux filtres.
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {filteredDeparts.map((stay) => {
                  const solde = computeSoldeDu(stay);
                  return (
                    <button
                      key={stay.id}
                      type="button"
                      onClick={() => setContextTarget({ kind: 'depart', stay })}
                      className="bg-card hover:border-primary/50 flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="bg-warning/20 text-warning flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                            {initials(stay.guest.nom, stay.guest.prenom)}
                          </span>
                          <span className="flex flex-col">
                            <span className="text-sm font-semibold">
                              {stay.guest.nom} {stay.guest.prenom}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              Départ prévu {todayISO}
                            </span>
                          </span>
                        </span>
                        <Badge variant="outline">Ch. {stay.room.numero}</Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'text-xs font-semibold',
                            solde > 0 ? 'text-destructive' : 'text-success',
                          )}
                        >
                          Solde : {solde.toFixed(2)} MAD
                        </span>
                        {!stay.policeRecord && (
                          <Badge variant="warning">
                            <AlertTriangle className="size-3" />
                            Fiche police manquante
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <RoomContextModal
        room={selectedRoom}
        rooms={MOCK_ROOMS}
        permissions={MOCK_PERMISSIONS}
        onClose={() => setSelectedRoom(null)}
        onNavigate={() => setSelectedRoom(null)}
      />

      {/* PANNEAU CONTEXTUEL — Arrivée */}
      <Dialog
        open={contextTarget?.kind === 'arrival'}
        onOpenChange={(next) => !next && setContextTarget(null)}
      >
        <DialogContent className="sm:max-w-lg">
          {contextTarget?.kind === 'arrival' && (
            <ArrivalContextBody
              reservation={contextTarget.reservation}
              onViewRoom={() => {
                setSelectedRoom(contextTarget.reservation.room);
                setContextTarget(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* PANNEAU CONTEXTUEL — Séjour */}
      <Dialog
        open={contextTarget?.kind === 'stay'}
        onOpenChange={(next) => !next && setContextTarget(null)}
      >
        <DialogContent className="sm:max-w-lg">
          {contextTarget?.kind === 'stay' && (
            <StayContextBody
              stay={contextTarget.stay}
              onViewRoom={() => {
                setSelectedRoom(contextTarget.stay.room);
                setContextTarget(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* PANNEAU CONTEXTUEL — Départ */}
      <Dialog
        open={contextTarget?.kind === 'depart'}
        onOpenChange={(next) => !next && setContextTarget(null)}
      >
        <DialogContent className="sm:max-w-lg">
          {contextTarget?.kind === 'depart' && (
            <DepartContextBody
              stay={contextTarget.stay}
              onViewRoom={() => {
                setSelectedRoom(contextTarget.stay.room);
                setContextTarget(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------
// Panneau contextuel — Arrivée. Actions réelles seulement (Check-in, Voir
// la chambre) — no-op ici (mission §4/§19), jamais de vraie mutation.
// « No-show » omis volontairement : ReservationContextPanel (production,
// DESIGN-007) ne le propose que si la date d'arrivée est déjà dépassée
// (toDateOnly(dateArrivee) <= today ET marquage no-show séparé), condition
// qui ne s'applique jamais à une arrivée du jour non encore traitée.
// ---------------------------------------------------------------------
function ArrivalContextBody({
  reservation,
  onViewRoom,
}: {
  reservation: Reservation;
  onViewRoom: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {reservation.guest.nom} {reservation.guest.prenom}
        </DialogTitle>
      </DialogHeader>
      <div className="bg-muted/30 flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">Confirmée</Badge>
          <Badge variant="outline">{CANAL_LABEL[reservation.canal]}</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Chambre {reservation.room.numero} ({reservation.room.roomType.nom}) —{' '}
          {reservation.nombreOccupants ?? '—'} occupant
          {(reservation.nombreOccupants ?? 0) > 1 ? 's' : ''} —{' '}
          {FORMULE_LABEL[reservation.formule]}
        </p>
      </div>
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
      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={onViewRoom}>
          Voir la chambre
        </Button>
        <Button type="button">Check-in</Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------------
// Panneau contextuel — Séjour en cours. Actions réelles seulement, chacune
// correspondant à une capacité backend confirmée par l'audit :
// Prolonger (POST /stays/:id/extend, stay:extend), Changer de chambre
// (POST /stays/:id/change-room, stay:change-room), Check-out
// (POST /checkout/:stayId, checkin:write). Aucun solde affiché ici — un
// séjour EN_COURS n'a pas de solde "dû au départ" avant le check-out
// (mission §10), seules les lignes de folio réelles sont montrées.
// ---------------------------------------------------------------------
function StayContextBody({
  stay,
  onViewRoom,
}: {
  stay: Stay;
  onViewRoom: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {stay.guest.nom} {stay.guest.prenom}
        </DialogTitle>
      </DialogHeader>
      <div className="bg-muted/30 flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">En cours</Badge>
          {stay.reservationId === null && (
            <Badge variant="outline">Walk-in</Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Chambre {stay.room.numero} ({stay.room.roomType.nom}) — arrivée{' '}
          {new Date(stay.dateCheckin).toLocaleDateString('fr-FR')}, départ prévu{' '}
          {stay.dateCheckoutPrevue.slice(0, 10)}
        </p>
      </div>
      <div>
        <p className="mb-1 text-sm font-medium">Folio principal</p>
        {stay.folios.map((f) => (
          <ul key={f.id} className="flex flex-col gap-1 text-sm">
            {f.lignes.map((l) => (
              <li key={l.id} className="flex justify-between">
                <span
                  className={
                    l.annulee ? 'text-muted-foreground line-through' : ''
                  }
                >
                  {l.libelle}
                </span>
                <span className="font-mono">{l.montant} MAD</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
      <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" variant="outline" onClick={onViewRoom}>
          Voir la chambre
        </Button>
        <Button type="button" variant="outline">
          Changer de chambre
        </Button>
        <Button type="button" variant="outline">
          Prolonger
        </Button>
        <Button type="button">Check-out</Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------------
// Panneau contextuel — Départ du jour. Solde affiché uniquement ici,
// calculé par la même formule que le serveur (computeSoldeDu) à partir des
// lignes de folio réellement incluses dans la réponse GET
// /stays/departs-du-jour — jamais une valeur "reste à payer" inventée.
// ---------------------------------------------------------------------
function DepartContextBody({
  stay,
  onViewRoom,
}: {
  stay: Stay;
  onViewRoom: () => void;
}) {
  const solde = computeSoldeDu(stay);
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {stay.guest.nom} {stay.guest.prenom}
        </DialogTitle>
      </DialogHeader>
      <div className="bg-muted/30 flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="warning">Départ aujourd'hui</Badge>
          {!stay.policeRecord && (
            <Badge variant="warning">
              <AlertTriangle className="size-3" />
              Fiche police manquante
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Chambre {stay.room.numero} ({stay.room.roomType.nom})
        </p>
      </div>
      <div className="bg-surface-2 rounded-md p-3">
        <p className="text-muted-foreground text-xs font-semibold">
          Solde (lignes de folio actives, même formule que computeSoldeDu)
        </p>
        <p
          className={cn(
            'mt-1 font-mono text-lg font-bold',
            solde > 0 ? 'text-destructive' : 'text-success',
          )}
        >
          {solde.toFixed(2)} MAD
        </p>
      </div>
      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={onViewRoom}>
          Voir la chambre
        </Button>
        <Button type="button" disabled={solde > 0}>
          Check-out
        </Button>
      </DialogFooter>
    </>
  );
}
