import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  cancelReservation,
  createReservation,
  listReservations,
  listRooms,
  updateReservation,
} from "../api";
import {
  addDays,
  formatDayLabel,
  getDateRange,
  startOfDay,
  toISODate,
} from "../date-utils";
import type { Reservation, Room } from "../types";
import {
  CreateReservationDialog,
  type CreateReservationSelection,
} from "../components/CreateReservationDialog";
import { ReservationDetailsDialog } from "../components/ReservationDetailsDialog";
import type { GuestSelection } from "@/features/guests/components/GuestPicker";

const VISIBLE_DAYS = 14;
const ROW_HEIGHT = 44;
const LABEL_COL_WIDTH = 140;

interface Selecting {
  roomId: number;
  startIdx: number;
  endIdx: number;
}

export function ReservationsCalendarPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [windowStart, setWindowStart] = useState(() => startOfDay(new Date()));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selecting, setSelecting] = useState<Selecting | null>(null);
  // Miroir toujours à jour de `selecting`, lu depuis les handlers mousedown/
  // mouseenter : entre deux événements rapides d'un drag, le re-render React
  // déclenché par setSelecting() n'a pas forcément eu le temps de se
  // propager, donc `selecting` (capturé par closure) peut être obsolète —
  // un ref n'a pas ce problème.
  const selectingRef = useRef<Selecting | null>(null);
  // Lus par le listener mouseup imperatif de beginSelection() (voir plus
  // bas) : toujours à jour, pour ne pas figer rooms/days au moment où le
  // callback a été créé.
  const roomsRef = useRef<Room[]>([]);
  const daysRef = useRef<Date[]>([]);
  const [pendingSelection, setPendingSelection] =
    useState<CreateReservationSelection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewingReservation, setViewingReservation] =
    useState<Reservation | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const days = useMemo(
    () => getDateRange(windowStart, VISIBLE_DAYS),
    [windowStart],
  );
  const windowEnd = useMemo(
    () => addDays(windowStart, VISIBLE_DAYS),
    [windowStart],
  );
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);
  useEffect(() => {
    daysRef.current = days;
  }, [days]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [roomsData, reservationsData] = await Promise.all([
        listRooms(),
        listReservations({
          du: toISODate(windowStart),
          au: toISODate(windowEnd),
        }),
      ]);
      setRooms(roomsData);
      setReservations(reservationsData.filter((r) => r.statut !== "ANNULEE"));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [windowStart, windowEnd]);

  useEffect(() => {
    // Chargement des données au montage / changement de fenêtre de dates —
    // pas de condition de course ici (un seul fetch dépendant de windowStart).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  // Démarre une sélection glisser-déposer : l'écouteur mouseup global est
  // attaché ici, de façon impérative et synchrone avec le mousedown — pas
  // via un useEffect. Un effect ne s'attacherait qu'après le prochain
  // render/commit, laissant une fenêtre (même courte) pendant laquelle un
  // clic-relâché rapide ne serait pas capturé et laisserait la sélection
  // affichée bloquée.
  const beginSelection = useCallback((roomId: number, dayIndex: number) => {
    const initial = { roomId, startIdx: dayIndex, endIdx: dayIndex };
    selectingRef.current = initial;
    setSelecting(initial);

    const onMouseUp = () => {
      const current = selectingRef.current;
      const room =
        current && roomsRef.current.find((r) => r.id === current.roomId);
      if (current && room) {
        const from = Math.min(current.startIdx, current.endIdx);
        const to = Math.max(current.startIdx, current.endIdx);
        setPendingSelection({
          room,
          dateArrivee: toISODate(daysRef.current[from]),
          dateDepart: toISODate(addDays(daysRef.current[to], 1)),
        });
      }
      selectingRef.current = null;
      setSelecting(null);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  async function handleConfirmCreate(guestSelection: GuestSelection) {
    if (!pendingSelection) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createReservation({
        roomId: pendingSelection.room.id,
        dateArrivee: pendingSelection.dateArrivee,
        dateDepart: pendingSelection.dateDepart,
        ...guestSelection,
      });
      setPendingSelection(null);
      await refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erreur de création");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDrop(
    reservationId: number,
    roomId: number,
    dayIndex: number,
  ) {
    const reservation = reservations.find((r) => r.id === reservationId);
    if (!reservation) return;

    const nights = Math.round(
      (new Date(reservation.dateDepart).getTime() -
        new Date(reservation.dateArrivee).getTime()) /
        86_400_000,
    );
    const newDateArrivee = days[dayIndex];
    const newDateDepart = addDays(newDateArrivee, nights);

    setActionError(null);
    try {
      await updateReservation(reservationId, {
        roomId,
        dateArrivee: toISODate(newDateArrivee),
        dateDepart: toISODate(newDateDepart),
      });
      await refetch();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erreur de déplacement",
      );
    }
  }

  async function handleCancel(reservationId: number) {
    setActionError(null);
    try {
      await cancelReservation(reservationId);
      await refetch();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erreur d'annulation",
      );
    }
  }

  async function handleSaveDetails(input: {
    prixTotalFinal?: number;
    motifAjustement?: string;
  }) {
    if (!viewingReservation) return;
    if (input.prixTotalFinal === undefined) {
      setViewingReservation(null);
      return;
    }
    setSavingDetails(true);
    setDetailsError(null);
    try {
      await updateReservation(viewingReservation.id, input);
      setViewingReservation(null);
      await refetch();
    } catch (err) {
      setDetailsError(
        err instanceof Error ? err.message : "Erreur de mise à jour du prix",
      );
    } finally {
      setSavingDetails(false);
    }
  }

  const gridTemplateColumns = `${LABEL_COL_WIDTH}px repeat(${VISIBLE_DAYS}, minmax(64px, 1fr))`;

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium">Réservations — planning</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setWindowStart((d) => addDays(d, -7))}
          >
            ← Semaine précédente
          </Button>
          <Button
            variant="outline"
            onClick={() => setWindowStart(startOfDay(new Date()))}
          >
            Aujourd'hui
          </Button>
          <Button
            variant="outline"
            onClick={() => setWindowStart((d) => addDays(d, 7))}
          >
            Semaine suivante →
          </Button>
        </div>
      </div>

      {loadError && <p className="text-destructive text-sm">{loadError}</p>}
      {actionError && <p className="text-destructive text-sm">{actionError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : (
        <div className="overflow-x-auto rounded-md border select-none">
          <div className="grid" style={{ gridTemplateColumns }}>
            {/* En-tête des dates */}
            <div className="bg-muted/50 border-b p-2 text-xs font-medium">
              Chambre
            </div>
            {days.map((day, i) => (
              <div
                key={i}
                className="bg-muted/50 border-b border-l p-2 text-center text-xs font-medium capitalize"
              >
                {formatDayLabel(day)}
              </div>
            ))}

            {/* Lignes chambres */}
            {rooms.map((room) => {
              const roomReservations = reservations.filter(
                (r) => r.roomId === room.id,
              );
              return (
                <div key={room.id} className="contents">
                  <div
                    className="flex items-center border-b p-2 text-sm font-medium"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {room.numero}
                    <span className="text-muted-foreground ml-1 text-xs">
                      {room.roomType.nom}
                    </span>
                  </div>

                  {days.map((day, dayIndex) => {
                    const reservationHere = roomReservations.find((r) => {
                      const arrivee = startOfDay(new Date(r.dateArrivee));
                      const depart = startOfDay(new Date(r.dateDepart));
                      return day >= arrivee && day < depart;
                    });
                    const isStart =
                      reservationHere &&
                      toISODate(new Date(reservationHere.dateArrivee)) ===
                        toISODate(day);

                    return (
                      <div
                        key={dayIndex}
                        className="relative border-b border-l"
                        style={{ height: ROW_HEIGHT }}
                        onMouseDown={() => {
                          if (!reservationHere) {
                            beginSelection(room.id, dayIndex);
                          }
                        }}
                        onMouseEnter={() => {
                          const current = selectingRef.current;
                          if (current && current.roomId === room.id) {
                            const next = { ...current, endIdx: dayIndex };
                            selectingRef.current = next;
                            setSelecting(next);
                          }
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const id = Number(
                            e.dataTransfer.getData("text/plain"),
                          );
                          if (id) void handleDrop(id, room.id, dayIndex);
                        }}
                      >
                        {selecting &&
                          selecting.roomId === room.id &&
                          dayIndex >=
                            Math.min(selecting.startIdx, selecting.endIdx) &&
                          dayIndex <=
                            Math.max(selecting.startIdx, selecting.endIdx) && (
                            <div className="bg-primary/20 absolute inset-0.5 rounded" />
                          )}

                        {reservationHere && isStart && (
                          <ReservationBar
                            reservation={reservationHere}
                            days={days}
                            dayIndex={dayIndex}
                            onCancel={() => handleCancel(reservationHere.id)}
                            onView={() =>
                              setViewingReservation(reservationHere)
                            }
                            // Pendant un drag de création, la barre ne doit
                            // pas intercepter les événements souris des
                            // colonnes qu'elle recouvre visuellement — sinon
                            // le survol/relâchement de clic sur ces cases
                            // n'atteint jamais la cellule sous-jacente.
                            disablePointerEvents={selecting !== null}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        Glisser-déposer sur des cases vides pour créer une réservation. Glisser
        une réservation existante vers une autre case pour la déplacer.
      </p>

      <CreateReservationDialog
        selection={pendingSelection}
        onClose={() => {
          setPendingSelection(null);
          setSubmitError(null);
        }}
        onConfirm={handleConfirmCreate}
        submitting={submitting}
        error={submitError}
      />

      <ReservationDetailsDialog
        reservation={viewingReservation}
        onClose={() => {
          setViewingReservation(null);
          setDetailsError(null);
        }}
        onSave={handleSaveDetails}
        saving={savingDetails}
        error={detailsError}
      />
    </div>
  );
}

function ReservationBar({
  reservation,
  days,
  dayIndex,
  onCancel,
  onView,
  disablePointerEvents,
}: {
  reservation: Reservation;
  days: Date[];
  dayIndex: number;
  onCancel: () => void;
  onView: () => void;
  disablePointerEvents: boolean;
}) {
  const depart = startOfDay(new Date(reservation.dateDepart));
  let span = 0;
  for (let i = dayIndex; i < days.length && days[i] < depart; i++) span++;

  return (
    <div
      draggable
      onDragStart={(e) =>
        e.dataTransfer.setData("text/plain", String(reservation.id))
      }
      onClick={onView}
      className={`bg-primary text-primary-foreground absolute inset-y-0.5 left-0.5 z-10 flex cursor-grab items-center justify-between gap-1 truncate rounded px-2 text-xs active:cursor-grabbing ${disablePointerEvents ? "pointer-events-none" : ""}`}
      style={{ width: `calc(${span * 100}% - 4px)` }}
      title={`${reservation.guest.nom} ${reservation.guest.prenom} — ${reservation.dateArrivee.slice(0, 10)} → ${reservation.dateDepart.slice(0, 10)} — ${reservation.prixTotalFinal} DH${reservation.ajustementManuel ? " (ajusté)" : ""}`}
    >
      <span className="truncate">
        {reservation.guest.nom} {reservation.guest.prenom}
        {reservation.ajustementManuel && " *"}
      </span>
      <button
        type="button"
        className="shrink-0 opacity-70 hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        aria-label="Annuler la réservation"
      >
        ×
      </button>
    </div>
  );
}
