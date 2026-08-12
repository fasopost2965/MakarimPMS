import { useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import {
  AlertTriangle,
  BedDouble,
  Building2,
  CircleDollarSign,
  Gauge,
  LogIn,
  LogOut,
  Radio,
  Sparkles,
  UtensilsCrossed,
  Users,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  mockArrivals,
  mockDepartures,
  mockForecast,
  mockResume,
  mockRooms,
  mockTickets,
} from './mock-data';

// DESIGN-005 — PROTOTYPE B : "Operations Command Center"
// Direction vivante, orientée exploitation temps réel. Densité plus élevée,
// couleurs sémantiques plus affirmées, indicateur "live", grille d'état des
// chambres façon plan d'étage simplifié. Toujours aucune animation
// décorative gratuite — le mouvement sert exclusivement à signaler un état
// (pastille "live", barre de progression). Aucune donnée réelle chargée —
// voir README.md du dossier.

const ESPACES = [
  { nom: 'Réception', icon: Users },
  { nom: 'RESTAURATEUR', label: 'Restaurant', icon: UtensilsCrossed },
  { nom: 'Administrateur', label: 'Administration', icon: Building2 },
  { nom: 'Gouvernante', label: 'Housekeeping', icon: Sparkles },
];

function PrototypeBLogin({ onEnter }: { onEnter: () => void }) {
  const [selected, setSelected] = useState<string>('Réception');

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-6"
      style={{
        background:
          'radial-gradient(140% 100% at 50% -10%, #1a2a4a 0%, #0b1220 60%)',
      }}
    >
      {/* Texture "opérations" — DESIGN ONLY, placeholder neutre en attendant
          un visuel officiel (mission §6). */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative w-full max-w-[440px]">
        <div className="mb-6 flex items-center justify-center gap-2 text-white">
          <span className="bg-primary flex size-9 items-center justify-center rounded-lg text-sm font-bold">
            M
          </span>
          <span className="text-sm font-semibold tracking-[0.04em]">
            MAKARIM <span className="text-white/50">· PMS</span>
          </span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl backdrop-blur-xl">
          <div className="mb-1 flex items-center gap-1.5 text-white/60">
            <span className="relative flex size-1.5">
              <span className="bg-success absolute inline-flex size-full animate-ping rounded-full opacity-60" />
              <span className="bg-success relative inline-flex size-1.5 rounded-full" />
            </span>
            <span className="text-[10px] font-semibold tracking-[0.08em] uppercase">
              Système opérationnel
            </span>
          </div>
          <h1 className="text-xl font-semibold text-white">
            Sélectionnez votre poste
          </h1>

          <div className="mt-5 grid grid-cols-4 gap-2">
            {ESPACES.map((espace) => {
              const Icon = espace.icon;
              const active = selected === espace.nom;
              return (
                <button
                  key={espace.nom}
                  type="button"
                  onClick={() => setSelected(espace.nom)}
                  title={espace.label ?? espace.nom}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors ${
                    active
                      ? 'border-primary bg-primary/20 text-white'
                      : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white/80'
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="truncate text-[10px] leading-tight font-medium">
                    {(espace.label ?? espace.nom).split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onEnter();
            }}
            className="mt-6 flex flex-col gap-3.5"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-email" className="text-[12px] text-white/70">
                Email — {selected}
              </Label>
              <Input
                id="b-email"
                type="email"
                required
                className="h-10 border-white/15 bg-white/[0.06] text-white placeholder:text-white/30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-pass" className="text-[12px] text-white/70">
                Mot de passe
              </Label>
              <Input
                id="b-pass"
                type="password"
                required
                className="h-10 border-white/15 bg-white/[0.06] text-white placeholder:text-white/30"
              />
            </div>
            <Button type="submit" className="mt-1 h-11">
              Ouvrir la session
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative flex size-1.5">
      <span className="bg-success absolute inline-flex size-full animate-ping rounded-full opacity-60" />
      <span className="bg-success relative inline-flex size-1.5 rounded-full" />
    </span>
  );
}

const ROOM_DOT: Record<string, string> = {
  LIBRE_PROPRE: 'bg-success',
  OCCUPEE: 'bg-primary',
  A_NETTOYER: 'bg-warning',
  EN_NETTOYAGE: 'bg-violet',
  EN_MAINTENANCE: 'bg-destructive',
};

function PrototypeBDashboard() {
  const urgentTickets = mockTickets.filter((t) => t.priorite === 'URGENTE');

  return (
    <div className="bg-background min-h-screen">
      <div className="border-border bg-card sticky top-0 z-10 flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg text-xs font-bold">
            M
          </span>
          <div>
            <p className="text-sm font-bold">Centre opérationnel</p>
            <p className="text-muted-foreground text-[11px]">
              Hôtel Makarim · Tétouan
            </p>
          </div>
        </div>
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <LiveDot />
          Mis à jour à l'instant
        </div>
      </div>

      <div className="p-6">
        {urgentTickets.length > 0 && (
          <div className="border-destructive/30 bg-destructive-soft mb-5 flex items-center gap-2.5 rounded-lg border px-4 py-2.5">
            <AlertTriangle className="text-destructive size-4 shrink-0" />
            <p className="text-destructive text-sm font-semibold">
              {urgentTickets.length} intervention
              {urgentTickets.length > 1 ? 's' : ''} urgente
              {urgentTickets.length > 1 ? 's' : ''} en cours — Ch.{' '}
              {urgentTickets.map((t) => t.roomNumero).join(', ')}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricTile
            label="Occupation"
            value={`${mockResume.tauxOccupation}%`}
            icon={Gauge}
            tone="primary"
            spark
          />
          <MetricTile
            label="Occupées"
            value={`${mockResume.chambresOccupees}/${mockResume.totalChambres}`}
            icon={BedDouble}
            tone="primary"
          />
          <MetricTile
            label="Arrivées"
            value={String(mockResume.arriveesAujourdhui)}
            icon={LogIn}
            tone="success"
          />
          <MetricTile
            label="Départs"
            value={String(mockResume.departsAujourdhui)}
            icon={LogOut}
            tone="warning"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Plan d'étage simplifié — grille de statut. */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>État des chambres — vue rapide</CardTitle>
              <span className="text-muted-foreground text-[11px]">
                {mockResume.totalChambres} chambres
              </span>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                {Array.from({ length: mockResume.totalChambres }, (_, i) => {
                  const mocked = mockRooms.find((r) => r.id === i + 1);
                  const statut =
                    mocked?.statut ??
                    (i % 5 === 0 ? 'LIBRE_PROPRE' : 'OCCUPEE');
                  return (
                    <div
                      key={i}
                      title={statut}
                      className="bg-surface-2 flex aspect-square items-center justify-center rounded-md"
                    >
                      <span
                        className={`size-2.5 rounded-full ${ROOM_DOT[statut]}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-[11px]">
                {Object.entries({
                  'Libre/propre': ROOM_DOT.LIBRE_PROPRE,
                  Occupée: ROOM_DOT.OCCUPEE,
                  'À nettoyer': ROOM_DOT.A_NETTOYER,
                  'En nettoyage': ROOM_DOT.EN_NETTOYAGE,
                  Maintenance: ROOM_DOT.EN_MAINTENANCE,
                }).map(([label, dot]) => (
                  <span
                    key={label}
                    className="text-muted-foreground flex items-center gap-1.5"
                  >
                    <span className={`size-2 rounded-full ${dot}`} /> {label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Encaissements du jour</CardTitle>
            </CardHeader>
            <CardContent className="gap-1 pt-2">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="text-success size-5" />
                <span className="font-mono text-2xl font-extrabold tabular-nums">
                  {Number(mockResume.encaisseAujourdhui).toLocaleString(
                    'fr-FR',
                  )}
                </span>
                <span className="text-muted-foreground text-sm">MAD</span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                Paiements enregistrés aujourd'hui
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Charge d'occupation — 7 jours</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[140px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={mockForecast}
                    margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="fillB" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="var(--chart-1)"
                          stopOpacity={0.35}
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
                      fill="url(#fillB)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <Wrench className="size-3.5" /> Maintenance
              </CardTitle>
            </CardHeader>
            <CardContent className="gap-2 pt-2">
              {mockTickets.map((t) => (
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
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-success flex items-center gap-1.5">
                <LogIn className="size-3.5" /> Arrivées
                <Badge variant="outline" className="text-[10px]">
                  aperçu
                </Badge>
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
                <Badge variant="outline" className="text-[10px]">
                  aperçu
                </Badge>
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
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  icon: Icon,
  tone,
  spark,
}: {
  label: string;
  value: string;
  icon: typeof Gauge;
  tone: 'primary' | 'success' | 'warning';
  spark?: boolean;
}) {
  const toneClass = {
    primary: 'text-primary bg-primary-soft',
    success: 'text-success bg-success-soft',
    warning: 'text-warning bg-warning-soft',
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span
          className={`flex size-8 items-center justify-center rounded-lg ${toneClass}`}
        >
          <Icon className="size-4" />
        </span>
        {spark && (
          <Radio className="text-muted-foreground size-3 animate-pulse" />
        )}
      </div>
      <p className="mt-3 text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
    </Card>
  );
}

export function PrototypeB() {
  const [view, setView] = useState<'login' | 'dashboard'>('login');
  return (
    <>
      {view === 'login' ? (
        <PrototypeBLogin onEnter={() => setView('dashboard')} />
      ) : (
        <PrototypeBDashboard />
      )}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-black/80 p-1 text-white shadow-lg backdrop-blur">
        <span className="mr-1 text-[11px] opacity-70">Prototype B — démo</span>
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
