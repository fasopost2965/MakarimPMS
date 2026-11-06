// Ossature de la démonstration : coquille (sidebar / topbar / navigation mobile),
// routage par état, garde d'accès selon le profil RBAC, palette ⌘K et modale de
// clôture de journée (night audit).
//
// Règles métier matérialisées ici :
//  - BR-TR-004 : l'accès aux écrans suit la matrice RBAC (miroir côté client,
//    le serveur reste seul juge en production) ;
//  - BR-TR-005 : la clôture de journée est un parcours explicite avec contrôles
//    (folios non soldés, départs restants, chambres à nettoyer, arrivées non
//    enregistrées) avant le passage à J+1.

import { useEffect, useState } from 'react';
import { CheckCircle2, Moon, ShieldCheck, TriangleAlert } from 'lucide-react';
import { BottomNav, MobileNav, Sidebar, Topbar, ecransAutorises } from './components/Shell';
import { CommandPalette } from './components/CommandPalette';
import { Button, Modal, Pill, ToastProvider, cx, useToast } from './components/ui';
import { PROFILS } from './data';
import { AppProvider, departsDuJour, kpiDuJour, soldeDuFolio, useApp } from './store';
import { fmtLong, money } from './lib/date';
import { Dashboard } from './screens/Dashboard';
import { Rooms } from './screens/Rooms';
import { Reservations } from './screens/Reservations';
import { Restaurant } from './screens/Restaurant';
import { Conference } from './screens/Conference';
import { Caisse } from './screens/Caisse';
import { Rates } from './screens/Rates';
import { Police } from './screens/Police';
import { Tournees } from './screens/Tournees';
import { Documents } from './screens/Documents';
import { Roles } from './screens/Roles';
import { Stock } from './screens/Stock';
import { Channel } from './screens/Channel';
import { Login } from './screens/Login';

const PAGES = {
  dashboard: { titre: 'Tableau de bord', sousTitre: 'Pilotage de l’exploitation · Hôtel Makarim 3★', Composant: Dashboard },
  chambres: { titre: 'Chambres', sousTitre: 'États, housekeeping et disponibilité — 30 chambres', Composant: Rooms },
  reservations: { titre: 'Réservations', sousTitre: 'Planning 14 jours · canaux et occupation', Composant: Reservations },
  restaurant: { titre: 'Restaurant Le Marsa', sousTitre: 'Service, carte et notes en chambre', Composant: Restaurant },
  conference: { titre: 'Salle de conférence', sousTitre: 'Planning, événements et devis séminaire', Composant: Conference },
  caisse: { titre: 'Caisse & factures', sousTitre: 'Folios, encaissements et notes restaurant', Composant: Caisse },
  police: { titre: 'Fiches de police', sousTitre: 'Registre d’hébergement · obligation légale', Composant: Police },
  tournees: { titre: 'Tours de quart', sousTitre: 'Relève des trois shifts · cahier de transmission', Composant: Tournees },
  documents: { titre: 'Documents & PDF', sousTitre: 'Factures, fiches de police, rapports de tournée', Composant: Documents },
  roles: { titre: 'Rôles & permissions', sousTitre: 'Paramétrage des accès par la Direction', Composant: Roles },
  stock: { titre: 'Stock', sousTitre: 'Consommables, linge et minibar des chambres', Composant: Stock },
  channel: { titre: 'Channel manager', sousTitre: 'Distribution en ligne · tarifs et disponibilités', Composant: Channel },
  tarifs: { titre: 'Tarifs & paramètres', sousTitre: 'Grille, formules, fiscalité et identité', Composant: Rates },
};

export function NightAudit({ open, onClose }) {
  const { state, actions } = useApp();
  const { push } = useToast();

  const foliosOuverts = state.folios.filter((f) => soldeDuFolio(f) > 0);
  const totalDu = foliosOuverts.reduce((s, f) => s + soldeDuFolio(f), 0);
  const departs = departsDuJour(state);
  const aNettoyer = state.chambres.filter((c) => c.statut === 'a_nettoyer').length;
  const arriveesNonFaites = state.reservations.filter((r) => r.arrivee === state.date && r.statut === 'confirmee').length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Clôture de la journée"
      subtitle={`${fmtLong(state.date)} — contrôle avant passage à J+1`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-ink-3">
            Les arrivées non enregistrées seront marquées « non présentées ».
          </p>
          <Button
            onClick={() => {
              actions.closeDay();
              onClose();
              push('Journée clôturée — passage à J+1 effectué.', 'info');
            }}
          >
            <Moon className="size-3.5" /> Clôturer
          </Button>
        </div>
      }
    >
      <ul className="space-y-2.5">
        {[
          {
            ok: foliosOuverts.length === 0,
            titre: `${foliosOuverts.length} folio(s) non soldé(s)`,
            detail:
              foliosOuverts.length === 0
                ? 'Tous les comptes clients sont à jour.'
                : `${money(totalDu)} MAD en attente — chambres ${foliosOuverts.map((f) => f.chambre).join(', ')}.`,
            bloquant: false,
          },
          {
            ok: departs.length === 0,
            titre: `${departs.length} départ(s) encore en chambre`,
            detail:
              departs.length === 0
                ? 'Aucun départ en retard.'
                : `${departs.map((d) => d.chambre).join(', ')} — les séjours resteront ouverts après la clôture.`,
            bloquant: false,
          },
          {
            ok: aNettoyer === 0,
            titre: `${aNettoyer} chambre(s) à nettoyer`,
            detail: 'Le housekeeping reprendra la liste demain matin.',
            bloquant: false,
          },
          {
            ok: arriveesNonFaites === 0,
            titre: `${arriveesNonFaites} arrivée(s) non enregistrée(s)`,
            detail: 'Elles seront marquées « non présentées » à la clôture.',
            bloquant: false,
          },
        ].map((ligne) => (
          <li
            key={ligne.titre}
            className={cx(
              'flex gap-3 rounded-xl border p-3',
              ligne.ok ? 'border-jade/30 bg-jade-100/40' : 'border-saffron/35 bg-saffron-100/40',
            )}
          >
            {ligne.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-jade" />
            ) : (
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-saffron" />
            )}
            <div>
              <p className="text-[12px] font-medium text-ink">{ligne.titre}</p>
              <p className="mt-0.5 text-[12px] leading-4 text-ink-3">{ligne.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-sand-100 p-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink-3" />
        <p className="text-[12px] leading-4 text-ink-2">
          La clôture est journalisée et figée : la date d’exploitation avance,
          les KPI se réinitialisent et les arrivées restantes passent en
          non-présentation. Aucune donnée n’est supprimée.
        </p>
      </div>
    </Modal>
  );
}

function Contenu() {
  const { state, actions } = useApp();
  const [page, setPage] = useState('dashboard');
  const [navMobile, setNavMobile] = useState(false);
  const [palette, setPalette] = useState(false);
  const [nightAudit, setNightAudit] = useState(false);
  const { push } = useToast();
  const courant = PAGES[page];
  const Composant = courant.Composant;
  const kpi = kpiDuJour(state);
  const profil = PROFILS[state.profil] ?? PROFILS.direction;

  // Un changement de profil peut retirer l'écran courant : on retombe sur
  // l'écran d'accueil du profil (comme le ferait un 403 côté serveur).
  useEffect(() => {
    if (!ecransAutorises(state.profil, state.roles).includes(page)) setPage(profil.accueil);
  }, [page, profil.accueil, state.profil, state.roles]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    const onReset = () => {
      actions.reset();
      push('Démonstration réinitialisée.', 'info');
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('makarim:reset', onReset);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('makarim:reset', onReset);
    };
  }, [actions, push]);

  // Portail : sans session ouverte, aucun écran de l'application n'est rendu.
  // Ce retour anticipé est placé après tous les hooks (règle des hooks) —
  // il ne doit jamais précéder un useEffect ou un useMemo.
  if (!state.session) return <Login />;

  return (
    <div className="flex h-screen overflow-hidden bg-sand-100">
      {/* Lien d'évitement : première cible du clavier, évite de retraverser
          la navigation à chaque changement d'écran. */}
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-[13px] focus:font-medium focus:text-white"
      >
        Aller au contenu principal
      </a>
      <Sidebar active={page} onNavigate={setPage} onNightAudit={() => setNightAudit(true)} />
      <MobileNav open={navMobile} onClose={() => setNavMobile(false)} active={page} onNavigate={setPage} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          titre={courant.titre}
          sousTitre={`${courant.sousTitre} · ${fmtLong(state.date)}`}
          onOpenMobileNav={() => setNavMobile(true)}
          onOpenPalette={() => setPalette(true)}
          onChangerProfil={(cle) => {
            actions.setProfil(cle);
            setPage(PROFILS[cle].accueil);
            push(`Profil « ${PROFILS[cle].label} » activé — navigation et droits recalculés.`, 'info');
          }}
        />
        <main id="contenu" tabIndex={-1} className="flex-1 overflow-y-auto pb-16 outline-none lg:pb-0">
          <div key={page} className="animate-fade-up">
            <Composant onNavigate={setPage} kpi={kpi} />
          </div>
          <div className="hidden justify-center pb-6 lg:flex">
            <Pill tone="neutral">
              ⌘K pour naviguer · {state.chambres.length} chambres
              {profil.montants !== false && ` · ${money(kpi.caTotal)} MAD de CA en cours`}
            </Pill>
          </div>
        </main>
      </div>

      <BottomNav active={page} onNavigate={setPage} />
      <CommandPalette
        open={palette}
        onClose={() => setPalette(false)}
        onNavigate={setPage}
        onNightAudit={() => setNightAudit(true)}
      />
      <NightAudit open={nightAudit} onClose={() => setNightAudit(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <Contenu />
      </ToastProvider>
    </AppProvider>
  );
}
