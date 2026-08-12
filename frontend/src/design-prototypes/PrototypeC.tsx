import { useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import {
  AlertTriangle,
  Banknote,
  BedDouble,
  Building2,
  Gauge,
  LogIn,
  LogOut,
  Sparkles,
  UtensilsCrossed,
  Users,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { Label } from '@/components/ui/label';
import { MoneyDisplay } from '@/components/ui/money-display';
import { SectionHeader } from '@/components/ui/section-header';
import {
  mockArrivals,
  mockDepartures,
  mockForecast,
  mockResume,
  mockRooms,
  mockTickets,
} from './mock-data';

// DESIGN-005 — PROTOTYPE C : "Living Operations" (recommandation)
// Hybride assumé entre A et B : hiérarchie éditoriale de A (peu de couleur,
// beaucoup d'espace) + lisibilité opérationnelle de B (statuts groupés par
// urgence, pas par catégorie technique). Réutilise VOLONTAIREMENT les
// composants déjà en production (KpiCard, SectionHeader, MoneyDisplay,
// Card) plutôt que d'en réinventer — la démonstration porte autant sur la
// mise en page que sur la faisabilité d'intégration réelle. Aucune donnée
// réelle chargée — voir README.md du dossier.

const ESPACES = [
  {
    nom: 'Réception',
    icon: Users,
    description: 'Arrivées, départs, réservations',
  },
  {
    nom: 'RESTAURATEUR',
    label: 'Restaurant',
    icon: UtensilsCrossed,
    description: 'Salle et service',
  },
  {
    nom: 'Gouvernante',
    label: 'Housekeeping',
    icon: Sparkles,
    description: 'Ménage et contrôle',
  },
  {
    nom: 'Administrateur',
    label: 'Administration',
    icon: Building2,
    description: 'Paramètres, RH, finance',
  },
];

function PrototypeCLogin({ onEnter }: { onEnter: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="bg-background relative flex min-h-screen flex-col items-center overflow-hidden p-6">
      {/* Bandeau visuel — DESIGN ONLY, placeholder neutre (mission §6 :
          image officielle fournie séparément, remplaçable sans changer la
          structure). Contrairement à A (pleine colonne) et B (fond plein),
          C garde une bande haute discrète pour ne pas sacrifier de largeur
          au formulaire — meilleur compromis desktop 1280-1440px, résolution
          la plus courante en réception d'hôtel. Le bandeau et l'en-tête
          restent ancrés en haut de page (pas de centrage vertical global) :
          le texte blanc doit toujours rester dans la zone pleinement
          opaque du dégradé, quelle que soit la hauteur du formulaire
          en dessous. */}
      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{ background: '#101828' }}
      />
      <div
        className="absolute inset-x-0 top-40 h-16"
        style={{
          background: 'linear-gradient(180deg, #101828 0%, transparent 100%)',
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-40 opacity-[0.08]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(100deg, #fff 0 1px, transparent 1px 56px)',
        }}
      />

      <div className="relative mt-10 mb-8 flex flex-col items-center text-center text-white">
        <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-white/10 text-lg font-semibold backdrop-blur">
          M
        </span>
        <p className="text-sm font-semibold tracking-[0.03em]">Hôtel Makarim</p>
        <p className="text-[11px] text-white/50">PMS · Tétouan</p>
      </div>

      <div className="relative flex w-full flex-1 items-center justify-center">
        <div className="w-full max-w-[460px]">
          <Card className="p-6">
            <p className="text-muted-foreground text-xs font-semibold tracking-[0.04em] uppercase">
              Entrer dans
            </p>
            <h1 className="mt-0.5 text-lg font-bold">
              Votre espace de travail
            </h1>

            <div className="mt-4 flex flex-col gap-2">
              {ESPACES.map((espace) => {
                const Icon = espace.icon;
                const active = selected === espace.nom;
                return (
                  <button
                    key={espace.nom}
                    type="button"
                    onClick={() => setSelected(espace.nom)}
                    className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors duration-[var(--duration-fast)] ${
                      active
                        ? 'border-primary bg-primary-soft'
                        : 'border-border hover:bg-surface-2'
                    }`}
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-md ${
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-surface-2 text-muted-foreground'
                      }`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {espace.label ?? espace.nom}
                      </span>
                      <span className="text-muted-foreground block truncate text-[11px]">
                        {espace.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              className={`grid transition-[grid-template-rows] duration-[var(--duration-base)] ease-[var(--ease-out-brand)] ${
                selected ? 'mt-5 grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onEnter();
                  }}
                  className="flex flex-col gap-3.5 border-t pt-5"
                >
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="c-email" className="text-[13px]">
                      Email
                    </Label>
                    <Input
                      id="c-email"
                      type="email"
                      required
                      className="h-10"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="c-pass" className="text-[13px]">
                      Mot de passe
                    </Label>
                    <Input
                      id="c-pass"
                      type="password"
                      required
                      className="h-10"
                    />
                  </div>
                  <Button type="submit" className="mt-1 h-11">
                    Se connecter
                  </Button>
                </form>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PrototypeCDashboard() {
  const urgentTickets = mockTickets.filter((t) => t.priorite === 'URGENTE');
  const otherTickets = mockTickets.filter((t) => t.priorite !== 'URGENTE');
  const roomsToClean = mockRooms.filter(
    (r) => r.statut === 'A_NETTOYER' || r.statut === 'EN_NETTOYAGE',
  );
  const roomsBlocked = mockRooms.filter((r) => r.statut === 'EN_MAINTENANCE');

  return (
    <div className="flex min-h-screen flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-[11px] font-bold tracking-[0.03em] uppercase">
            Vue opérationnelle
          </p>
          <h1 className="text-xl font-extrabold tracking-[-0.01em]">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-0.5 text-xs">
            mercredi 12 août 2026
          </p>
        </div>
        {/* Alerte groupée — un seul signal fort plutôt qu'un badge rouge par
            carte (§7 de la mission : hiérarchie, pas surcharge). */}
        {urgentTickets.length > 0 && (
          <div className="border-destructive/30 bg-destructive-soft flex items-center gap-2 rounded-lg border px-3.5 py-2">
            <AlertTriangle className="text-destructive size-4 shrink-0" />
            <p className="text-destructive text-xs font-semibold">
              {urgentTickets.length} incident urgent nécessite votre attention
            </p>
          </div>
        )}
      </div>

      {/* Zone "Maintenant" — chiffres réels du jour, composant KpiCard
          existant réutilisé tel quel (aucune réinvention). */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Taux d'occupation"
          value={`${mockResume.tauxOccupation}%`}
          hint={`Sur ${mockResume.totalChambres} chambres`}
          icon={Gauge}
          tone="primary"
          progress={mockResume.tauxOccupation}
        />
        <KpiCard
          label="Chambres occupées"
          value={`${mockResume.chambresOccupees} / ${mockResume.totalChambres}`}
          hint="Actuellement occupées"
          icon={BedDouble}
        />
        <KpiCard
          label="Arrivées aujourd'hui"
          value={String(mockResume.arriveesAujourdhui)}
          hint="Check-in prévus"
          icon={LogIn}
          tone="success"
        />
        <KpiCard
          label="Départs aujourd'hui"
          value={String(mockResume.departsAujourdhui)}
          hint="Check-out prévus"
          icon={LogOut}
          tone="warning"
        />
        <KpiCard
          label="Chambres à nettoyer"
          value={String(mockResume.chambresANettoyer)}
          hint="En attente"
          icon={Sparkles}
          tone={mockResume.chambresANettoyer > 0 ? 'warning' : 'neutral'}
        />
        <KpiCard
          label="Encaissé aujourd'hui"
          value={
            <MoneyDisplay
              value={mockResume.encaisseAujourdhui}
              className="text-[19px] whitespace-nowrap"
            />
          }
          hint="Paiements du jour"
          icon={Banknote}
        />
      </div>

      {/* Zone "Attention" — regroupe TOUT ce qui nécessite une action,
          indépendamment du module d'origine (housekeeping, maintenance).
          C'est la différence structurelle avec le Dashboard actuel : au
          lieu de deux widgets séparés (RoomsToCleanWidget,
          OpenMaintenanceWidget) juxtaposés sans hiérarchie commune, une
          seule section trie par urgence réelle. */}
      <section aria-labelledby="c-attention">
        <SectionHeader
          id="c-attention"
          title="À traiter"
          description="Chambres et interventions nécessitant une action, triées par urgence."
        />
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Ménage</p>
              <Badge variant={roomsToClean.length > 0 ? 'warning' : 'outline'}>
                {roomsToClean.length}
              </Badge>
            </div>
            {roomsToClean.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                Toutes les chambres sont traitées.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {roomsToClean.map((r) => (
                  <Badge key={r.id} variant="warning">
                    {r.numero}
                  </Badge>
                ))}
              </div>
            )}
            {roomsBlocked.length > 0 && (
              <div className="mt-3 border-t pt-3">
                <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold">
                  Bloquées (maintenance)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {roomsBlocked.map((r) => (
                    <Badge key={r.id} variant="destructive">
                      {r.numero}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Wrench className="size-3.5" /> Interventions ouvertes
              </p>
              <Badge
                variant={urgentTickets.length > 0 ? 'destructive' : 'outline'}
              >
                {mockTickets.length}
              </Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              {[...urgentTickets, ...otherTickets].map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="truncate">
                    Ch. {t.roomNumero} — {t.typePanne}
                  </span>
                  <Badge
                    variant={
                      t.priorite === 'URGENTE'
                        ? 'destructive'
                        : t.priorite === 'HAUTE'
                          ? 'warning'
                          : 'outline'
                    }
                  >
                    {t.priorite}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* Zone "Aujourd'hui" — activité nommée, avec avertissement explicite
          de non-branchement (NEEDS BACKEND, voir rapport). */}
      <section aria-labelledby="c-jour">
        <SectionHeader
          id="c-jour"
          title="Aujourd'hui"
          description="Arrivées et départs attendus."
          action={
            <Badge variant="outline" className="text-[10px]">
              aperçu — non branché
            </Badge>
          }
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-success flex items-center gap-1.5">
                <LogIn className="size-3.5" /> Arrivées
              </CardTitle>
            </CardHeader>
            <CardContent className="gap-1.5 pt-2">
              {mockArrivals.map((a) => (
                <div
                  key={a.nom}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="truncate">{a.nom}</span>
                  <span className="text-muted-foreground shrink-0">
                    Ch. {a.chambre} · {a.heure}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-warning flex items-center gap-1.5">
                <LogOut className="size-3.5" /> Départs
              </CardTitle>
            </CardHeader>
            <CardContent className="gap-1.5 pt-2">
              {mockDepartures.map((d) => (
                <div
                  key={d.nom}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="truncate">{d.nom}</span>
                  <span className="text-muted-foreground shrink-0">
                    Ch. {d.chambre} · {d.heure}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="c-forecast">
        <SectionHeader
          id="c-forecast"
          title="Prévision d'occupation — 7 jours"
          description="Taux net, hors chambres en maintenance."
        />
        <Card className="mt-3">
          <CardContent className="pt-4">
            <div className="h-[160px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={mockForecast}
                  margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fillC" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tauxOccupation"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#fillC)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export function PrototypeC() {
  const [view, setView] = useState<'login' | 'dashboard'>('login');
  return (
    <>
      {view === 'login' ? (
        <PrototypeCLogin onEnter={() => setView('dashboard')} />
      ) : (
        <PrototypeCDashboard />
      )}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-black/80 p-1 text-white shadow-lg backdrop-blur">
        <span className="mr-1 text-[11px] opacity-70">Prototype C — démo</span>
        <button
          type="button"
          onClick={() => setView('login')}
          className={`rounded-full px-3 py-1 text-xs ${view === 'login' ? 'bg-white text-black' : 'opacity-70'}`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => setView('dashboard')}
          className={`rounded-full px-3 py-1 text-xs ${view === 'dashboard' ? 'bg-white text-black' : 'opacity-70'}`}
        >
          Dashboard
        </button>
      </div>
    </>
  );
}
