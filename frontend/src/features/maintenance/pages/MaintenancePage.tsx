import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/ui/file-upload';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTicket, listRooms, listTickets, resolveTicket } from '../api';
import { MaintenanceTicketDetailDialog } from '../components/MaintenanceTicketDetailDialog';
import type {
  CreateMaintenanceTicketInput,
  MaintenanceTicket,
  PrioriteTicket,
} from '../types';
import type { Room } from '../../reservations/types';

const PRIORITES: PrioriteTicket[] = ['BASSE', 'MOYENNE', 'HAUTE', 'URGENTE'];

const PRIORITE_LABEL: Record<PrioriteTicket, string> = {
  BASSE: 'Basse',
  MOYENNE: 'Moyenne',
  HAUTE: 'Haute',
  URGENTE: 'Urgente',
};

// CH-063 (docs/design/design_handoff_exploitation_hotel) — alignement sur
// l'échelle sémantique déjà utilisée ailleurs (Housekeeping, Réservations) :
// Urgente=danger, Haute=alerte, Moyenne=info, Basse=neutre. L'ancien mapping
// (secondary/default) ne distinguait pas visuellement Haute de Urgente.
const PRIORITE_BADGE_VARIANT: Record<
  PrioriteTicket,
  'secondary' | 'info' | 'warning' | 'destructive'
> = {
  BASSE: 'secondary',
  MOYENNE: 'info',
  HAUTE: 'warning',
  URGENTE: 'destructive',
};

const PRIORITE_DOT_CLASS: Record<PrioriteTicket, string> = {
  BASSE: 'bg-muted-foreground',
  MOYENNE: 'bg-info',
  HAUTE: 'bg-warning',
  URGENTE: 'bg-destructive',
};

// Classes statiques (Tailwind ne peut pas résoudre un nom de classe construit
// dynamiquement par interpolation — les classes doivent apparaître en clair
// dans le code source pour être détectées par le scanner JIT).
const PRIORITE_ICON_BG_CLASS: Record<PrioriteTicket, string> = {
  BASSE: 'bg-secondary text-secondary-foreground',
  MOYENNE: 'bg-info/15 text-info',
  HAUTE: 'bg-warning/15 text-warning',
  URGENTE: 'bg-destructive/15 text-destructive',
};

function formatDateCourte(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

const PHOTO_MAX_SIZE_MB = 5;
const PHOTO_MAX_SIZE_BYTES = PHOTO_MAX_SIZE_MB * 1024 * 1024;
const ALL_PRIORITIES = 'ALL';
const ALL_STATUSES = 'ALL';
const OPEN_STATUS = 'OPEN';
const RESOLVED_STATUS = 'RESOLVED';
const ALL_ROOMS = 'ALL';
const COMMON_AREA = 'COMMON_AREA';

// Module maintenance simplifié (cahier des charges §5.8, Phase 2) : liste
// des tickets, création (chambre optionnelle — bloque automatiquement la
// chambre en maintenance côté backend, voir MaintenanceService.createTicket)
// et résolution (libère la chambre s'il n'y a plus de ticket ouvert dessus).
// Photo upload via FileUpload, conversion File → data URI base64 côté client,
// stockage LONGTEXT (CH-055).
export function MaintenancePage() {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<
    PrioriteTicket | typeof ALL_PRIORITIES
  >(ALL_PRIORITIES);
  const [statusFilter, setStatusFilter] = useState<
    typeof ALL_STATUSES | typeof OPEN_STATUS | typeof RESOLVED_STATUS
  >(ALL_STATUSES);
  const [roomFilter, setRoomFilter] = useState(ALL_ROOMS);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [detailTicketId, setDetailTicketId] = useState<number | null>(null);

  const refetchTickets = useCallback(async () => {
    setTicketsLoading(true);
    setTicketsError(null);
    try {
      setTickets(await listTickets());
    } catch (err) {
      setTicketsError(
        err instanceof Error ? err.message : 'Erreur de chargement des tickets',
      );
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  const refetchRooms = useCallback(async () => {
    setRoomsLoading(true);
    setRoomsError(null);
    try {
      setRooms(await listRooms());
    } catch (err) {
      setRoomsError(
        err instanceof Error
          ? err.message
          : 'Erreur de chargement des chambres',
      );
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetchTickets();
    void refetchRooms();
  }, [refetchRooms, refetchTickets]);

  async function handleResolve(id: number) {
    setActionError(null);
    setResolvingId(id);
    try {
      await resolveTicket(id);
      await refetchTickets();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setResolvingId(null);
    }
  }

  async function handleCreate(input: CreateMaintenanceTicketInput) {
    setFormError(null);
    setSubmitting(true);
    try {
      await createTicket(input);
      setDialogOpen(false);
      await refetchTickets();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  const ouvertsParPriorite = useMemo(() => {
    const counts = new Map<PrioriteTicket, number>();
    for (const ticket of tickets) {
      if (ticket.resoluAt) continue;
      counts.set(ticket.priorite, (counts.get(ticket.priorite) ?? 0) + 1);
    }
    return counts;
  }, [tickets]);

  const ticketRooms = useMemo(() => {
    const byId = new Map<number, Room>();
    for (const ticket of tickets) {
      if (ticket.room) byId.set(ticket.room.id, ticket.room);
    }
    return [...byId.values()].sort((a, b) =>
      a.numero.localeCompare(b.numero, undefined, { numeric: true }),
    );
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('fr-FR');

    return tickets.filter((ticket) => {
      const matchesPriority =
        priorityFilter === ALL_PRIORITIES || ticket.priorite === priorityFilter;
      const matchesStatus =
        statusFilter === ALL_STATUSES ||
        (statusFilter === OPEN_STATUS
          ? ticket.resoluAt === null
          : ticket.resoluAt !== null);
      const matchesRoom =
        roomFilter === ALL_ROOMS ||
        (roomFilter === COMMON_AREA
          ? ticket.roomId === null
          : ticket.roomId === Number(roomFilter));
      const searchableValues = [
        ticket.typePanne,
        ticket.room?.numero ?? '',
        ticket.assigneA ?? '',
        String(ticket.id),
      ];
      const matchesSearch =
        normalizedSearch.length === 0 ||
        searchableValues.some((value) =>
          value.toLocaleLowerCase('fr-FR').includes(normalizedSearch),
        );

      return matchesPriority && matchesStatus && matchesRoom && matchesSearch;
    });
  }, [priorityFilter, roomFilter, search, statusFilter, tickets]);

  const filtersActive =
    priorityFilter !== ALL_PRIORITIES ||
    statusFilter !== ALL_STATUSES ||
    roomFilter !== ALL_ROOMS ||
    search.trim().length > 0;

  function resetFilters() {
    setPriorityFilter(ALL_PRIORITIES);
    setStatusFilter(ALL_STATUSES);
    setRoomFilter(ALL_ROOMS);
    setSearch('');
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          aria-label="Tickets ouverts par priorité"
        >
          {PRIORITES.slice()
            .reverse()
            .map((priorite) => {
              const active = priorityFilter === priorite;
              return (
                <button
                  key={priorite}
                  type="button"
                  aria-pressed={active}
                  aria-label={`${PRIORITE_LABEL[priorite]} : ${ouvertsParPriorite.get(priorite) ?? 0} tickets ouverts`}
                  onClick={() =>
                    setPriorityFilter((current) =>
                      current === priorite ? ALL_PRIORITIES : priorite,
                    )
                  }
                  className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs transition-colors ${
                    active
                      ? 'border-primary bg-primary/10'
                      : priorite === 'URGENTE' &&
                          (ouvertsParPriorite.get('URGENTE') ?? 0) > 0
                        ? 'border-destructive/30 bg-destructive/10'
                        : 'bg-card hover:bg-muted/50'
                  }`}
                >
                  <span
                    className={`size-2 rounded-full ${PRIORITE_DOT_CLASS[priorite]}`}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-bold">
                    {ouvertsParPriorite.get(priorite) ?? 0}
                  </span>
                  <span className="text-muted-foreground">
                    {PRIORITE_LABEL[priorite]}
                  </span>
                </button>
              );
            })}
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          + Nouveau ticket
        </Button>
      </div>

      {actionError && <p className="text-destructive text-sm">{actionError}</p>}

      <div className="bg-card grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_auto] lg:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="maintenance-priority-filter">Priorité</Label>
          <Select
            value={priorityFilter}
            onValueChange={(value) =>
              value &&
              setPriorityFilter(value as PrioriteTicket | typeof ALL_PRIORITIES)
            }
            items={[
              { value: ALL_PRIORITIES, label: 'Toutes les priorités' },
              ...PRIORITES.map((priority) => ({
                value: priority,
                label: PRIORITE_LABEL[priority],
              })),
            ]}
          >
            <SelectTrigger id="maintenance-priority-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PRIORITIES}>
                Toutes les priorités
              </SelectItem>
              {PRIORITES.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {PRIORITE_LABEL[priority]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="maintenance-status-filter">Statut</Label>
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              value &&
              setStatusFilter(
                value as
                  | typeof ALL_STATUSES
                  | typeof OPEN_STATUS
                  | typeof RESOLVED_STATUS,
              )
            }
            items={[
              { value: ALL_STATUSES, label: 'Tous les statuts' },
              { value: OPEN_STATUS, label: 'Ouverts' },
              { value: RESOLVED_STATUS, label: 'Résolus' },
            ]}
          >
            <SelectTrigger id="maintenance-status-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>Tous les statuts</SelectItem>
              <SelectItem value={OPEN_STATUS}>Ouverts</SelectItem>
              <SelectItem value={RESOLVED_STATUS}>Résolus</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="maintenance-room-filter">Chambre</Label>
          <Select
            value={roomFilter}
            onValueChange={(value) => value && setRoomFilter(value)}
            items={[
              { value: ALL_ROOMS, label: 'Toutes les chambres' },
              { value: COMMON_AREA, label: 'Zone commune' },
              ...ticketRooms.map((room) => ({
                value: String(room.id),
                label: `Chambre ${room.numero}`,
              })),
            ]}
          >
            <SelectTrigger id="maintenance-room-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ROOMS}>Toutes les chambres</SelectItem>
              <SelectItem value={COMMON_AREA}>Zone commune</SelectItem>
              {ticketRooms.map((room) => (
                <SelectItem key={room.id} value={String(room.id)}>
                  Chambre {room.numero}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="maintenance-search">Recherche</Label>
          <Input
            id="maintenance-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Panne, chambre, assigné ou identifiant"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          className="sm:col-span-2 lg:col-span-4 lg:justify-self-end"
          onClick={resetFilters}
          disabled={!filtersActive}
        >
          Réinitialiser
        </Button>
      </div>

      <p className="text-muted-foreground text-sm" aria-live="polite">
        {filteredTickets.length}{' '}
        {filteredTickets.length > 1 ? 'tickets' : 'ticket'} sur {tickets.length}
      </p>

      {ticketsError && (
        <ErrorState
          title="Impossible de charger les tickets"
          description={ticketsError}
          onRetry={() => void refetchTickets()}
        />
      )}

      {ticketsLoading && tickets.length === 0 ? (
        <p className="text-muted-foreground text-sm" role="status">
          Chargement des tickets…
        </p>
      ) : tickets.length === 0 ? (
        !ticketsError ? (
          <EmptyState
            title="Aucun ticket de maintenance"
            description="Aucun ticket n’est actuellement disponible."
          />
        ) : null
      ) : filteredTickets.length === 0 ? (
        <EmptyState
          title="Aucun ticket ne correspond aux filtres"
          description="Modifiez vos critères ou réinitialisez les filtres pour afficher les tickets."
          action={
            filtersActive
              ? { label: 'Réinitialiser les filtres', onClick: resetFilters }
              : undefined
          }
        />
      ) : (
        <div className="bg-card overflow-hidden rounded-lg border">
          <div className="bg-muted/60 text-muted-foreground hidden grid-cols-[44px_1fr_110px_110px_90px_110px] items-center gap-3 border-b px-4 py-2 text-[11px] font-bold tracking-wide uppercase md:grid">
            <span aria-hidden="true" />
            <span>Ticket</span>
            <span>Priorité</span>
            <span>Assigné</span>
            <span>Statut</span>
            <span className="text-right">Action</span>
          </div>

          {filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="hover:bg-muted/40 grid grid-cols-[minmax(0,1fr)_minmax(110px,auto)] items-center gap-2 border-b px-4 py-3 text-sm last:border-b-0 md:grid-cols-[44px_1fr_110px_110px_90px_110px] md:gap-3 md:py-2.5"
            >
              {ticket.photoUrl ? (
                <button
                  type="button"
                  onClick={() => setViewingPhoto(ticket.photoUrl)}
                  className="col-start-1 row-start-1 w-fit flex-shrink-0 rounded hover:opacity-80 focus-visible:ring-2 md:col-auto md:row-auto"
                  aria-label={`Voir la photo du ticket ${ticket.id}`}
                >
                  <img
                    src={ticket.photoUrl}
                    alt=""
                    className="size-9 rounded object-cover"
                  />
                </button>
              ) : (
                <span
                  className={`col-start-1 row-start-1 flex size-9 items-center justify-center rounded-md md:col-auto md:row-auto ${
                    ticket.resoluAt
                      ? 'bg-muted text-muted-foreground'
                      : PRIORITE_ICON_BG_CLASS[ticket.priorite]
                  }`}
                  aria-hidden="true"
                >
                  <Wrench className="size-4" />
                </span>
              )}
              <button
                type="button"
                onClick={() => setDetailTicketId(ticket.id)}
                className="col-start-1 row-start-2 min-w-0 truncate rounded text-left font-medium outline-none hover:underline focus-visible:ring-2 md:col-auto md:row-auto"
                aria-label={`Voir le détail du ticket ${ticket.id}`}
              >
                {ticket.room ? `Chambre ${ticket.room.numero}` : 'Zone commune'}{' '}
                — {ticket.typePanne}
              </button>
              <span className="col-start-1 row-start-3 md:col-auto md:row-auto">
                <Badge variant={PRIORITE_BADGE_VARIANT[ticket.priorite]}>
                  {PRIORITE_LABEL[ticket.priorite]}
                </Badge>
              </span>
              <span className="text-muted-foreground col-start-1 row-start-4 truncate text-xs md:col-auto md:row-auto">
                {ticket.assigneA ?? '—'}
              </span>
              <span className="col-start-2 row-start-1 justify-self-end md:col-auto md:row-auto md:justify-self-auto">
                <Badge variant={ticket.resoluAt ? 'success' : 'info'}>
                  {ticket.resoluAt ? 'Résolu' : 'Ouvert'}
                </Badge>
              </span>
              <span className="col-start-2 row-span-3 row-start-2 flex justify-end md:col-auto md:row-auto md:row-span-1">
                {ticket.resoluAt ? (
                  <span
                    className="text-muted-foreground text-xs"
                    title={`Résolu le ${new Date(ticket.resoluAt).toLocaleString('fr-FR')}`}
                  >
                    {formatDateCourte(ticket.resoluAt)}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolvingId === ticket.id}
                    onClick={() => handleResolve(ticket.id)}
                  >
                    {resolvingId === ticket.id ? 'Résolution…' : 'Résoudre'}
                  </Button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => !next && setDialogOpen(false)}
      >
        <DialogContent>
          {dialogOpen && (
            <CreateTicketForm
              rooms={rooms}
              roomsLoading={roomsLoading}
              roomsError={roomsError}
              onRetryRooms={() => void refetchRooms()}
              onClose={() => setDialogOpen(false)}
              onConfirm={handleCreate}
              submitting={submitting}
              error={formError}
            />
          )}
        </DialogContent>
      </Dialog>

      <MaintenanceTicketDetailDialog
        ticketId={detailTicketId}
        onClose={() => setDetailTicketId(null)}
      />

      <Dialog
        open={viewingPhoto !== null}
        onOpenChange={(next) => !next && setViewingPhoto(null)}
      >
        <DialogContent className="max-w-2xl">
          {viewingPhoto && (
            <div className="flex flex-col items-center gap-4">
              <img
                src={viewingPhoto}
                alt="Ticket détail"
                className="max-h-96 max-w-full rounded"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewingPhoto(null)}
              >
                Fermer
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CreateTicketFormProps {
  rooms: Room[];
  roomsLoading: boolean;
  roomsError: string | null;
  onRetryRooms: () => void;
  onClose: () => void;
  onConfirm: (input: CreateMaintenanceTicketInput) => void;
  submitting: boolean;
  error: string | null;
}

function CreateTicketForm({
  rooms,
  roomsLoading,
  roomsError,
  onRetryRooms,
  onClose,
  onConfirm,
  submitting,
  error,
}: CreateTicketFormProps) {
  const [roomId, setRoomId] = useState('');
  const [typePanne, setTypePanne] = useState('');
  const [priorite, setPriorite] = useState<PrioriteTicket>('MOYENNE');
  const [assigneA, setAssigneA] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nouveau ticket de maintenance</DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!typePanne) return;
          setPhotoError(null);

          let photoUrl: string | undefined;
          if (photoFile) {
            if (photoFile.size > PHOTO_MAX_SIZE_BYTES) {
              setPhotoError(
                `La photo dépasse la taille maximale (${PHOTO_MAX_SIZE_MB} Mo)`,
              );
              return;
            }
            try {
              photoUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result;
                  if (typeof result === 'string') {
                    resolve(result);
                  } else {
                    reject(new Error('Erreur lors de la lecture du fichier'));
                  }
                };
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(photoFile);
              });
            } catch (err) {
              setPhotoError(
                err instanceof Error
                  ? err.message
                  : 'Erreur lors du chargement',
              );
              return;
            }
          }

          onConfirm({
            roomId: roomId ? Number(roomId) : undefined,
            typePanne,
            priorite,
            assigneA: assigneA || undefined,
            photoUrl,
          });
        }}
      >
        {roomsLoading && rooms.length === 0 && (
          <p className="text-muted-foreground text-sm" role="status">
            Chargement des chambres…
          </p>
        )}

        {roomsError && (
          <ErrorState
            title="Impossible de charger les chambres"
            description={roomsError}
            onRetry={onRetryRooms}
          />
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="room">Chambre (optionnel)</Label>
          <Select
            value={roomId}
            onValueChange={(v) => setRoomId(v ?? '')}
            items={[
              { value: '', label: 'Zone commune / non applicable' },
              ...rooms.map((room) => ({
                value: String(room.id),
                label: `${room.numero} — ${room.roomType.nom}`,
              })),
            ]}
          >
            <SelectTrigger id="room" className="w-full">
              <SelectValue placeholder="Aucune chambre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Zone commune / non applicable</SelectItem>
              {rooms.map((room) => (
                <SelectItem key={room.id} value={String(room.id)}>
                  {room.numero} — {room.roomType.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="typePanne">Type de panne</Label>
          <Input
            id="typePanne"
            value={typePanne}
            onChange={(e) => setTypePanne(e.target.value)}
            placeholder="Ex. Climatisation, Plomberie…"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="priorite">Priorité</Label>
          <Select
            value={priorite}
            onValueChange={(v) => v && setPriorite(v as PrioriteTicket)}
            items={PRIORITES.map((p) => ({
              value: p,
              label: PRIORITE_LABEL[p],
            }))}
          >
            <SelectTrigger id="priorite" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITE_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assigneA">Assigné à (optionnel)</Label>
          <Input
            id="assigneA"
            value={assigneA}
            onChange={(e) => setAssigneA(e.target.value)}
            placeholder="Technicien ou prestataire"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="photoUrl">Photo (optionnel)</Label>
          <FileUpload
            id="photoUrl"
            accept="image/jpeg,image/png,image/webp"
            value={photoFile}
            onChange={setPhotoFile}
            hint={`Max ${PHOTO_MAX_SIZE_MB} Mo (JPEG, PNG, WebP)`}
          />
          {photoError && (
            <p className="text-destructive text-sm">{photoError}</p>
          )}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={submitting || !typePanne}>
            {submitting ? 'Création…' : 'Créer le ticket'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
