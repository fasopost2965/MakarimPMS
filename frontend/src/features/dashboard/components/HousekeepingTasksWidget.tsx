import { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Tab } from "@/App";

export interface OperationalTask {
  id: string;
  chambre: string;
  type: "HOUSEKEEPING" | "MAINTENANCE" | "CHECKIN_PREP";
  priorite: "URGENTE" | "HAUTE" | "NORMALE";
  titre: string;
  description: string;
  heureEcheance: string;
  terminee: boolean;
}

interface Props {
  onNavigate: (target: Tab) => void;
  chambresANettoyerCount?: number;
}

const initialTasks: OperationalTask[] = [
  {
    id: "task-1",
    chambre: "102",
    type: "HOUSEKEEPING",
    priorite: "URGENTE",
    titre: "Nettoyage Approfondi VIP",
    description:
      "Chambre à préparer pour arrivée VIP M. Bennani prévue à 14:00",
    heureEcheance: "13:30",
    terminee: false,
  },
  {
    id: "task-2",
    chambre: "204",
    type: "MAINTENANCE",
    priorite: "HAUTE",
    titre: "Vérification Climatisation",
    description: "Signalement bruit anormal sur unité split",
    heureEcheance: "15:00",
    terminee: false,
  },
  {
    id: "task-3",
    chambre: "305",
    type: "HOUSEKEEPING",
    priorite: "NORMALE",
    titre: "Recouche Quotidienne & Linge",
    description: "Changement complet des draps et serviettes (Séjour en cours)",
    heureEcheance: "16:00",
    terminee: false,
  },
  {
    id: "task-4",
    chambre: "108",
    type: "CHECKIN_PREP",
    priorite: "HAUTE",
    titre: "Inspection & Kit d'Accueil",
    description: "Contrôle qualité final + disposition corbeille de fruits",
    heureEcheance: "14:30",
    terminee: false,
  },
];

export function HousekeepingTasksWidget({
  onNavigate,
  chambresANettoyerCount = 3,
}: Props) {
  const [tasks, setTasks] = useState<OperationalTask[]>(initialTasks);
  const [filter, setFilter] = useState<"ALL" | "HOUSEKEEPING" | "MAINTENANCE">(
    "ALL",
  );

  const toggleTaskCompleted = (id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, terminee: !task.terminee } : task,
      ),
    );
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === "ALL") return true;
    return task.type === filter;
  });

  const pendingCount = tasks.filter((t) => !t.terminee).length;

  return (
    <div className="rounded-lg border bg-card p-5 shadow-xs flex flex-col gap-4">
      {/* HEADER & COUNTER */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight">
              Tâches Opérationnelles & Gouvernance
            </h3>
            <p className="text-muted-foreground text-xs">
              Ménage prioritaire & interventions immédiates
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pendingCount > 0 ? (
            <Badge variant="warning" className="text-xs">
              {pendingCount} en attente
            </Badge>
          ) : (
            <Badge variant="success" className="text-xs">
              Toutes réalisées
            </Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onNavigate("housekeeping")}
            className="text-xs p-1 h-auto"
          >
            Planning →
          </Button>
        </div>
      </div>

      {/* FILTERS & STATS */}
      <div className="flex items-center justify-between gap-2 bg-muted/40 p-2 rounded-md border text-xs">
        <div className="flex items-center gap-1">
          <Filter className="size-3 text-muted-foreground" />
          <span className="text-muted-foreground font-medium mr-1">
            Filtre:
          </span>
          <Button
            type="button"
            variant={filter === "ALL" ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilter("ALL")}
            className="h-6 text-[11px] px-2"
          >
            Toutes ({tasks.length})
          </Button>
          <Button
            type="button"
            variant={filter === "HOUSEKEEPING" ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilter("HOUSEKEEPING")}
            className="h-6 text-[11px] px-2"
          >
            Ménage
          </Button>
          <Button
            type="button"
            variant={filter === "MAINTENANCE" ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilter("MAINTENANCE")}
            className="h-6 text-[11px] px-2"
          >
            Maintenance
          </Button>
        </div>

        <span className="text-[11px] text-muted-foreground hidden sm:inline">
          {chambresANettoyerCount} chambres marquées à nettoyer
        </span>
      </div>

      {/* TASKS LIST */}
      <div className="flex flex-col gap-2.5">
        {filteredTasks.length === 0 ? (
          <div className="p-6 text-center border border-dashed rounded-lg text-muted-foreground text-xs">
            Aucune tâche trouvée pour ce filtre.
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border transition-all text-xs ${
                task.terminee
                  ? "bg-muted/30 border-muted opacity-60 line-through"
                  : task.priorite === "URGENTE"
                    ? "bg-amber-500/5 border-amber-500/30"
                    : "bg-background"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => toggleTaskCompleted(task.id)}
                  className={`mt-0.5 shrink-0 rounded-full p-0.5 transition-colors ${
                    task.terminee
                      ? "text-emerald-600 bg-emerald-100 dark:bg-emerald-950"
                      : "text-muted-foreground hover:text-emerald-600"
                  }`}
                  title={
                    task.terminee ? "Marquer non terminée" : "Marquer terminée"
                  }
                >
                  <CheckCircle2 className="size-4" />
                </button>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="secondary"
                      className="font-bold text-[10px]"
                    >
                      Ch. {task.chambre}
                    </Badge>

                    <span className="font-bold text-foreground">
                      {task.titre}
                    </span>

                    {task.priorite === "URGENTE" && (
                      <Badge
                        variant="destructive"
                        className="text-[9px] py-0 px-1"
                      >
                        Urgent
                      </Badge>
                    )}
                    {task.priorite === "HAUTE" && (
                      <Badge variant="warning" className="text-[9px] py-0 px-1">
                        Priorité Haute
                      </Badge>
                    )}
                  </div>

                  <p className="text-muted-foreground text-[11px]">
                    {task.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-between sm:justify-end shrink-0 pl-6 sm:pl-0">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                  <Clock className="size-3" />
                  Avant {task.heureEcheance}
                </span>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onNavigate(
                      task.type === "MAINTENANCE"
                        ? "housekeeping"
                        : "housekeeping",
                    )
                  }
                  className="h-7 text-[11px] gap-1"
                >
                  <span>Gérer</span>
                  <ChevronRight className="size-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onNavigate("housekeeping")}
        className="w-full text-xs gap-1.5 mt-1"
      >
        <Sparkles className="size-3.5" />
        <span>Ouvrir la Console Gouvernance Complete</span>
      </Button>
    </div>
  );
}
