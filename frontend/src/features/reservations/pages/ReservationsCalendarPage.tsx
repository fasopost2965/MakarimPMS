import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  BedDouble,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Globe,
  Phone,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  cancelReservation,
  createReservation,
  listReservations,
  listRooms,
  updateReservation,
} from "../api";
import {
  addDays,
  getDateRange,
  startOfDay,
  toISODate,
} from "../date-utils";
import type { Reservation, Room, StatutChambre } from "../types";
import {
  CreateReservationDialog,
  type CreateReservationSelection,
  type EnrichedReservationPayload,
} from "../components/CreateReservationDialog";
import { ReservationDetailsDialog } from "../components/ReservationDetailsDialog";

const ROW_HEIGHT = 46;
const LABEL_COL_WIDTH = 180;

interface Selecting {
  roomId: number;
  startIdx: number;
  endIdx: number;
}

const STATUS_CONFIG: Record<
  StatutChambre,
  { label: string; dotClass: string; bgClass: string }
> = {
  LIBRE_PROPRE: {
    label: "Propre",
    dotClass: "bg-emerald-500",
    bgClass: "bg-emerald-500/10 text-emerald-700",
  },
  RESERVEE: {
    label: "Réservée",
    dotClass: "bg-blue-500",
    bgClass: "bg-blue-500/10 text-blue-700",
  },
  OCCUPEE: {
    label: "Occupée",
    dotClass: "bg-indigo-500",
    bgClass: "bg-indigo-500/10 text-indigo-700",
  },
  DEPART_PREVU: {
    label: "Départ",
    dotClass: "bg-purple-500",
    bgClass: "bg-purple-500/10 text-purple-700",
  },
  A_NETTOYER: {
    label: "À nettoyer",
    dotClass: "bg-amber-500",
    bgClass: "bg-amber-500/10 text-amber-700",
  },
  EN_NETTOYAGE: {
    label: "En cours",
    dotClass: "bg-orange-500",
    bgClass: "bg-orange-500/10 text-orange-700",
  },
  EN_MAINTENANCE: {
    label: "Maint.",
    dotClass: "bg-red-500",
    bgClass: "bg-red-500/10 text-red-700",
  },
};

export function ReservationsCalendarPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [windowStart, setWindowStart] = useState(() => startOfDay(new Date()));
  const [visibleDays, setVisibleDays] = useState<number>(14);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [selectedFloor, setSelectedFloor] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [selecting, setSelecting] = useState<Selecting | null>(null);
  const selectingRef = useRef<Selecting | null>(null);
  const roomsRef = useRef<Room[]>([]);
  const daysRef = useRef<Date[]>([]);
  const [pendingSelection, setPendingSelection] =
    useState<CreateReservationSelection | null>(null);
  const [isOpenManualDialog, setIsOpenManualDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewingReservation, setViewingReservation] =
    useState<Reservation | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const days = useMemo(
    () => getDateRange(windowStart, visibleDays),
    [windowStart, visibleDays],
  );
  const windowEnd = useMemo(
    () => addDays(windowStart, visibleDays),
    [windowStart, visibleDays],
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  // Drag selection listener
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

  async function handleConfirmCreate(payload: EnrichedReservationPayload) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createReservation({
        roomId: payload.roomId,
        dateArrivee: payload.dateArrivee,
        dateDepart: payload.dateDepart,
        canal: payload.canal,
        formule: payload.formule,
        sourceBrute: payload.sourceBrute,
        ...payload.guestSelection,
      });

      // If custom price adjustment was requested, apply it
      if (payload.prixTotalFinal !== undefined) {
        await updateReservation(created.id, {
          prixTotalFinal: payload.prixTotalFinal,
          motifAjustement: payload.motifAjustement || "Remise à la création",
        });
      }

      setPendingSelection(null);
      setIsOpenManualDialog(false);
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

  // Organize 24 Rooms into Floors & Filter
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      // Floor check
      if (selectedFloor === "1") {
        if (!room.numero.startsWith("1")) return false;
      } else if (selectedFloor === "2") {
        if (!room.numero.startsWith("2")) return false;
      } else if (selectedFloor === "3") {
        if (!room.numero.startsWith("3")) return false;
      }

      // Category check
      if (selectedCategory !== "ALL") {
        if (
          !room.roomType.nom
            .toLowerCase()
            .includes(selectedCategory.toLowerCase())
        ) {
          return false;
        }
      }

      // Search query check (room number or guest name in reservations)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesRoom = room.numero.includes(q);
        const matchesGuest = reservations.some(
          (r) =>
            r.roomId === room.id &&
            (`${r.guest.nom} ${r.guest.prenom}`.toLowerCase().includes(q) ||
              r.guest.telephone?.includes(q)),
        );
        if (!matchesRoom && !matchesGuest) return false;
      }

      return true;
    });
  }, [rooms, reservations, selectedFloor, selectedCategory, searchQuery]);

  // Group filtered rooms by Floor
  const groupedRoomsByFloor = useMemo(() => {
    const floor1 = filteredRooms.filter((r) => r.numero.startsWith("1"));
    const floor2 = filteredRooms.filter((r) => r.numero.startsWith("2"));
    const floor3 = filteredRooms.filter((r) => r.numero.startsWith("3"));
    const other = filteredRooms.filter(
      (r) =>
        !r.numero.startsWith("1") &&
        !r.numero.startsWith("2") &&
        !r.numero.startsWith("3"),
    );

    const groups: Array<{ name: string; rooms: Room[] }> = [];
    if (floor1.length > 0)
      groups.push({ name: "1er Étage (101 - 108)", rooms: floor1 });
    if (floor2.length > 0)
      groups.push({ name: "2ème Étage (201 - 208)", rooms: floor2 });
    if (floor3.length > 0)
      groups.push({ name: "3ème Étage (301 - 308)", rooms: floor3 });
    if (other.length > 0)
      groups.push({ name: "Autres Chambres", rooms: other });

    return groups;
  }, [filteredRooms]);

  // Operational KPIs
  const totalRoomsCount = rooms.length || 24;
  const occupiedCount = rooms.filter(
    (r) => r.statut === "OCCUPEE" || r.statut === "RESERVEE",
  ).length;
  const cleanCount = rooms.filter((r) => r.statut === "LIBRE_PROPRE").length;
  const dirtyCount = rooms.filter((r) => r.statut === "A_NETTOYER").length;
  const occupancyRate = totalRoomsCount
    ? Math.round((occupiedCount / totalRoomsCount) * 100)
    : 0;

  const todayIso = toISODate(startOfDay(new Date()));

  const gridTemplateColumns = `${LABEL_COL_WIDTH}px repeat(${visibleDays}, minmax(64px, 1fr))`;

  return (
    <div className="flex h-full flex-col gap-4 p-6 bg-background">
      {/* EXECUTIVE HEADER & KPIS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CalendarIcon className="size-6 text-primary" />
              <span>Planning & Moteur de Réservations</span>
            </h1>
            <Badge variant="outline" className="font-mono text-xs">
              24 Chambres Hôtel Makarim
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gestion dynamique des nuitées, attribution de chambres et
            glisser-déposer PMS
          </p>
        </div>

        {/* KPI CARDS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2 shadow-xs">
            <BedDouble className="size-4 text-emerald-600" />
            <div className="text-left">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                Taux Occupation
              </p>
              <p className="text-sm font-bold text-foreground">
                {occupancyRate}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2 shadow-xs">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <div className="text-left">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                Libres Propres
              </p>
              <p className="text-sm font-bold text-emerald-600">
                {cleanCount} / 24
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2 shadow-xs">
            <AlertTriangle className="size-4 text-amber-500" />
            <div className="text-left">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                À Nettoyer
              </p>
              <p className="text-sm font-bold text-amber-600">{dirtyCount}</p>
            </div>
          </div>

          <Button
            onClick={() => setIsOpenManualDialog(true)}
            className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-sm ml-2"
          >
            <Plus className="size-4" />
            <span>Nouvelle Réservation</span>
          </Button>
        </div>
      </div>

      {/* FILTER & CONTROLS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3">
        {/* Date Navigation & Horizon view */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border bg-background shadow-xs">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setWindowStart((d) => addDays(d, -7))}
              title="Semaine précédente"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-semibold px-2"
              onClick={() => setWindowStart(startOfDay(new Date()))}
            >
              Aujourd'hui
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setWindowStart((d) => addDays(d, 7))}
              title="Semaine suivante"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* Days Horizon Select */}
          <div className="flex items-center rounded-md border bg-background text-xs p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setVisibleDays(7)}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                visibleDays === 7
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              7 Jours
            </button>
            <button
              type="button"
              onClick={() => setVisibleDays(14)}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                visibleDays === 14
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              14 Jours
            </button>
            <button
              type="button"
              onClick={() => setVisibleDays(30)}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                visibleDays === 30
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              30 Jours (Mois)
            </button>
          </div>
        </div>

        {/* Floor & Category Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Floor filter */}
          <div className="flex items-center gap-1 bg-background border rounded-md px-2 py-1 text-xs">
            <Layers className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground hidden sm:inline">
              Étage:
            </span>
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="bg-transparent border-none font-semibold focus:outline-hidden text-xs"
            >
              <option value="ALL">Tous les étages (24)</option>
              <option value="1">1er Étage (101-108)</option>
              <option value="2">2ème Étage (201-208)</option>
              <option value="3">3ème Étage (301-308)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1 bg-background border rounded-md px-2 py-1 text-xs">
            <BedDouble className="size-3.5 text-muted-foreground" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent border-none font-semibold focus:outline-hidden text-xs"
            >
              <option value="ALL">Toutes catégories</option>
              <option value="Single">Single</option>
              <option value="Double">Double</option>
              <option value="Suite">Suite</option>
            </select>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher client ou ch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8 w-44 bg-background"
            />
          </div>
        </div>
      </div>

      {loadError && (
        <p className="text-destructive text-xs font-semibold">{loadError}</p>
      )}
      {actionError && (
        <p className="text-destructive text-xs font-semibold">{actionError}</p>
      )}

      {/* MATRIX PLANNING GRID */}
      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Clock className="size-4 animate-spin text-primary" />
          <span>Chargement du planning des 24 chambres…</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs select-none">
          <div className="grid" style={{ gridTemplateColumns }}>
            {/* HEADER COLUMNS (Chambre + Dates) */}
            <div className="bg-muted/70 border-b p-2 text-xs font-bold text-muted-foreground flex items-center">
              Chambre / Étage
            </div>

            {days.map((day, i) => {
              const dayIso = toISODate(day);
              const isToday = dayIso === todayIso;
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;

              return (
                <div
                  key={i}
                  className={`border-b border-l p-1.5 text-center text-xs font-medium capitalize flex flex-col justify-center ${
                    isToday
                      ? "bg-emerald-500/15 font-bold text-emerald-950 dark:text-emerald-300 border-b-emerald-500"
                      : isWeekend
                        ? "bg-muted/40 font-medium"
                        : "bg-muted/20"
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground">
                    {day.toLocaleDateString("fr-FR", { weekday: "short" })}
                  </span>
                  <span
                    className={`text-xs ${isToday ? "font-extrabold text-emerald-600" : ""}`}
                  >
                    {day.getDate()}{" "}
                    {day.toLocaleDateString("fr-FR", { month: "short" })}
                  </span>
                </div>
              );
            })}

            {/* ROOM ROWS GROUPED BY FLOOR */}
            {groupedRoomsByFloor.map((group) => (
              <div key={group.name} className="contents">
                {/* FLOOR HEADER BARS */}
                <div className="col-span-full bg-muted/80 border-y px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>{group.name}</span>
                  <span className="text-[10px] font-normal">
                    {group.rooms.length} chambres
                  </span>
                </div>

                {group.rooms.map((room) => {
                  const roomReservations = reservations.filter(
                    (r) => r.roomId === room.id,
                  );
                  const statusInfo =
                    STATUS_CONFIG[room.statut] || STATUS_CONFIG.LIBRE_PROPRE;

                  return (
                    <div key={room.id} className="contents">
                      {/* ROOM LABEL CELL */}
                      <div
                        className="flex items-center justify-between border-b p-2 bg-background hover:bg-muted/30 transition-colors"
                        style={{ height: ROW_HEIGHT }}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`size-2.5 rounded-full shrink-0 ${statusInfo.dotClass}`}
                            title={statusInfo.label}
                          />
                          <div className="flex flex-col truncate">
                            <span className="font-bold text-xs leading-tight text-foreground">
                              Ch. {room.numero}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate">
                              {room.roomType.nom}
                            </span>
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1 py-0 ${statusInfo.bgClass}`}
                        >
                          {room.roomType.prixBase} MAD
                        </Badge>
                      </div>

                      {/* DATE CELLS FOR THIS ROOM */}
                      {days.map((day, dayIndex) => {
                        const dayIso = toISODate(day);
                        const isToday = dayIso === todayIso;
                        const isWeekend =
                          day.getDay() === 0 || day.getDay() === 6;

                        const reservationHere = roomReservations.find((r) => {
                          const arrivee = startOfDay(new Date(r.dateArrivee));
                          const depart = startOfDay(new Date(r.dateDepart));
                          return day >= arrivee && day < depart;
                        });

                        const isStart =
                          reservationHere &&
                          toISODate(new Date(reservationHere.dateArrivee)) ===
                            dayIso;

                        return (
                          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                          <div
                            key={dayIndex}
                            className={`relative border-b border-l transition-colors ${
                              isToday
                                ? "bg-emerald-500/5"
                                : isWeekend
                                  ? "bg-muted/15"
                                  : ""
                            }`}
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
                                Math.min(
                                  selecting.startIdx,
                                  selecting.endIdx,
                                ) &&
                              dayIndex <=
                                Math.max(
                                  selecting.startIdx,
                                  selecting.endIdx,
                                ) && (
                                <div className="bg-primary/25 absolute inset-0.5 rounded border border-primary/50 z-20 flex items-center justify-center text-[10px] font-bold text-primary">
                                  + Nouvelle
                                </div>
                              )}

                            {reservationHere && isStart && (
                              <ReservationBar
                                reservation={reservationHere}
                                days={days}
                                dayIndex={dayIndex}
                                onCancel={() =>
                                  handleCancel(reservationHere.id)
                                }
                                onView={() =>
                                  setViewingReservation(reservationHere)
                                }
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
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
        <p>
          💡 Astuce PMS: Glisser sur des cases vides pour ajouter une
          réservation. Faites glisser une réservation pour changer de chambre ou
          décaler la date.
        </p>

        {/* Legend */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px]">
            <span className="size-2 rounded-full bg-blue-500" /> Booking.com
          </span>
          <span className="flex items-center gap-1 text-[11px]">
            <span className="size-2 rounded-full bg-amber-500" /> Walk-In
          </span>
          <span className="flex items-center gap-1 text-[11px]">
            <span className="size-2 rounded-full bg-emerald-500" /> Direct
          </span>
        </div>
      </div>

      {/* CREATE DIALOG */}
      <CreateReservationDialog
        selection={pendingSelection}
        allRooms={rooms}
        isOpenDirectly={isOpenManualDialog}
        onClose={() => {
          setPendingSelection(null);
          setIsOpenManualDialog(false);
          setSubmitError(null);
        }}
        onConfirm={handleConfirmCreate}
        submitting={submitting}
        error={submitError}
      />

      {/* DETAILS DIALOG */}
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

  // Channel color scheme
  let barColorClass = "bg-emerald-700 text-white border-emerald-800";
  let channelBadge = "Direct";

  if (reservation.canal === "BOOKING_COM") {
    barColorClass = "bg-blue-600 text-white border-blue-700";
    channelBadge = "B.com";
  } else if (reservation.canal === "WALK_IN") {
    barColorClass = "bg-amber-600 text-white border-amber-700";
    channelBadge = "Walk-In";
  }

  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      onDragStart={(e) =>
        e.dataTransfer.setData("text/plain", String(reservation.id))
      }
      onClick={onView}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView();
        }
      }}
      className={`absolute inset-y-0.5 left-0.5 z-10 flex cursor-grab items-center justify-between gap-1.5 truncate rounded-md px-2 text-xs font-medium shadow-xs border hover:brightness-110 active:cursor-grabbing transition-all ${barColorClass} ${
        disablePointerEvents ? "pointer-events-none" : ""
      }`}
      style={{ width: `calc(${span * 100}% - 4px)` }}
      title={`${reservation.guest.nom} ${reservation.guest.prenom} (${channelBadge}) — du ${reservation.dateArrivee.slice(0, 10)} au ${reservation.dateDepart.slice(0, 10)} — ${reservation.prixTotalFinal} MAD`}
    >
      <div className="flex items-center gap-1.5 truncate">
        {reservation.canal === "BOOKING_COM" ? (
          <Globe className="size-3 shrink-0" />
        ) : reservation.canal === "WALK_IN" ? (
          <UserCheck className="size-3 shrink-0" />
        ) : (
          <Phone className="size-3 shrink-0" />
        )}
        <span className="truncate font-semibold text-xs">
          {reservation.guest.nom} {reservation.guest.prenom}
          {reservation.ajustementManuel && " *"}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] opacity-90 font-mono">
          {reservation.prixTotalFinal} MAD
        </span>
        <button
          type="button"
          className="shrink-0 opacity-70 hover:opacity-100 hover:bg-black/20 rounded p-0.5"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          aria-label="Annuler la réservation"
        >
          ×
        </button>
      </div>
    </div>
  );
}
