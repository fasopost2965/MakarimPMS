import { useCallback, useEffect, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { getYieldForecast } from '@/features/reporting/api';
import type { YieldForecast } from '@/features/reporting/types';
import { agregerParJour } from '../utils/occupancy-forecast';

const JOURS = 7;

// DESIGN-005 (intégration Prototype D3 validée) — présentation horizontale
// compacte des 7 prochains jours (mission §9 : "pas de nouveau calcul
// financier ou yield côté frontend, hors simple présentation/tendance
// derived"). REAL : GET /reporting/yield-forecast (F3, strictement
// read-only, INV-REP-001) — même agrégation `agregerParJour` déjà testée
// indépendamment et utilisée par OccupancyForecastCard (composant existant
// non modifié, non supprimé, simplement plus monté sur ce Dashboard — son
// rendu en aire reste disponible ailleurs si besoin). DERIVED : la
// tendance (comparaison du premier et du dernier jour de la série REAL) et
// la mise en évidence "Forte" (≥ 90%, seuil purement visuel, aucune
// nouvelle règle de yield management — le seuil métier HAUSSE/BAISSE reste
// exclusivement dans reporting/utils/yield-recommendation.util.ts côté
// backend).
function isoDay(offset: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function OperationalForecastStrip() {
  const [forecast, setForecast] = useState<YieldForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateDebut = isoDay(0);
  const dateFin = isoDay(JOURS - 1);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setForecast(await getYieldForecast(dateDebut, dateFin));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [dateDebut, dateFin]);

  useEffect(() => {
    void Promise.resolve().then(() => refetch());
  }, [refetch]);

  const jours = forecast ? agregerParJour(forecast) : [];
  const first = jours[0]?.tauxOccupation;
  const last = jours[jours.length - 1]?.tauxOccupation;
  const trendUp = first !== undefined && last !== undefined && last >= first;
  const delta = first !== undefined && last !== undefined ? last - first : null;

  return (
    <section aria-labelledby="dashboard-forecast">
      <SectionHeader
        id="dashboard-forecast"
        title="Occupation — 7 prochains jours"
        description="Taux net, hors chambres en maintenance."
        action={
          delta !== null && (
            <span
              className={`flex items-center gap-1 text-xs font-semibold ${trendUp ? 'text-success' : 'text-warning'}`}
            >
              {trendUp ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {trendUp ? '+' : ''}
              {delta} pt sur la période
            </span>
          )
        }
      />
      <Card className="mt-3">
        <CardContent className="pt-4">
          {loading && (
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={i} className="h-[86px] w-full" />
              ))}
            </div>
          )}

          {error && !loading && (
            <ErrorState
              title="Impossible de charger la prévision d'occupation"
              description={error}
              onRetry={() => void refetch()}
            />
          )}

          {!loading && !error && jours.length === 0 && (
            <EmptyState
              title="Aucune prévision disponible"
              description="Aucun type de chambre exploitable sur les 7 prochains jours."
            />
          )}

          {!loading && !error && jours.length > 0 && (
            <div className="grid grid-cols-7 gap-2">
              {jours.map((jour) => {
                const forte = jour.tauxOccupation >= 90;
                return (
                  <div
                    key={jour.date}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 ${
                      forte
                        ? 'border-warning/30 bg-warning-soft'
                        : 'border-border bg-surface-2'
                    }`}
                  >
                    <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                      {jour.label}
                    </span>
                    <span
                      className={`text-base font-extrabold tabular-nums ${forte ? 'text-warning' : ''}`}
                    >
                      {jour.tauxOccupation}%
                    </span>
                    <div className="bg-border h-[3px] w-full overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full ${forte ? 'bg-warning' : 'bg-primary'}`}
                        style={{ width: `${jour.tauxOccupation}%` }}
                      />
                    </div>
                    {forte && (
                      <span className="text-warning text-[9px] font-bold uppercase">
                        Forte
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
