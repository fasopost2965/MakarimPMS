import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, Package, Wrench } from 'lucide-react';
import { listTickets } from '@/features/maintenance/api';
import { listStockItems } from '@/features/stock/api';
import { listLogs } from '@/features/notifications/api';
import type { Tab } from '@/App';

interface Alert {
  key: string;
  title: string;
  description: string;
  icon: typeof Wrench;
  tone: 'destructive' | 'warning';
  tab: Tab;
}

// Handoff design final, lot 3 (NotificationDetail.dc.html) — flyout de la
// cloche du topbar. Écart assumé vis-à-vis du mockup : aucun concept
// d'« inbox » interne au personnel n'existe côté backend (NotificationLog,
// F7, ne journalise que les envois CRM sortants vers les clients, jamais
// une alerte destinée au personnel) — donc pas de statut lu/non-lu
// persisté, pas de « Tout marquer comme lu », pas de detail épinglé avec
// actions dédiées. À la place : agrégation en direct de 3 signaux réels
// déjà exposés par des endpoints existants (tickets de maintenance
// urgents ouverts, articles de stock sous seuil d'alerte, envois CRM en
// échec) — chaque permission est vérifiée avant l'appel correspondant, un
// clic navigue vers l'écran source réel. Le badge n'est jamais un compteur
// figé : il reflète l'état opérationnel courant et disparaît de lui-même
// une fois le problème réellement résolu (ticket clos, stock réassorti,
// envoi retenté avec succès) — plus honnête qu'un « lu » qui masquerait
// un problème encore actif.
export function NotificationCenter({
  permissions,
  onNavigate,
}: {
  permissions: string[] | null;
  onNavigate: (tab: Tab) => void;
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refetch = useCallback(async () => {
    if (!permissions) return;
    const tasks: Promise<Alert[]>[] = [];

    if (permissions.includes('maintenance:read')) {
      tasks.push(
        listTickets({ ouvert: true })
          .then((tickets) =>
            tickets
              .filter((t) => t.priorite === 'URGENTE')
              .map((t) => ({
                key: `maintenance-${t.id}`,
                title: t.room
                  ? `Ticket urgent — Chambre ${t.room.numero}`
                  : 'Ticket urgent — Zone commune',
                description: t.typePanne,
                icon: Wrench,
                tone: 'destructive' as const,
                tab: 'maintenance' as const,
              })),
          )
          .catch(() => []),
      );
    }

    if (permissions.includes('stock:read')) {
      tasks.push(
        listStockItems()
          .then((items) =>
            items
              .filter((i) => i.sousSeuilAlerte)
              .map((i) => ({
                key: `stock-${i.id}`,
                title: `Stock bas — ${i.libelle}`,
                description: `${i.quantiteDisponible} ${i.uniteMesure} restant(s), seuil ${i.seuilAlerte}`,
                icon: Package,
                tone: 'warning' as const,
                tab: 'stock' as const,
              })),
          )
          .catch(() => []),
      );
    }

    if (permissions.includes('notifications:read')) {
      tasks.push(
        listLogs()
          .then((logs) =>
            logs
              .filter((l) => l.statut === 'ECHEC')
              .slice(0, 5)
              .map((l) => ({
                key: `notification-${l.id}`,
                title: `Envoi ${l.canal.toLowerCase()} échoué`,
                description: l.erreur ?? l.destinataire,
                icon: AlertTriangle,
                tone: 'warning' as const,
                tab: 'notifications' as const,
              })),
          )
          .catch(() => []),
      );
    }

    const results = await Promise.all(tasks);
    setAlerts(results.flat());
  }, [permissions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
    const interval = setInterval(() => void refetch(), 60_000);
    return () => clearInterval(interval);
  }, [refetch]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        className="hover:bg-muted relative flex size-9 items-center justify-center rounded-md"
      >
        <Bell className="size-4.5" />
        {alerts.length > 0 && (
          <span className="bg-destructive border-card absolute top-1 right-1.5 size-2 rounded-full border" />
        )}
      </button>

      {open && (
        <div className="bg-popover absolute top-11 right-0 z-20 flex max-h-96 w-80 flex-col overflow-hidden rounded-lg border shadow-lg">
          <div className="border-b px-3.5 py-2.5">
            <p className="text-sm font-bold">Alertes opérationnelles</p>
            <p className="text-muted-foreground text-xs">
              {alerts.length === 0
                ? 'Aucune alerte en ce moment'
                : `${alerts.length} point${alerts.length > 1 ? 's' : ''} à traiter`}
            </p>
          </div>
          <div className="overflow-y-auto">
            {alerts.map((alert) => (
              <button
                key={alert.key}
                type="button"
                onClick={() => {
                  onNavigate(alert.tab);
                  setOpen(false);
                }}
                className="hover:bg-muted flex w-full items-start gap-2.5 border-b px-3.5 py-2.5 text-left last:border-b-0"
              >
                <alert.icon
                  className={`mt-0.5 size-4 shrink-0 ${
                    alert.tone === 'destructive'
                      ? 'text-destructive'
                      : 'text-warning'
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">
                    {alert.title}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {alert.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
