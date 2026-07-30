import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

// Module maintenance simplifié (cahier des charges §5.8, Phase 2) : liste
// des tickets, création (chambre optionnelle — bloque automatiquement la
// chambre en maintenance côté backend, voir MaintenanceService.createTicket)
// et résolution (libère la chambre s'il n'y a plus de ticket ouvert dessus).
// Photo upload via FileUpload, conversion File → data URI base64 côté client,
// stockage LONGTEXT (CH-055).
export function MaintenancePage() {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [statutFilter, setStatutFilter] = useState<PrioriteTicket | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ticketsData, roomsData] = await Promise.all([
        listTickets(),
        listRooms(),
      ]);
      setTickets(ticketsData);
      setRooms(roomsData);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  async function handleResolve(id: number) {
    setActionError(null);
    setResolvingId(id);
    try {
      await resolveTicket(id);
      await refetch();
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
      await refetch();
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

  const filteredTickets = statutFilter
    ? tickets.filter((t) => t.priorite === statutFilter)
    : tickets;

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PRIORITES.slice()
            .reverse()
            .map((priorite) => {
              const active = statutFilter === priorite;
              return (
                <button
                  key={priorite}
                  type="button"
                  onClick={() =>
                    setStatutFilter((current) =>
                      current === priorite ? null : priorite,
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

      {loadError && <p className="text-destructive text-sm">{loadError}</p>}
      {actionError && <p className="text-destructive text-sm">{actionError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : tickets.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun ticket.</p>
      ) : (
        <div className="bg-card overflow-hidden rounded-lg border">
          <div className="bg-muted/60 text-muted-foreground grid grid-cols-[44px_1fr_110px_110px_90px_110px] items-center gap-3 border-b px-4 py-2 text-[11px] font-bold tracking-wide uppercase">
            <span />
            <span>Ticket</span>
            <span>Priorité</span>
            <span>Assigné</span>
            <span>Statut</span>
            <span className="text-right">Action</span>
          </div>

          {filteredTickets.length === 0 && (
            <p className="text-muted-foreground p-4 text-sm">
              Aucun ticket pour ce filtre.
            </p>
          )}

          {filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="hover:bg-muted/40 grid grid-cols-[44px_1fr_110px_110px_90px_110px] items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0"
            >
              {ticket.photoUrl ? (
                <button
                  type="button"
                  onClick={() => setViewingPhoto(ticket.photoUrl)}
                  className="flex-shrink-0 rounded hover:opacity-80"
                >
                  <img
                    src={ticket.photoUrl}
                    alt={`Ticket ${ticket.id}`}
                    className="size-9 rounded object-cover"
                  />
                </button>
              ) : (
                <span
                  className={`flex size-9 items-center justify-center rounded-md ${
                    ticket.resoluAt
                      ? 'bg-muted text-muted-foreground'
                      : PRIORITE_ICON_BG_CLASS[ticket.priorite]
                  }`}
                >
                  <Wrench className="size-4" />
                </span>
              )}
              <span className="min-w-0 truncate font-medium">
                {ticket.room ? `Chambre ${ticket.room.numero}` : 'Zone commune'}{' '}
                — {ticket.typePanne}
              </span>
              <span>
                <Badge variant={PRIORITE_BADGE_VARIANT[ticket.priorite]}>
                  {PRIORITE_LABEL[ticket.priorite]}
                </Badge>
              </span>
              <span className="text-muted-foreground truncate text-xs">
                {ticket.assigneA ?? '—'}
              </span>
              <span>
                <Badge variant={ticket.resoluAt ? 'success' : 'info'}>
                  {ticket.resoluAt ? 'Résolu' : 'Ouvert'}
                </Badge>
              </span>
              <span className="flex justify-end">
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
              onClose={() => setDialogOpen(false)}
              onConfirm={handleCreate}
              submitting={submitting}
              error={formError}
            />
          )}
        </DialogContent>
      </Dialog>

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
  onClose: () => void;
  onConfirm: (input: CreateMaintenanceTicketInput) => void;
  submitting: boolean;
  error: string | null;
}

function CreateTicketForm({
  rooms,
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
