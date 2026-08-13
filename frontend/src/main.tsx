import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { HousekeepingMobileApp } from './features/housekeeping/pages/HousekeepingMobileApp.tsx';
import { MaintenanceMobileApp } from './features/maintenance/pages/MaintenanceMobileApp.tsx';
// DESIGN-005 — prototypes d'exploration desktop, strictement isolés (voir
// design-prototypes/README.md). Aucune donnée réelle, aucun lien vers
// App.tsx/AppSidebar/LoginPage. À retirer avec le dossier après décision.
import {
  PrototypeA,
  PrototypeB,
  PrototypeC,
  PrototypeD,
  PrototypeD2,
  PrototypeD3,
  PrototypeReservationsC,
  PrototypeHousekeepingA,
} from './design-prototypes/lazy.tsx';

// Handoff design final, lot 4 (HousekeepingMobile.dc.html/MaintenanceMobile.dc.html)
// — points d'entrée autonomes pour les apps terrain (housekeeping : session
// Bearer indépendante F9 ; maintenance : session cookie normale, aucune
// infra mobile dédiée), jamais rattachés à AppSidebar/App.tsx. Pas de
// dépendance react-router dans ce projet (App.tsx navigue par
// useState<Tab>) : un simple test de chemin suffit ici, seules deux racines
// mobiles existent en plus de l'app principale.
const pathname = window.location.pathname;

function renderRoot() {
  if (pathname.startsWith('/mobile/housekeeping'))
    return <HousekeepingMobileApp />;
  if (pathname.startsWith('/mobile/maintenance'))
    return <MaintenanceMobileApp />;
  if (pathname.startsWith('/design-preview/a'))
    return (
      <Suspense fallback={null}>
        <PrototypeA />
      </Suspense>
    );
  if (pathname.startsWith('/design-preview/b'))
    return (
      <Suspense fallback={null}>
        <PrototypeB />
      </Suspense>
    );
  if (pathname.startsWith('/design-preview/c'))
    return (
      <Suspense fallback={null}>
        <PrototypeC />
      </Suspense>
    );
  if (pathname.startsWith('/design-preview/d3'))
    return (
      <Suspense fallback={null}>
        <PrototypeD3 />
      </Suspense>
    );
  if (pathname.startsWith('/design-preview/d2'))
    return (
      <Suspense fallback={null}>
        <PrototypeD2 />
      </Suspense>
    );
  if (pathname.startsWith('/design-preview/d'))
    return (
      <Suspense fallback={null}>
        <PrototypeD />
      </Suspense>
    );
  if (pathname.startsWith('/design-preview/reservations-c'))
    return (
      <Suspense fallback={null}>
        <PrototypeReservationsC />
      </Suspense>
    );
  if (pathname.startsWith('/design-preview/housekeeping-a'))
    return (
      <Suspense fallback={null}>
        <PrototypeHousekeepingA />
      </Suspense>
    );
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{renderRoot()}</StrictMode>,
);
