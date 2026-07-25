import { useState } from "react";
import {
  Bell,
  AlertTriangle,
  Star,
  ShieldAlert,
  X,
  ChevronRight,
  Info,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Tab } from "@/App";

export interface DashboardAlert {
  id: string;
  type: "CRITICAL" | "VIP" | "WARNING" | "INFO";
  title: string;
  message: string;
  actionText: string;
  targetTab: Tab;
  timeAgo: string;
}

interface Props {
  onNavigate: (target: Tab) => void;
  unassignedArrivalsCount?: number;
}

const defaultAlerts: DashboardAlert[] = [
  {
    id: "alert-vip-1",
    type: "VIP",
    title: "Arrivée VIP Confirmée",
    message:
      "M. Bennani (Président Groupe Maghreb) arrive à 14:30. Prévoir protocole d'accueil et carte VIP.",
    actionText: "Préparer Accueil",
    targetTab: "checkin",
    timeAgo: "Il y a 10 min",
  },
  {
    id: "alert-unassigned-2",
    type: "CRITICAL",
    title: "Chambre Non Attribuée",
    message:
      "2 arrivées du jour n'ont pas encore de chambre attribuée sur le planning.",
    actionText: "Attribuer Chambres",
    targetTab: "reservations",
    timeAgo: "Il y a 25 min",
  },
  {
    id: "alert-police-3",
    type: "WARNING",
    title: "Conformité Fiches DGSN",
    message:
      "3 clients enregistrés n'ont pas encore leur fiche de police validée ou scannée.",
    actionText: "Scanner OCR",
    targetTab: "document-ocr",
    timeAgo: "Il y a 45 min",
  },
  {
    id: "alert-maint-4",
    type: "WARNING",
    title: "Maintenance en Chambre #203",
    message: "Ticket de maintenance ouvert pour problème de coffre-fort.",
    actionText: "Voir Maintenance",
    targetTab: "housekeeping",
    timeAgo: "Il y a 1 heure",
  },
];

export function AlertsPanel({ onNavigate }: Props) {
  const [alerts, setAlerts] = useState<DashboardAlert[]>(defaultAlerts);

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="rounded-lg border bg-card p-5 shadow-xs flex flex-col gap-4">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="relative p-2 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <Bell className="size-4" />
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 size-2 rounded-full bg-rose-600 animate-ping" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight">
              Alertes & Notifications Urgentes
            </h3>
            <p className="text-muted-foreground text-xs">
              Événements critiques nécessitant votre attention immédiate
            </p>
          </div>
        </div>

        <Badge
          variant={alerts.length > 0 ? "destructive" : "outline"}
          className="text-xs"
        >
          {alerts.length} {alerts.length > 1 ? "alertes" : "alerte"}
        </Badge>
      </div>

      {/* ALERTS LIST */}
      <div className="flex flex-col gap-3">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed rounded-lg">
            <Check className="size-8 text-emerald-500 mb-1" />
            <p className="font-semibold text-xs text-foreground">
              Aucune alerte urgente pour le moment !
            </p>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              Le service de réception et la gouvernance fonctionnent
              nominalement.
            </p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`relative flex flex-col gap-2 p-3.5 rounded-lg border transition-all text-xs ${
                alert.type === "CRITICAL"
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100"
                  : alert.type === "VIP"
                    ? "bg-purple-500/10 border-purple-500/30 text-purple-950 dark:text-purple-100"
                    : alert.type === "WARNING"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100"
                      : "bg-blue-500/10 border-blue-500/30 text-blue-950 dark:text-blue-100"
              }`}
            >
              {/* DISMISS BUTTON */}
              <button
                type="button"
                onClick={() => dismissAlert(alert.id)}
                className="absolute top-2.5 right-2.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
                title="Masquer l'alerte"
              >
                <X className="size-3.5" />
              </button>

              <div className="flex items-center gap-2 pr-6">
                {alert.type === "CRITICAL" && (
                  <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                {alert.type === "VIP" && (
                  <Star className="size-4 text-purple-600 dark:text-purple-400 shrink-0 fill-purple-600/30" />
                )}
                {alert.type === "WARNING" && (
                  <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                )}
                {alert.type === "INFO" && (
                  <Info className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />
                )}

                <span className="font-bold text-xs">{alert.title}</span>
                <span className="text-[10px] text-muted-foreground ml-auto pr-2">
                  {alert.timeAgo}
                </span>
              </div>

              <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-muted-foreground/90">
                {alert.message}
              </p>

              <div className="flex items-center justify-end gap-2 mt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onNavigate(alert.targetTab)}
                  className="h-7 text-[11px] gap-1 px-3"
                >
                  <span>{alert.actionText}</span>
                  <ChevronRight className="size-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
