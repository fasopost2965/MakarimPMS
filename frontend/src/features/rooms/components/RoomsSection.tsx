import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toastManager } from '@/components/ui/toast';
import { listRooms } from '../../reservations/api';
import type { Room, RoomType } from '../../reservations/types';
import {
  createRoom,
  createRoomType,
  deleteRoom,
  listRoomTypes,
  updateRoom,
  updateRoomType,
} from '../api';

type RoomsView = 'chambres' | 'types';

// CH-038 (RD-024, docs/execution/PLAN_FRONTEND_PARITE_ADMIN.md §1) — écran
// d'administration de l'inventaire chambres, adapté de
// MakarimPMS_v2/frontend/src/features/parameters/RoomsSection.tsx (lu
// intégralement avant portage) : logique de filtre par étage réécrite pour
// être dynamique (RD-024 — inventaire configurable, jamais un nombre
// d'étages figé), motif obligatoire ajouté sur toute mutation (absent de
// v2, dont le backend n'a ni audit ni soft delete pour ces routes), aucune
// popup native confirm()/alert() (toastManager + erreurs inline déjà
// établis dans ce frontend).
export function RoomsSection() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<RoomsView>('chambres');
  const [floorFilter, setFloorFilter] = useState<number | 'ALL'>('ALL');

  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<RoomType | null>(null);

  const [deleteMotifs, setDeleteMotifs] = useState<Record<number, string>>({});
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [roomsData, typesData] = await Promise.all([
        listRooms(),
        listRoomTypes(),
      ]);
      setRooms(roomsData);
      setRoomTypes(typesData);
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

  // Étages réellement présents dans l'inventaire chargé — jamais une liste
  // codée en dur (RD-024, l'hôtel peut ajouter des étages).
  const floors = [
    ...new Set(
      rooms
        .map((r) => r.etage)
        .filter((e): e is number => e !== null && e !== undefined),
    ),
  ].sort((a, b) => a - b);
  const filteredRooms =
    floorFilter === 'ALL'
      ? rooms
      : rooms.filter((r) => r.etage === floorFilter);

  async function handleDeleteRoom(id: number) {
    const motif = deleteMotifs[id] ?? '';
    if (motif.length < 10) return;
    setActionError(null);
    setDeletingId(id);
    try {
      await deleteRoom(id, motif);
      toastManager.add({
        title: 'Chambre supprimée',
        type: 'success',
      });
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 border-b pb-2">
        <div className="flex gap-1">
          <Button
            variant={view === 'chambres' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('chambres')}
          >
            Chambres ({rooms.length})
          </Button>
          <Button
            variant={view === 'types' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('types')}
          >
            Types & tarifs de base ({roomTypes.length})
          </Button>
        </div>
        {view === 'chambres' ? (
          <Button
            size="sm"
            onClick={() => {
              setEditingRoom(null);
              setRoomDialogOpen(true);
            }}
            disabled={roomTypes.length === 0}
          >
            + Nouvelle chambre
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              setEditingType(null);
              setTypeDialogOpen(true);
            }}
          >
            + Nouveau type
          </Button>
        )}
      </div>

      {loadError && <p className="text-destructive text-sm">{loadError}</p>}
      {actionError && <p className="text-destructive text-sm">{actionError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : view === 'chambres' ? (
        <div className="flex flex-col gap-3">
          {floors.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant={floorFilter === 'ALL' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFloorFilter('ALL')}
              >
                Tous les étages ({rooms.length})
              </Button>
              {floors.map((f) => (
                <Button
                  key={f}
                  variant={floorFilter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFloorFilter(f)}
                >
                  Étage {f} ({rooms.filter((r) => r.etage === f).length})
                </Button>
              ))}
            </div>
          )}

          {filteredRooms.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aucune chambre pour ce filtre.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Étage</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Suppression (motif ≥ 10 caractères)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRooms.map((room) => {
                  const motif = deleteMotifs[room.id] ?? '';
                  return (
                    <TableRow key={room.id}>
                      <TableCell className="font-medium">
                        {room.numero}
                      </TableCell>
                      <TableCell>{room.etage ?? '—'}</TableCell>
                      <TableCell>{room.roomType.nom}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{room.statut}</Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={motif}
                          onChange={(e) =>
                            setDeleteMotifs({
                              ...deleteMotifs,
                              [room.id]: e.target.value,
                            })
                          }
                          placeholder="Motif de suppression"
                          className="max-w-56"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingRoom(room);
                              setRoomDialogOpen(true);
                            }}
                          >
                            Modifier
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              deletingId === room.id || motif.length < 10
                            }
                            onClick={() => handleDeleteRoom(room.id)}
                          >
                            {deletingId === room.id
                              ? 'Suppression…'
                              : 'Supprimer'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roomTypes.map((rt) => (
            <div
              key={rt.id}
              className="flex flex-col gap-2 rounded-md border p-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{rt.nom}</p>
                  <p className="text-muted-foreground text-xs">
                    {rooms.filter((r) => r.roomTypeId === rt.id).length}{' '}
                    chambre(s) associée(s)
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingType(rt);
                    setTypeDialogOpen(true);
                  }}
                >
                  Modifier
                </Button>
              </div>
              <div className="text-muted-foreground grid grid-cols-2 gap-1 text-xs">
                <span>
                  Tarif de base : {Number(rt.prixBase).toFixed(2)} MAD
                </span>
                <span>Capacité : {rt.capacite} pers.</span>
                {rt.prixPetitDejeuner !== undefined &&
                  Number(rt.prixPetitDejeuner) > 0 && (
                    <span>
                      Petit-déj. : {Number(rt.prixPetitDejeuner).toFixed(2)} MAD
                    </span>
                  )}
                {rt.prixDemiPension !== undefined &&
                  Number(rt.prixDemiPension) > 0 && (
                    <span>
                      Demi-pension : {Number(rt.prixDemiPension).toFixed(2)} MAD
                    </span>
                  )}
                {rt.prixPensionComplete !== undefined &&
                  Number(rt.prixPensionComplete) > 0 && (
                    <span>
                      Pension complète :{' '}
                      {Number(rt.prixPensionComplete).toFixed(2)} MAD
                    </span>
                  )}
              </div>
            </div>
          ))}
          {/* Pas de suppression de RoomType (dette technique assumée,
              docs/modules/rooms.md §16 : catégorie potentiellement
              référencée par des chambres/tarifs/restrictions existants). */}
        </div>
      )}

      <Dialog
        open={roomDialogOpen}
        onOpenChange={(next) => !next && setRoomDialogOpen(false)}
      >
        <DialogContent>
          {roomDialogOpen && (
            <RoomForm
              room={editingRoom}
              roomTypes={roomTypes}
              onClose={() => setRoomDialogOpen(false)}
              onDone={async () => {
                setRoomDialogOpen(false);
                await refetch();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={typeDialogOpen}
        onOpenChange={(next) => !next && setTypeDialogOpen(false)}
      >
        <DialogContent>
          {typeDialogOpen && (
            <RoomTypeForm
              roomType={editingType}
              onClose={() => setTypeDialogOpen(false)}
              onDone={async () => {
                setTypeDialogOpen(false);
                await refetch();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface RoomFormProps {
  room: Room | null;
  roomTypes: RoomType[];
  onClose: () => void;
  onDone: () => void;
}

function RoomForm({ room, roomTypes, onClose, onDone }: RoomFormProps) {
  const [numero, setNumero] = useState(room?.numero ?? '');
  const [etage, setEtage] = useState(room?.etage ? String(room.etage) : '');
  const [roomTypeId, setRoomTypeId] = useState(
    room
      ? String(room.roomTypeId)
      : roomTypes[0]
        ? String(roomTypes[0].id)
        : '',
  );
  const [motif, setMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    numero.trim() !== '' && roomTypeId !== '' && motif.length >= 10;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        numero: numero.trim(),
        roomTypeId: Number(roomTypeId),
        etage: etage ? Number(etage) : undefined,
        motif,
      };
      if (room) {
        await updateRoom(room.id, payload);
      } else {
        await createRoom(payload);
      }
      toastManager.add({
        title: room ? 'Chambre modifiée' : 'Chambre créée',
        description: numero,
        type: 'success',
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {room ? `Modifier la chambre ${room.numero}` : 'Nouvelle chambre'}
        </DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="numero">Numéro</Label>
          <Input
            id="numero"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Ex. 101"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="etage">Étage (optionnel)</Label>
          <Input
            id="etage"
            type="number"
            value={etage}
            onChange={(e) => setEtage(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="roomType">Type de chambre</Label>
          <Select
            value={roomTypeId}
            onValueChange={(v) => v && setRoomTypeId(v)}
          >
            <SelectTrigger id="roomType">
              <SelectValue placeholder="Sélectionner un type" />
            </SelectTrigger>
            <SelectContent>
              {roomTypes.map((rt) => (
                <SelectItem key={rt.id} value={String(rt.id)}>
                  {rt.nom} ({Number(rt.prixBase).toFixed(2)} MAD)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="motif">Motif (≥ 10 caractères)</Label>
          <Input
            id="motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. Ouverture d'une nouvelle chambre au 2e étage"
            required
          />
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
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

interface RoomTypeFormProps {
  roomType: RoomType | null;
  onClose: () => void;
  onDone: () => void;
}

function RoomTypeForm({ roomType, onClose, onDone }: RoomTypeFormProps) {
  const [nom, setNom] = useState(roomType?.nom ?? '');
  const [prixBase, setPrixBase] = useState(roomType?.prixBase ?? '');
  const [capacite, setCapacite] = useState(
    roomType ? String(roomType.capacite) : '2',
  );
  const [prixPetitDejeuner, setPrixPetitDejeuner] = useState(
    roomType?.prixPetitDejeuner ?? '',
  );
  const [prixDemiPension, setPrixDemiPension] = useState(
    roomType?.prixDemiPension ?? '',
  );
  const [prixPensionComplete, setPrixPensionComplete] = useState(
    roomType?.prixPensionComplete ?? '',
  );
  const [motif, setMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    nom.trim() !== '' &&
    prixBase !== '' &&
    Number(capacite) > 0 &&
    motif.length >= 10;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        nom: nom.trim(),
        prixBase,
        capacite: Number(capacite),
        prixPetitDejeuner: prixPetitDejeuner || undefined,
        prixDemiPension: prixDemiPension || undefined,
        prixPensionComplete: prixPensionComplete || undefined,
        motif,
      };
      if (roomType) {
        await updateRoomType(roomType.id, payload);
      } else {
        await createRoomType(payload);
      }
      toastManager.add({
        title: roomType ? 'Type modifié' : 'Type créé',
        description: nom,
        type: 'success',
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {roomType ? `Modifier ${roomType.nom}` : 'Nouveau type de chambre'}
        </DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nom">Nom</Label>
          <Input
            id="nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex. Suite Deluxe"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prixBase">Tarif de base (MAD)</Label>
            <Input
              id="prixBase"
              type="number"
              step="0.01"
              value={prixBase}
              onChange={(e) => setPrixBase(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="capacite">Capacité (pers.)</Label>
            <Input
              id="capacite"
              type="number"
              min="1"
              value={capacite}
              onChange={(e) => setCapacite(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prixPetitDejeuner">Petit-déj. (MAD)</Label>
            <Input
              id="prixPetitDejeuner"
              type="number"
              step="0.01"
              value={prixPetitDejeuner}
              onChange={(e) => setPrixPetitDejeuner(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prixDemiPension">Demi-pension (MAD)</Label>
            <Input
              id="prixDemiPension"
              type="number"
              step="0.01"
              value={prixDemiPension}
              onChange={(e) => setPrixDemiPension(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prixPensionComplete">Pension complète (MAD)</Label>
            <Input
              id="prixPensionComplete"
              type="number"
              step="0.01"
              value={prixPensionComplete}
              onChange={(e) => setPrixPensionComplete(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="typeMotif">Motif (≥ 10 caractères)</Label>
          <Input
            id="typeMotif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. Ajout d'une nouvelle catégorie tarifaire"
            required
          />
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
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
