import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Brush,
  ClipboardCheck,
  History,
  LayoutGrid,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Table as TableIcon,
  Wrench,
} from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { NAV_ITEMS } from '@/components/layout/nav-items';
import type { Tab } from '@/App';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { RoomContextModal } from '../features/dashboard/components/RoomContextModal';
import { HousekeepingReasonDialog } from '../features/housekeeping/components/HousekeepingReasonDialog';
import { HousekeepingTaskHistoryDialog } from '../features/housekeeping/components/HousekeepingTaskHistoryDialog';
import type { Room, StatutChambre } from '../features/reservations/types';
import type {
  HousekeepingTask,
  StatutTacheHousekeeping,
} from '../features/housekeeping/types';
import {
  MOCK_ALL_TASKS,
  MOCK_MAINTENANCE_TICKETS,
  MOCK_ROOMS,
} from './mock-data-housekeeping';

// DESIGN-008 — Housekeeping desktop, prototype de convergence unique
// (mission §15 : « je préfère un prototype de convergence fort plutôt que
// deux variantes cosmétiques »). L'audit (rapport séparé) a montré que
// l'écran de production actuel est déjà un flux complet (8 actions, RBAC
// fine, historique) mais organisé comme une liste de chambres plate plutôt
// que comme un vrai board opérationnel — ce prototype réorganise les mêmes
// données réelles (aucun champ inventé, voir mock-data-housekeeping.ts)
// autour de la question posée par la mission : « à l'arrivée, combien de
// chambres à nettoyer / en cours / à contrôler / bloquées ? ».
//
// Isolation totale (mission §19) : aucun import depuis
// features/housekeeping/pages/HousekeepingPage.tsx, aucune mutation
// (createHousekeepingTask/assignHousekeepingTask/etc. ne sont jamais
// appelés), AppSidebar/RoomContextModal/HousekeepingReasonDialog/
// HousekeepingTaskHistoryDialog sont réutilisés strictement en lecture —
// mission §6 étudiait explicitement leur réutilisation plutôt que la
// duplication. RoomContextModal et les dialogues d'historique déclenchent
// de vrais GET (lecture seule, jamais d'écriture) : sans backend actif ils
// affichent leur propre état d'erreur déjà géré en production — choix
// assumé plutôt que dupliquer un second composant de contexte.

type ViewMode = 'chambres' | 'taches';
const ALL = 'ALL';

const ROOM_STATUT_LABEL: Record<StatutChambre, string> = {
  LIBRE_PROPRE: 'Libre & propre',
  RESERVEE: 'Réservée',
  OCCUPEE: 'Occupée',
  DEPART_PREVU: 'Départ prévu',
  A_NETTOYER: 'À nettoyer',
  EN_NETTOYAGE: 'En nettoyage',
  EN_MAINTENANCE: 'En maintenance',
};

const ROOM_STATUT_BADGE: Record<
  StatutChambre,
  'success' | 'info' | 'destructive' | 'warning' | 'violet' | 'default'
> = {
  LIBRE_PROPRE: 'success',
  RESERVEE: 'info',
  OCCUPEE: 'default',
  DEPART_PREVU: 'info',
  A_NETTOYER: 'warning',
  EN_NETTOYAGE: 'violet',
  EN_MAINTENANCE: 'destructive',
};

const TASK_STATUT_LABEL: Record<StatutTacheHousekeeping, string> = {
  A_FAIRE: 'À affecter',
  AFFECTEE: 'Affectée',
  EN_COURS: 'En cours',
  TERMINEE: 'À contrôler',
  VALIDEE: 'Validée',
  ANNULEE: 'Annulée',
};

const TASK_STATUT_BADGE: Record<
  StatutTacheHousekeeping,
  'success' | 'info' | 'destructive' | 'warning' | 'violet' | 'default'
> = {
  A_FAIRE: 'default',
  AFFECTEE: 'info',
  EN_COURS: 'violet',
  TERMINEE: 'warning',
  VALIDEE: 'success',
  ANNULEE: 'destructive',
};

const ORIGINE_LABEL: Record<HousekeepingTask['origine'], string> = {
  CHECKOUT: 'Check-out',
  MANUELLE: 'Manuelle',
  REPRISE: 'Reprise',
};

function formatTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Chassis réel : la sidebar filtre déjà par permission (AppSidebar.tsx) —
// pour montrer « tous les autres modules visibles » (mission §16) sans
// modifier AppSidebar, on lui donne l'ensemble des permissions déclarées
// dans NAV_ITEMS plutôt qu'une liste partielle recopiée à la main.
const ALL_NAV_PERMISSIONS = [...new Set(NAV_ITEMS.map((i) => i.permission))];
const MOCK_PERMISSIONS = [
  ...ALL_NAV_PERMISSIONS,
  'housekeeping:control',
  'housekeeping:report-incident',
];

export default function PrototypeHousekeepingA() {
  const [view, setView] = useState<ViewMode>('chambres');
  const [search, setSearch] = useState('');
  const [floorFilter, setFloorFilter] = useState(ALL);
  const [agentFilter, setAgentFilter] = useState(ALL);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [historyTask, setHistoryTask] = useState<HousekeepingTask | null>(null);
  const [reasonTask, setReasonTask] = useState<{
    task: HousekeepingTask;
    action: 'validate' | 'refuse';
  } | null>(null);

  const taskByRoomId = useMemo(() => {
    const map = new Map<number, HousekeepingTask>();
    for (const t of MOCK_ALL_TASKS) {
      if (t.activeRoomKey !== null) map.set(t.roomId, t);
    }
    return map;
  }, []);

  const maintenanceByRoomId = useMemo(() => {
    const map = new Map<number, (typeof MOCK_MAINTENANCE_TICKETS)[number]>();
    for (const ticket of MOCK_MAINTENANCE_TICKETS) {
      if (ticket.roomId !== null && ticket.bloqueVente) {
        map.set(ticket.roomId, ticket);
      }
    }
    return map;
  }, []);

  // BANDE OPÉRATIONNELLE — mission §4/§5 : uniquement des compteurs
  // réellement calculables (REAL/DERIVED, voir rapport §14), pas de KPI
  // décoratif. En production : GET /rooms + GET /housekeeping/tasks?
  // active=true suffisent déjà (aucun nouvel endpoint requis).
  const kpis = useMemo(() => {
    const aNettoyer = MOCK_ROOMS.filter(
      (r) => r.statut === 'A_NETTOYER',
    ).length;
    const enCours = MOCK_ROOMS.filter(
      (r) => r.statut === 'EN_NETTOYAGE',
    ).length;
    const aControler = MOCK_ALL_TASKS.filter(
      (t) => t.statut === 'TERMINEE',
    ).length;
    const bloquees = MOCK_ROOMS.filter(
      (r) => r.statut === 'EN_MAINTENANCE',
    ).length;
    return { aNettoyer, enCours, aControler, bloquees };
  }, []);

  const floors = useMemo(
    () =>
      [...new Set(MOCK_ROOMS.map((r) => r.etage ?? 0))].sort((a, b) => a - b),
    [],
  );

  const agents = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of MOCK_ALL_TASKS) {
      if (t.assignedUser) map.set(t.assignedUser.id, t.assignedUser.nom);
    }
    return [...map.entries()];
  }, []);

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('fr-FR');
    return MOCK_ROOMS.filter((r) => {
      const matchesSearch =
        q.length === 0 || r.numero.toLowerCase().includes(q);
      const matchesFloor =
        floorFilter === ALL || String(r.etage ?? 0) === floorFilter;
      const task = taskByRoomId.get(r.id);
      const matchesAgent =
        agentFilter === ALL ||
        (task?.assignedUser && String(task.assignedUser.id) === agentFilter);
      return matchesSearch && matchesFloor && matchesAgent;
    });
  }, [search, floorFilter, agentFilter, taskByRoomId]);

  const groupedByFloor = useMemo(() => {
    const map = new Map<number, Room[]>();
    for (const r of filteredRooms) {
      const key = r.etage ?? 0;
      const bucket = map.get(key);
      if (bucket) bucket.push(r);
      else map.set(key, [r]);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [filteredRooms]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('fr-FR');
    return MOCK_ALL_TASKS.filter((t) => {
      const matchesSearch =
        q.length === 0 || t.room.numero.toLowerCase().includes(q);
      const matchesFloor =
        floorFilter === ALL || String(t.room.etage) === floorFilter;
      const matchesAgent =
        agentFilter === ALL ||
        (t.assignedUser && String(t.assignedUser.id) === agentFilter);
      return matchesSearch && matchesFloor && matchesAgent;
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [search, floorFilter, agentFilter]);

  const toControlQueue = MOCK_ALL_TASKS.filter((t) => t.statut === 'TERMINEE');

  return (
    <div className="bg-background flex h-screen">
      <AppSidebar
        activeTab={'housekeeping' as Tab}
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
                Housekeeping
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
            <Button variant="outline" className="gap-2">
              <RefreshCw className="size-4" />
              Actualiser
            </Button>
          </div>

          {/* BANDE OPÉRATIONNELLE */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="À nettoyer"
              value={String(kpis.aNettoyer)}
              hint="Chambres A_NETTOYER"
              icon={Sparkles}
              tone={kpis.aNettoyer > 0 ? 'warning' : 'neutral'}
            />
            <KpiCard
              label="En cours"
              value={String(kpis.enCours)}
              hint="Tâches EN_COURS"
              icon={Brush}
              tone="primary"
            />
            <KpiCard
              label="À contrôler"
              value={String(kpis.aControler)}
              hint="Terminées, en attente de la gouvernante"
              icon={ClipboardCheck}
              tone={kpis.aControler > 0 ? 'warning' : 'neutral'}
            />
            <KpiCard
              label="Chambres bloquées"
              value={String(kpis.bloquees)}
              hint="EN_MAINTENANCE (bloque la vente)"
              icon={AlertTriangle}
              tone={kpis.bloquees > 0 ? 'danger' : 'neutral'}
            />
          </div>

          {/* GOUVERNANTE / CONTRÔLE — mission §8 : ne jamais cacher le
              contrôle derrière des clics inutiles. Visible dès qu'une tâche
              attend un contrôle, quelle que soit la vue active. */}
          {toControlQueue.length > 0 && (
            <Card className="border-warning/40 bg-warning-soft/40">
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-warning size-4" />
                  <h2 className="text-sm font-bold">
                    Contrôle gouvernante — {toControlQueue.length}{' '}
                    {toControlQueue.length > 1 ? 'chambres' : 'chambre'} en
                    attente
                  </h2>
                </div>
                <div className="flex flex-col gap-2">
                  {toControlQueue.map((task) => (
                    <div
                      key={task.id}
                      className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                    >
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-bold">
                          Chambre {task.room.numero}
                        </span>
                        <span className="text-muted-foreground">
                          Agent :{' '}
                          {task.assignedUser?.nom ?? 'Aucun agent affecté'}
                        </span>
                        <span className="text-muted-foreground">
                          Terminée à {formatTime(task.completedAt)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setHistoryTask(task)}
                        >
                          Historique
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setReasonTask({ task, action: 'refuse' })
                          }
                        >
                          Refuser
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            setReasonTask({ task, action: 'validate' })
                          }
                        >
                          Valider
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* BARRE OUTILS */}
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
                  aria-selected={view === 'chambres'}
                  onClick={() => setView('chambres')}
                  className={cn(
                    'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                    view === 'chambres'
                      ? 'bg-card shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <LayoutGrid className="size-3.5" />
                  Chambres
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'taches'}
                  onClick={() => setView('taches')}
                  className={cn(
                    'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                    view === 'taches'
                      ? 'bg-card shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <TableIcon className="size-3.5" />
                  Tâches
                </button>
              </div>

              <div className="relative min-w-0 flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher une chambre…"
                  className="pl-8"
                />
              </div>

              <Select
                value={floorFilter}
                onValueChange={(v) => v && setFloorFilter(v)}
                items={[
                  { value: ALL, label: 'Tous les étages' },
                  ...floors.map((f) => ({
                    value: String(f),
                    label: `Étage ${f}`,
                  })),
                ]}
              >
                <SelectTrigger className="w-full lg:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous les étages</SelectItem>
                  {floors.map((f) => (
                    <SelectItem key={f} value={String(f)}>
                      Étage {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={agentFilter}
                onValueChange={(v) => v && setAgentFilter(v)}
                items={[
                  { value: ALL, label: 'Tous les agents' },
                  ...agents.map(([id, nom]) => ({
                    value: String(id),
                    label: nom,
                  })),
                ]}
              >
                <SelectTrigger className="w-full lg:w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous les agents</SelectItem>
                  {agents.map(([id, nom]) => (
                    <SelectItem key={id} value={String(id)}>
                      {nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* ZONE PRINCIPALE */}
          {view === 'chambres' ? (
            <div className="flex flex-col gap-4">
              {groupedByFloor.map(([etage, rooms]) => (
                <div key={etage} className="flex flex-col gap-2">
                  <p className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
                    Étage {etage}
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {rooms.map((r) => {
                      const task = taskByRoomId.get(r.id);
                      const maintenance = maintenanceByRoomId.get(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelectedRoom(r)}
                          className="bg-card hover:border-primary/50 flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-base font-bold">
                              {r.numero}
                            </span>
                            <Badge variant={ROOM_STATUT_BADGE[r.statut]}>
                              {ROOM_STATUT_LABEL[r.statut]}
                            </Badge>
                          </div>
                          <span className="text-muted-foreground text-xs">
                            {r.roomType.nom}
                          </span>
                          {task && (
                            <div className="flex flex-col gap-1 border-t pt-2 text-xs">
                              <Badge
                                variant={TASK_STATUT_BADGE[task.statut]}
                                className="w-fit"
                              >
                                {TASK_STATUT_LABEL[task.statut]}
                              </Badge>
                              <span className="text-muted-foreground truncate">
                                {task.assignedUser?.nom ??
                                  'Aucun agent affecté'}
                              </span>
                            </div>
                          )}
                          {maintenance && (
                            <div className="border-destructive/30 text-destructive flex items-center gap-1 border-t pt-2 text-xs font-medium">
                              <Ban className="size-3" />
                              Bloquant · {maintenance.typePanne}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {groupedByFloor.length === 0 && (
                <p className="text-muted-foreground py-10 text-center text-sm">
                  Aucune chambre ne correspond aux filtres.
                </p>
              )}
            </div>
          ) : (
            <div className="bg-card overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground border-b text-[11px] font-bold tracking-wide uppercase">
                    <th className="px-3 py-2 text-left">Chambre</th>
                    <th className="px-3 py-2 text-left">Étage</th>
                    <th className="px-3 py-2 text-left">Origine</th>
                    <th className="px-3 py-2 text-left">Statut</th>
                    <th className="px-3 py-2 text-left">Agent</th>
                    <th className="px-3 py-2 text-left">Affectée</th>
                    <th className="px-3 py-2 text-left">Démarrée</th>
                    <th className="px-3 py-2 text-left">Terminée</th>
                    <th className="px-3 py-2 text-left">Maintenance</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => {
                    const maintenance = maintenanceByRoomId.get(task.roomId);
                    return (
                      <tr key={task.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2 font-bold">
                          {task.room.numero}
                        </td>
                        <td className="text-muted-foreground px-3 py-2">
                          {task.room.etage}
                        </td>
                        <td className="text-muted-foreground px-3 py-2">
                          {ORIGINE_LABEL[task.origine]}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={TASK_STATUT_BADGE[task.statut]}>
                            {TASK_STATUT_LABEL[task.statut]}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {task.assignedUser?.nom ?? (
                            <span className="text-muted-foreground">
                              Non affecté
                            </span>
                          )}
                        </td>
                        <td className="text-muted-foreground px-3 py-2">
                          {formatTime(task.assignedAt)}
                        </td>
                        <td className="text-muted-foreground px-3 py-2">
                          {formatTime(task.startedAt)}
                        </td>
                        <td className="text-muted-foreground px-3 py-2">
                          {formatTime(task.completedAt)}
                        </td>
                        <td className="px-3 py-2">
                          {maintenance ? (
                            <span className="text-destructive flex items-center gap-1 text-xs font-medium">
                              <Wrench className="size-3" />
                              Bloquant
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1.5">
                            {task.statut === 'TERMINEE' ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setReasonTask({ task, action: 'refuse' })
                                  }
                                >
                                  Refuser
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    setReasonTask({ task, action: 'validate' })
                                  }
                                >
                                  Valider
                                </Button>
                              </>
                            ) : task.statut === 'AFFECTEE' ||
                              task.statut === 'EN_COURS' ? (
                              <Button size="sm" variant="outline" disabled>
                                {task.statut === 'AFFECTEE'
                                  ? 'Démarrer'
                                  : 'Terminer'}
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setHistoryTask(task)}
                            >
                              <History className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTasks.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="text-muted-foreground px-3 py-10 text-center"
                      >
                        Aucune tâche ne correspond aux filtres.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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

      <HousekeepingTaskHistoryDialog
        taskId={historyTask?.id ?? null}
        roomNumero={historyTask?.room.numero ?? null}
        onClose={() => setHistoryTask(null)}
      />

      <HousekeepingReasonDialog
        open={reasonTask !== null}
        onClose={() => setReasonTask(null)}
        title={
          reasonTask?.action === 'validate'
            ? 'Valider la tâche'
            : 'Refuser la tâche'
        }
        confirmLabel={reasonTask?.action === 'validate' ? 'Valider' : 'Refuser'}
        submitting={false}
        // Prototype — aucune mutation réelle (mission §19) : la confirmation
        // ferme simplement le dialogue, elle n'appelle jamais
        // validateHousekeepingTask/refuseHousekeepingTask.
        onConfirm={() => setReasonTask(null)}
      />
    </div>
  );
}
