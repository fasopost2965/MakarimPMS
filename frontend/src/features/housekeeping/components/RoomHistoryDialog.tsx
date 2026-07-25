import { useEffect, useState } from "react";
import {
  History,
  Clock,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRoomStatusHistory } from "../api";
import type { RoomStatusLogEntry } from "../types";
import type { StatutChambre } from "../../reservations/types";

const STATUT_LABEL: Record<StatutChambre, string> = {
  LIBRE_PROPRE: "Libre & propre",
  RESERVEE: "Réservée",
  OCCUPEE: "Occupée",
  DEPART_PREVU: "Départ prévu",
  A_NETTOYER: "À nettoyer",
  EN_NETTOYAGE: "En nettoyage",
  EN_MAINTENANCE: "En maintenance",
};

const STATUT_BADGE_VARIANT: Record<
  StatutChambre,
  "success" | "info" | "destructive" | "warning" | "secondary"
> = {
  LIBRE_PROPRE: "success",
  RESERVEE: "info",
  OCCUPEE: "destructive",
  DEPART_PREVU: "info",
  A_NETTOYER: "warning",
  EN_NETTOYAGE: "warning",
  EN_MAINTENANCE: "destructive",
};

interface Props {
  roomId: number | null;
  roomNumero: string | null;
  onClose: () => void;
}

export function RoomHistoryDialog({ roomId, roomNumero, onClose }: Props) {
  const [entries, setEntries] = useState<RoomStatusLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (roomId === null) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    getRoomStatusHistory(roomId)
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erreur de chargement");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  return (
    <Dialog open={roomId !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-xl max-w-[calc(100%-1rem)] max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <History className="size-5 text-emerald-600" />
              <span>Historique des Statuts — Chambre #{roomNumero}</span>
            </DialogTitle>
            <Badge variant="outline" className="text-xs font-mono">
              Chambre #{roomNumero}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Journal de traçabilité des états de ménage et de gouvernance
          </p>
        </DialogHeader>

        {loading && (
          <div className="py-12 text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="size-6 animate-spin text-primary" />
            <span>Chargement du journal d'évènements…</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-xs font-medium my-2">
            {error}
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="py-12 border rounded-xl bg-card text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
            <Clock className="size-8 text-muted-foreground" />
            <p className="font-semibold text-foreground">
              Aucun changement de statut enregistré
            </p>
            <p className="text-[11px]">
              La chambre n'a encore enregistré aucune transition d'état.
            </p>
          </div>
        )}

        {entries.length > 0 && (
          <div className="flex flex-col gap-3 my-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between px-1">
              <span>Transitions d'état</span>
              <span>{entries.length} enregistrements</span>
            </div>

            <div className="relative pl-6 border-l-2 border-border/80 space-y-4 my-1">
              {entries.map((entry) => (
                <div key={entry.id} className="relative group">
                  {/* TIMELINE BULLET */}
                  <span className="absolute -left-[31px] top-1 size-3 rounded-full bg-primary border-2 border-background ring-2 ring-primary/20" />

                  <div className="p-3 rounded-xl border bg-card flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant={STATUT_BADGE_VARIANT[entry.ancienStatut]}
                          className="text-[10px]"
                        >
                          {STATUT_LABEL[entry.ancienStatut]}
                        </Badge>
                        <ArrowRight className="size-3 text-muted-foreground" />
                        <Badge
                          variant={STATUT_BADGE_VARIANT[entry.nouveauStatut]}
                          className="text-[10px] font-bold"
                        >
                          {STATUT_LABEL[entry.nouveauStatut]}
                        </Badge>
                      </div>

                      <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(entry.createdAt).toLocaleString("fr-FR")}
                      </span>
                    </div>

                    {entry.motif && (
                      <p className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-lg font-medium">
                        Motif / Note : {entry.motif}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-3 border-t flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
