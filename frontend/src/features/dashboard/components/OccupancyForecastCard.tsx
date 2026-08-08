import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { getYieldForecast } from '@/features/reporting/api';
import type { YieldForecast } from '@/features/reporting/types';
import { agregerParJour, type JourAgrege } from '../utils/occupancy-forecast';

const JOURS = 7;

// F3 — GET /reporting/yield-forecast (module reporting, strictement
// read-only, INV-REP-001). Ce composant n'affiche QUE ce que l'endpoint
// renvoie réellement : `previsions[].tauxOccupation`, `chambresOccupees`,
// `totalChambres`, agrégés ici sur l'ensemble des types de chambre pour une
// vue « hôtel ».
//
// AVERTISSEMENT DE LECTURE (docs/modules/reporting.md §12, rappelé par la
// mission DESIGN-002) : ce taux est le **Taux d'Occupation Net**, dont le
// dénominateur EXCLUT les chambres EN_MAINTENANCE. Il n'a donc pas la même
// définition que le « Taux d'occupation » du jour affiché en KPI
// (GET /dashboard/resume), calculé sur la TOTALITÉ des chambres. Les deux
// coexistent volontairement à l'écran avec des libellés distincts — ne
// jamais les présenter comme le même indicateur.
//
// Aucune recommandation tarifaire (`recommandation`/`prixSuggere`) n'est
// reprise ici : elle relève de l'écran Reporting/Revenue Manager, pas d'une
// vue opérationnelle quotidienne.
function isoDay(offset: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function barTone(taux: number) {
  // Mêmes seuils que classifyOccupancy côté backend (≥80 % / <40 %) —
  // repris ici uniquement pour la teinte, jamais pour produire une
  // recommandation tarifaire côté client.
  if (taux >= 80) return 'var(--success)';
  if (taux < 40) return 'var(--warning)';
  return 'var(--primary)';
}

export function OccupancyForecastCard() {
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
    // Même patron que DashboardPage : la requête est différée d'un tick
    // pour ne pas déclencher un setState synchrone dans le corps de
    // l'effet (règle react-hooks/set-state-in-effect du projet).
    void Promise.resolve().then(() => refetch());
  }, [refetch]);

  const jours = useMemo(
    () => (forecast ? agregerParJour(forecast) : []),
    [forecast],
  );

  const periodeLisible = `${new Date(`${dateDebut}T12:00:00`).toLocaleDateString('fr-FR')} → ${new Date(`${dateFin}T12:00:00`).toLocaleDateString('fr-FR')}`;

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-0.5">
        <CardTitle>Prévision d'occupation — 7 jours</CardTitle>
        <p className="text-muted-foreground text-xs">
          Taux d'occupation net (hors chambres en maintenance) ·{' '}
          {periodeLisible}
        </p>
      </CardHeader>
      <CardContent className="gap-3 pt-2">
        {loading && <Skeleton className="h-[180px] w-full" />}

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
          <>
            {/* §8 — un graphique n'est jamais la seule source de
                l'information : la même donnée est disponible en texte,
                lisible par un lecteur d'écran. */}
            <div className="h-[180px] w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={jours}
                  margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border)' }}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 50, 100]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    unit="%"
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--surface-2)' }}
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      boxShadow: 'var(--shadow-card)',
                      color: 'var(--text)',
                      fontSize: 12,
                    }}
                    labelStyle={{ color: 'var(--text)', fontWeight: 700 }}
                    formatter={(value, _name, item) => [
                      `${value as number}% (${(item.payload as JourAgrege).chambresOccupees}/${(item.payload as JourAgrege).totalChambres} chambres)`,
                      'Occupation nette',
                    ]}
                  />
                  <Bar dataKey="tauxOccupation" radius={[4, 4, 0, 0]}>
                    {jours.map((jour) => (
                      <Cell
                        key={jour.date}
                        fill={barTone(jour.tauxOccupation)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Équivalent textuel du graphique — une colonne par jour, dans
                le même ordre que les barres, pour que la donnée reste
                lisible sans le SVG (lecteur d'écran, impression). */}
            <ul className="grid grid-cols-4 gap-1 text-xs sm:grid-cols-7">
              {jours.map((jour) => (
                <li
                  key={jour.date}
                  className="bg-surface-2 flex flex-col items-center rounded-md px-1 py-1"
                >
                  <span className="text-muted-foreground truncate">
                    {jour.label}
                  </span>
                  <span className="text-foreground font-mono font-semibold tabular-nums">
                    {jour.tauxOccupation}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
