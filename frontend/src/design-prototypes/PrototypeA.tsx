import { useState } from 'react';
import {
  BedDouble,
  Building2,
  CircleDollarSign,
  ClipboardList,
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
import { Card } from '@/components/ui/card';
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

// DESIGN-005 — PROTOTYPE A : "Premium Hôtelier"
// Direction sobre/premium. Beaucoup d'air, hiérarchie par la typographie et
// l'espace plutôt que par la couleur, une seule teinte d'accent (--primary),
// densité faible. Aucune donnée réelle chargée — voir README.md du dossier.

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
    nom: 'Administrateur',
    label: 'Administration',
    icon: Building2,
    description: 'Paramètres, RH, finance',
  },
  {
    nom: 'Gouvernante',
    label: 'Housekeeping',
    icon: Sparkles,
    description: 'Ménage et contrôle des chambres',
  },
];

function PrototypeALogin({ onEnter }: { onEnter: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
      {/* Colonne image — DESIGN ONLY : placeholder neutre en attendant un
          visuel officiel de l'hôtel (voir mission §6, "image configurable"). */}
      <div
        className="relative hidden overflow-hidden lg:block"
        style={{
          background:
            'radial-gradient(120% 90% at 15% 10%, #23324a 0%, #101828 55%, #0b1220 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 64px)',
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-14 text-white">
          <div className="flex items-center gap-3">
            <span className="border-primary-soft/40 flex size-10 items-center justify-center rounded-full border text-lg font-semibold">
              M
            </span>
            <span className="text-sm font-medium tracking-[0.08em] uppercase opacity-80">
              Hôtel Makarim · Tétouan
            </span>
          </div>
          <div className="max-w-md">
            <p className="text-3xl leading-[1.25] font-semibold text-balance">
              « L'excellence se lit dans les détails, du hall à la dernière
              chambre. »
            </p>
            <p className="mt-4 text-sm text-white/60">
              Emplacement réservé au futur visuel officiel de l'établissement —
              photographie fournie séparément.
            </p>
          </div>
        </div>
      </div>

      {/* Colonne formulaire */}
      <div className="bg-background flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <span className="bg-primary text-primary-ink flex size-9 items-center justify-center rounded-full text-sm font-semibold">
              M
            </span>
            <span className="text-sm font-semibold">Hôtel Makarim</span>
          </div>

          <p className="text-muted-foreground text-xs font-semibold tracking-[0.08em] uppercase">
            Bienvenue
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">
            Choisissez votre espace
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            L'authentification reste identique quel que soit l'espace choisi —
            l'accès réel est déterminé par votre compte.
          </p>

          <div className="mt-7 grid grid-cols-2 gap-2.5">
            {ESPACES.map((espace) => {
              const Icon = espace.icon;
              const active = selected === espace.nom;
              return (
                <button
                  key={espace.nom}
                  type="button"
                  onClick={() => setSelected(espace.nom)}
                  className={`flex flex-col items-start gap-2.5 rounded-xl border p-4 text-left transition-colors duration-[var(--duration-fast)] ${
                    active
                      ? 'border-primary bg-primary-soft/60'
                      : 'border-border hover:border-primary/40 hover:bg-surface-2'
                  }`}
                >
                  <span
                    className={`flex size-8 items-center justify-center rounded-full ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-surface-2 text-muted-foreground'
                    }`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">
                      {espace.label ?? espace.nom}
                    </span>
                    <span className="text-muted-foreground block text-[11px] leading-tight">
                      {espace.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className={`grid transition-[grid-template-rows] duration-[var(--duration-base)] ease-[var(--ease-out-brand)] ${
              selected ? 'mt-7 grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="overflow-hidden">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onEnter();
                }}
                className="flex flex-col gap-4 border-t pt-6"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="a-email" className="text-[13px]">
                    Email
                  </Label>
                  <Input id="a-email" type="email" required className="h-10" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="a-pass" className="text-[13px]">
                    Mot de passe
                  </Label>
                  <Input
                    id="a-pass"
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

          {!selected && (
            <p className="text-muted-foreground mt-6 text-xs">
              Sélectionnez un espace ci-dessus pour afficher le formulaire de
              connexion.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatLine({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: typeof Gauge;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
      <span className="bg-surface-2 text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.04em] uppercase">
          {label}
        </p>
        <p className="mt-0.5 text-2xl leading-7 font-semibold tabular-nums">
          {value}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
      </div>
    </div>
  );
}

function PrototypeADashboard() {
  return (
    <div className="bg-background min-h-screen p-8 lg:p-12">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-10 flex items-end justify-between border-b pb-6">
          <div>
            <p className="text-muted-foreground text-xs font-semibold tracking-[0.06em] uppercase">
              Hôtel Makarim
            </p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight">
              Vue d'ensemble
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">mercredi 12 août 2026</p>
        </div>

        <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[1fr_1.4fr]">
          {/* Colonne gauche — chiffres clés en liste éditoriale, pas en
              grille de cartes colorées : la hiérarchie vient de la
              typographie. */}
          <div>
            <Card className="divide-border divide-y px-6">
              <StatLine
                label="Occupation"
                value={`${mockResume.tauxOccupation}%`}
                icon={Gauge}
                hint={`${mockResume.chambresOccupees} sur ${mockResume.totalChambres} chambres`}
              />
              <StatLine
                label="Arrivées aujourd'hui"
                value={String(mockResume.arriveesAujourdhui)}
                icon={LogIn}
                hint="Check-in prévus"
              />
              <StatLine
                label="Départs aujourd'hui"
                value={String(mockResume.departsAujourdhui)}
                icon={LogOut}
                hint="Check-out prévus"
              />
              <StatLine
                label="Encaissé aujourd'hui"
                value={`${Number(mockResume.encaisseAujourdhui).toLocaleString('fr-FR')} MAD`}
                icon={CircleDollarSign}
                hint="Paiements du jour"
              />
            </Card>

            <div className="mt-8">
              <h2 className="mb-3 text-sm font-semibold">
                Ménage &amp; maintenance
              </h2>
              <Card className="divide-border divide-y px-6">
                <StatLine
                  label="Chambres à nettoyer"
                  value={String(mockResume.chambresANettoyer)}
                  icon={Sparkles}
                  hint="En attente de traitement"
                />
                <StatLine
                  label="Interventions ouvertes"
                  value={String(mockTickets.length)}
                  icon={Wrench}
                  hint={`dont ${mockTickets.filter((t) => t.priorite === 'URGENTE').length} urgente(s)`}
                />
              </Card>
            </div>
          </div>

          {/* Colonne droite — activité du jour. */}
          <div className="flex flex-col gap-8">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  Occupation — 7 prochains jours
                </h2>
                <span className="text-muted-foreground text-[11px]">
                  Taux net
                </span>
              </div>
              <Card className="p-6">
                <div className="flex items-end justify-between gap-2">
                  {mockForecast.map((jour) => (
                    <div
                      key={jour.date}
                      className="flex flex-1 flex-col items-center gap-2"
                    >
                      <div className="bg-surface-2 relative h-24 w-full max-w-8 overflow-hidden rounded-md">
                        <div
                          className="bg-primary absolute bottom-0 w-full rounded-t-sm"
                          style={{ height: `${jour.tauxOccupation}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground text-[11px]">
                        {jour.label}
                      </span>
                      <span className="text-xs font-semibold tabular-nums">
                        {jour.tauxOccupation}%
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  <LogIn className="text-success size-3.5" /> Arrivées attendues
                  <Badge variant="outline" className="ml-1 text-[10px]">
                    aperçu
                  </Badge>
                </h2>
                <Card className="divide-border divide-y">
                  {mockArrivals.map((a) => (
                    <div
                      key={a.nom}
                      className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
                    >
                      <span className="truncate">{a.nom}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        Ch. {a.chambre} · {a.heure}
                      </span>
                    </div>
                  ))}
                </Card>
              </div>
              <div>
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  <LogOut className="text-warning size-3.5" /> Départs attendus
                  <Badge variant="outline" className="ml-1 text-[10px]">
                    aperçu
                  </Badge>
                </h2>
                <Card className="divide-border divide-y">
                  {mockDepartures.map((d) => (
                    <div
                      key={d.nom}
                      className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
                    >
                      <span className="truncate">{d.nom}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        Ch. {d.chambre} · {d.heure}
                      </span>
                    </div>
                  ))}
                </Card>
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-semibold">Chambres à traiter</h2>
              <Card className="flex flex-wrap gap-2 p-4">
                {mockRooms.map((room) => (
                  <Badge
                    key={room.id}
                    variant={
                      room.statut === 'EN_MAINTENANCE'
                        ? 'destructive'
                        : 'warning'
                    }
                  >
                    <BedDouble className="size-3" /> {room.numero}
                  </Badge>
                ))}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrototypeA() {
  const [view, setView] = useState<'login' | 'dashboard'>('login');
  return (
    <>
      {view === 'login' ? (
        <PrototypeALogin onEnter={() => setView('dashboard')} />
      ) : (
        <PrototypeADashboard />
      )}
      <DemoToggle view={view} onChange={setView} />
    </>
  );
}

// Barre de démo — n'existe que dans le prototype, pour naviguer entre les
// deux écrans sans routeur. Absente de toute vraie page.
function DemoToggle({
  view,
  onChange,
}: {
  view: 'login' | 'dashboard';
  onChange: (v: 'login' | 'dashboard') => void;
}) {
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-black/80 p-1 text-white shadow-lg backdrop-blur">
      <ClipboardList className="ml-2 size-3.5 opacity-60" />
      <span className="mr-1 text-[11px] opacity-70">Prototype A — démo</span>
      <button
        type="button"
        onClick={() => onChange('login')}
        className={`rounded-full px-3 py-1 text-xs ${view === 'login' ? 'bg-white text-black' : 'opacity-70'}`}
      >
        Login
      </button>
      <button
        type="button"
        onClick={() => onChange('dashboard')}
        className={`rounded-full px-3 py-1 text-xs ${view === 'dashboard' ? 'bg-white text-black' : 'opacity-70'}`}
      >
        Dashboard
      </button>
    </div>
  );
}
