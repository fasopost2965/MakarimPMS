import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Package, Search, Wrench } from 'lucide-react';
import { listRooms } from '@/features/reservations/api';
import type { Room, StatutChambre } from '@/features/reservations/types';
import { searchGuests } from '@/features/guests/api';
import type { Guest } from '@/features/guests/types';
import { listTickets } from '@/features/maintenance/api';
import type { MaintenanceTicket } from '@/features/maintenance/types';
import { listStockItems } from '@/features/stock/api';
import type { StockItem } from '@/features/stock/types';
import type { Tab } from '@/App';

const STATUT_LABEL: Record<StatutChambre, string> = {
  LIBRE_PROPRE: 'Libre & propre',
  RESERVEE: 'Réservée',
  OCCUPEE: 'Occupée',
  DEPART_PREVU: 'Départ prévu',
  A_NETTOYER: 'À nettoyer',
  EN_NETTOYAGE: 'En nettoyage',
  EN_MAINTENANCE: 'En maintenance',
};

interface SearchResult {
  key: string;
  group: string;
  icon: typeof Search;
  title: string;
  subtitle: string;
  tab: Tab;
}

// Handoff design final, lot 4 (RechercheGlobale.dc.html) — palette ⌘K
// cross-module. Écart assumé vis-à-vis du mockup : sans routeur ni
// deep-linking dans ce projet (même limite déjà documentée pour
// self-checkin/F6), un résultat ne peut pas ouvrir « la fiche déjà
// ouverte » — seule la navigation vers l'onglet source est réellement
// câblable, cohérent avec NotificationCenter (même chantier). Recherche
// réellement cross-module sur des endpoints existants et permission-gated
// (jamais de données fabriquées) : `searchGuests` (recherche serveur
// réelle côté `guests`), `listRooms`/`listTickets`/`listStockItems`
// (filtrage client, listes courtes). Pas de résultat « Actions rapides »
// du mockup (créer une réservation depuis un numéro de chambre) : aucun
// moyen de préremplir CreateReservationDialog depuis ce composant sans
// changement architectural plus large, hors périmètre de ce lot.
export function GlobalSearch({
  permissions,
  onNavigate,
}: {
  permissions: string[] | null;
  onNavigate: (tab: Tab) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const can = (perm: string) => permissions?.includes(perm) ?? false;

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, []);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery('');

    setSelectedIndex(0);
    inputRef.current?.focus();
    if (can('reservations:read')) void listRooms().then(setRooms);
    if (can('maintenance:read')) void listTickets().then(setTickets);
    if (can('stock:read')) void listStockItems().then(setStockItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !can('guests:read') || query.trim().length < 2) {
      return;
    }
    const timer = setTimeout(() => {
      void searchGuests(query.trim()).then((r) => setGuests(r.slice(0, 5)));
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchResult[] = [];

    for (const room of rooms) {
      if (room.numero.toLowerCase().includes(q)) {
        out.push({
          key: `room-${room.id}`,
          group: 'Chambres',
          icon: Building2,
          title: `Chambre ${room.numero} · ${room.roomType.nom}`,
          subtitle: STATUT_LABEL[room.statut],
          tab: 'housekeeping',
        });
      }
    }
    for (const guest of guests) {
      out.push({
        key: `guest-${guest.id}`,
        group: 'Clients',
        icon: Search,
        title: `${guest.nom} ${guest.prenom}`,
        subtitle: guest.telephone ?? guest.email ?? '—',
        tab: 'guests',
      });
    }
    for (const ticket of tickets) {
      const roomLabel = ticket.room
        ? `Ch. ${ticket.room.numero}`
        : 'Zone commune';
      if (
        ticket.typePanne.toLowerCase().includes(q) ||
        ticket.room?.numero.toLowerCase().includes(q)
      ) {
        out.push({
          key: `ticket-${ticket.id}`,
          group: 'Tickets maintenance',
          icon: Wrench,
          title: `${roomLabel} — ${ticket.typePanne}`,
          subtitle: ticket.resoluAt ? 'Résolu' : `Priorité ${ticket.priorite}`,
          tab: 'maintenance',
        });
      }
    }
    for (const item of stockItems) {
      if (
        item.libelle.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q)
      ) {
        out.push({
          key: `stock-${item.id}`,
          group: 'Stock',
          icon: Package,
          title: item.libelle,
          subtitle: `${item.quantiteDisponible} ${item.uniteMesure} disponible(s)`,
          tab: 'stock',
        });
      }
    }
    return out.slice(0, 20);
  }, [query, rooms, guests, tickets, stockItems]);

  function activate(result: SearchResult) {
    onNavigate(result.tab);
    setOpen(false);
  }

  function handleInputKeydown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      activate(results[selectedIndex]);
    }
  }

  const groups = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      if (!map.has(r.group)) map.set(r.group, []);
      map.get(r.group)!.push(r);
    }
    return [...map.entries()];
  }, [results]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:border-primary/40 hidden h-8.5 min-w-40 items-center gap-2 rounded-md border px-3 text-xs sm:flex"
      >
        <Search className="size-3.5" />
        Rechercher…
        <kbd className="bg-muted ml-auto rounded px-1.5 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center pt-24">
      <div
        className="fixed inset-0 bg-black/40"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        className="bg-popover relative flex w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Recherche globale"
      >
        <div className="flex items-center gap-2.5 border-b px-4 py-3">
          <Search className="text-muted-foreground size-4 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeydown}
            placeholder="Chambre, client, ticket, article…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">
            Esc
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {query.trim().length > 0 && results.length === 0 && (
            <p className="text-muted-foreground p-4 text-center text-sm">
              Aucun résultat.
            </p>
          )}
          {groups.map(([group, items]) => (
            <div key={group}>
              <p className="text-muted-foreground px-2.5 pt-2 pb-1 text-[10.5px] font-bold tracking-wide uppercase">
                {group}
              </p>
              {items.map((r) => {
                const idx = results.indexOf(r);
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => activate(r)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ${
                      idx === selectedIndex ? 'bg-muted' : ''
                    }`}
                  >
                    <span className="bg-primary/8 flex size-8 shrink-0 items-center justify-center rounded-md">
                      <r.icon className="text-primary size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {r.title}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {r.subtitle}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="text-muted-foreground flex items-center gap-4 border-t px-4 py-2 text-[11px]">
          <span className="flex items-center gap-1">
            <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono">↑↓</kbd>{' '}
            Naviguer
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono">↵</kbd>{' '}
            Ouvrir
          </span>
        </div>
      </div>
    </div>
  );
}
