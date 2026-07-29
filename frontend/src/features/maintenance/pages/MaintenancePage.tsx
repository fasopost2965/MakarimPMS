import { useCallback, useEffect, useState } from 'react';
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

const PRIORITE_BADGE_VARIANT: Record<
  PrioriteTicket,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  BASSE: 'outline',
  MOYENNE: 'secondary',
  HAUTE: 'default',
  URGENTE: 'destructive',
};

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

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
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
        <div className="flex flex-col gap-2">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="flex items-center justify-between gap-2 rounded-md border p-3"
            >
              <div className="flex items-center gap-3">
                {ticket.photoUrl && (
                  <button
                    type="button"
                    onClick={() => setViewingPhoto(ticket.photoUrl)}
                    className="flex-shrink-0 rounded object-cover hover:opacity-80"
                  >
                    <img
                      src={ticket.photoUrl}
                      alt={`Ticket ${ticket.id}`}
                      className="h-10 w-10 rounded object-cover"
                    />
                  </button>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {ticket.room
                        ? `Chambre ${ticket.room.numero}`
                        : 'Zone commune'}{' '}
                      — {ticket.typePanne}
                    </p>
                    <Badge variant={PRIORITE_BADGE_VARIANT[ticket.priorite]}>
                      {PRIORITE_LABEL[ticket.priorite]}
                    </Badge>
                    <Badge variant={ticket.resoluAt ? 'outline' : 'secondary'}>
                      {ticket.resoluAt ? 'Résolu' : 'Ouvert'}
                    </Badge>
                  </div>
                  {ticket.assigneA && (
                    <p className="text-muted-foreground text-xs">
                      Assigné à {ticket.assigneA}
                    </p>
                  )}
                </div>
              </div>

              {!ticket.resoluAt && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resolvingId === ticket.id}
                  onClick={() => handleResolve(ticket.id)}
                >
                  {resolvingId === ticket.id ? 'Résolution…' : 'Résoudre'}
                </Button>
              )}
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
