// Coquille de l'application : barre latérale, barre supérieure (avec sélecteur
// de profil), navigation mobile et barre inférieure.
//
// `ecransAutorises()` et `navFiltree()` implémentent le miroir client de la
// matrice RBAC (BR-TR-004) : un profil ne voit que les entrées auxquelles il a
// droit, et l'interface ne remplace jamais le contrôle serveur.

import { useState } from 'react';
import {
  BedDouble,
  Bell,
  CalendarRange,
  ChevronDown,
  CircleDollarSign,
  LayoutDashboard,
  Moon,
  RotateCcw,
  Search,
  Settings2,
  UtensilsCrossed,
  Users,
} from 'lucide-react';
import { HOTEL, PROFILS } from '../data';
import { kpiDuJour, useApp } from '../store';
import { fmtLong } from '../lib/date';
import { Button, Card, Kbd, Pill, Ring, cx } from './ui';

export const NAV = [
  {
    groupe: 'Pilotage',
    items: [{ cle: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard }],
  },
  {
    groupe: 'Exploitation',
    items: [
      { cle: 'chambres', label: 'Chambres', icon: BedDouble },
      { cle: 'reservations', label: 'Réservations', icon: CalendarRange },
      { cle: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed },
      { cle: 'conference', label: 'Salle de conférence', icon: Users },
    ],
  },
  {
    groupe: 'Administration',
    items: [
      { cle: 'caisse', label: 'Caisse & factures', icon: CircleDollarSign },
      { cle: 'tarifs', label: 'Tarifs & paramètres', icon: Settings2 },
    ],
  },
];

// Écrans autorisés pour le profil actif (miroir de la matrice RBAC).
export function ecransAutorises(profil) {
  return (PROFILS[profil] ?? PROFILS.direction).ecrans;
}

export function navFiltree(profil) {
  const autorises = ecransAutorises(profil);
  return NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => autorises.includes(item.cle)),
  })).filter((section) => section.items.length > 0);
}

function Mark() {
  return (
    <div className="relative grid size-10 place-items-center overflow-hidden rounded-xl bg-maj text-white shadow-card">
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
        <path
          fill="currentColor"
          opacity="0.95"
          d="M16 2l3.2 6.6L26 6.6l-2 6.5 6.6 3.2-6.6 3.2 2 6.5-6.8-2L16 31l-3.2-6.9-6.8 2 2-6.5L1.4 16.6l6.6-3.2-2-6.5 6.8 2z"
        />
        <circle cx="16" cy="16.5" r="3.4" fill="var(--color-maj)" />
      </svg>
    </div>
  );
}

export function Sidebar({ active, onNavigate, onNightAudit }) {
  const { state } = useApp();
  const kpi = kpiDuJour(state);
  const aTraiter = state.chambres.filter((c) => c.statut === 'a_nettoyer').length;

  return (
    <aside className="hidden w-[252px] shrink-0 flex-col border-r border-line bg-sand-50 lg:flex">
      <div className="zellige border-b border-line-soft px-4 py-4">
        <div className="flex items-center gap-3">
          <Mark />
          <div className="min-w-0">
            <p className="font-display truncate text-[17px] leading-tight text-ink">Makarim</p>
            <p className="mt-0.5 truncate text-[10px] font-medium tracking-[0.09em] text-ink-3 uppercase">
              3★ · {HOTEL.ville} · {state.chambres.length} ch.
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navFiltree(state.profil).map((section) => (
          <div key={section.groupe} className="mb-5">
            <p className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.11em] text-ink-3 uppercase">
              {section.groupe}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.cle;
                const badge =
                  item.cle === 'chambres' && aTraiter ? String(aTraiter) : null;
                return (
                  <li key={item.cle}>
                    <button
                      type="button"
                      onClick={() => onNavigate(item.cle)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cx(
                        'group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors',
                        isActive
                          ? 'bg-maj-100 text-maj'
                          : 'text-ink-2 hover:bg-sand-200/70 hover:text-ink',
                      )}
                    >
                      <Icon
                        className={cx('size-4 shrink-0', isActive ? 'text-maj' : 'text-ink-3 group-hover:text-ink-2')}
                        strokeWidth={1.9}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {badge && (
                        <span className="tnum rounded-full bg-saffron-100 px-1.5 py-0.5 text-[10px] font-semibold text-saffron">
                          {badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-3">
        <Card className="p-3.5">
          <div className="flex items-center gap-3">
            <div className="relative grid place-items-center">
              <Ring value={kpi.occupation} size={52} stroke={5} />
              <span className="tnum absolute text-[11px] font-semibold text-ink">{kpi.occupation}%</span>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-[0.06em] text-ink-3 uppercase">Ce soir</p>
              <p className="tnum mt-0.5 text-sm font-semibold text-ink">
                {kpi.vendues} / {state.chambres.length} chambres
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="mt-3 w-full justify-start" onClick={onNightAudit}>
            <Moon className="size-3.5 text-ink-3" />
            Clôture de journée
          </Button>
        </Card>
        <p className="mt-3 px-1 text-[10px] leading-4 text-ink-3">
          Prototype fonctionnel · état enregistré localement
        </p>
      </div>
    </aside>
  );
}

export function Topbar({ titre, sousTitre, onOpenMobileNav, onOpenPalette, onChangerProfil }) {
  const { state, actions } = useApp();
  const [menuProfil, setMenuProfil] = useState(false);
  const profil = PROFILS[state.profil] ?? PROFILS.direction;

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-line bg-surface/85 px-4 backdrop-blur-sm md:px-6">
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="grid size-9 place-items-center rounded-lg border border-line text-ink-2 lg:hidden"
        aria-label="Ouvrir la navigation"
      >
        <LayoutDashboard className="size-4" />
      </button>

      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">{titre}</h1>
        <p className="truncate text-[11px] text-ink-3">{sousTitre}</p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenPalette}
          className="hidden items-center gap-2 rounded-xl border border-line bg-sand-50 px-3 py-2 text-ink-3 transition-colors hover:border-maj/30 hover:text-maj md:flex"
        >
          <Search className="size-3.5" />
          <span className="text-xs">Rechercher ou agir…</span>
          <Kbd>⌘K</Kbd>
        </button>

        <Pill tone="jade" className="hidden sm:inline-flex" title={fmtLong(state.date)}>
          <span className="size-1.5 rounded-full bg-jade" />
          Journée ouverte
        </Pill>

        <button
          type="button"
          onClick={() => actions.reset()}
          title="Réinitialiser les données de démonstration"
          className="hidden size-9 place-items-center rounded-lg border border-line text-ink-2 hover:bg-sand-100 sm:grid"
          aria-label="Réinitialiser la démonstration"
        >
          <RotateCcw className="size-4" />
        </button>

        <button
          type="button"
          className="relative grid size-9 place-items-center rounded-lg border border-line text-ink-2 hover:bg-sand-100"
          aria-label="Notifications (4)"
        >
          <Bell className="size-4" />
          <span className="absolute top-2 right-2.5 size-1.5 rounded-full bg-terra ring-2 ring-white" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuProfil((v) => !v)}
            aria-expanded={menuProfil}
            aria-haspopup="menu"
            className={cx(
              'flex items-center gap-2 rounded-xl border border-line bg-surface py-1 pr-2 pl-1 transition-colors hover:border-maj/30',
              menuProfil && 'border-maj/40 ring-2 ring-maj/15',
            )}
          >
            <span className="grid size-9 place-items-center rounded-lg bg-ink text-[11px] font-semibold text-white">
              {profil.initiales}
            </span>
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-[11px] font-semibold text-ink">{profil.label}</p>
              <p className="text-[10px] text-ink-3">{profil.personne}</p>
            </div>
            <ChevronDown className={cx('size-3.5 text-ink-3 transition-transform', menuProfil && 'rotate-180')} />
          </button>

          {menuProfil && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setMenuProfil(false)}
                aria-label="Fermer le menu de profil"
                tabIndex={-1}
              />
              <div className="animate-fade-up absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
                <p className="border-b border-line-soft bg-sand-50 px-3 py-2 text-[10px] font-semibold tracking-[0.09em] text-ink-3 uppercase">
                  Changer de profil — démonstration RBAC
                </p>
                <ul className="max-h-80 overflow-y-auto py-1">
                  {Object.entries(PROFILS).map(([cle, p]) => (
                    <li key={cle}>
                      <button
                        type="button"
                        onClick={() => {
                          onChangerProfil?.(cle);
                          setMenuProfil(false);
                        }}
                        className={cx(
                          'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-sand-100',
                          cle === state.profil && 'bg-maj-50',
                        )}
                      >
                        <span
                          className={cx(
                            'grid size-7 shrink-0 place-items-center rounded-lg text-[10px] font-semibold',
                            cle === state.profil ? 'bg-maj text-white' : 'bg-sand-200 text-ink-2',
                          )}
                        >
                          {p.initiales}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-medium text-ink">{p.label}</span>
                          <span className="block truncate text-[10px] text-ink-3">{p.personne}</span>
                        </span>
                        <span className="tnum shrink-0 text-[10px] text-ink-3">
                          {p.ecrans.length} écran{p.ecrans.length > 1 ? 's' : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="border-t border-line-soft px-3 py-2 text-[10px] leading-4 text-ink-3">
                  Le serveur applique la même matrice sur chaque endpoint (BR-TR-004) :
                  l’interface ne fait que refléter les droits.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileNav({ open, onClose, active, onNavigate }) {
  const { state } = useApp();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" className="absolute inset-0 bg-ink/30" onClick={onClose} aria-label="Fermer" />
      <div className="animate-slide-in relative h-full w-72 border-r border-line bg-sand-50 p-3">
        <div className="mb-4 flex items-center justify-between px-1 py-2">
          <span className="font-display text-lg">Makarim</span>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer la navigation">
            ✕
          </Button>
        </div>
        {navFiltree(state.profil).map((section) => (
          <div key={section.groupe} className="mb-3">
            <p className="px-2 pb-1 text-[10px] font-semibold tracking-[0.1em] text-ink-3 uppercase">{section.groupe}</p>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.cle}
                  type="button"
                  onClick={() => {
                    onNavigate(item.cle);
                    onClose();
                  }}
                  className={cx(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium',
                    active === item.cle ? 'bg-maj-100 text-maj' : 'text-ink-2',
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BottomNav({ active, onNavigate }) {
  const { state } = useApp();
  const items = [
    { cle: 'dashboard', label: 'Pilotage', icon: LayoutDashboard },
    { cle: 'chambres', label: 'Chambres', icon: BedDouble },
    { cle: 'reservations', label: 'Planning', icon: CalendarRange },
    { cle: 'restaurant', label: 'Resto', icon: UtensilsCrossed },
    { cle: 'caisse', label: 'Caisse', icon: CircleDollarSign },
  ].filter((item) => ecransAutorises(state.profil).includes(item.cle));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.cle}
            type="button"
            onClick={() => onNavigate(item.cle)}
            className={cx(
              'flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium',
              active === item.cle ? 'text-maj' : 'text-ink-3',
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
