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
  PrototypeFrontDeskA,
  PrototypeBillingA,
  PrototypeNightAuditA,
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
  // DESIGN-010 — vérifié AVANT '/design-preview/b' : 'billing-a' commence
  // par 'b' et serait sinon intercepté par le préfixe court de PrototypeB.
  if (pathname.startsWith('/design-preview/billing-a'))
    return (
      <Suspense fallback={null}>
        <PrototypeBillingA />
      </Suspense>
    );
  // ARCH-011 — Night Audit prototype, vérifié AVANT '/design-preview/a' :
  // 'night-audit-a' commence par 'n', pas de collision directe, mais plus
  // clair d'être explicite.
  if (pathname.startsWith('/design-preview/night-audit-a'))
    return (
      <Suspense fallback={null}>
        <PrototypeNightAuditA />
      </Suspense>
    );
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
  if (pathname.startsWith('/design-preview/frontdesk-a'))
    return (
      <Suspense fallback={null}>
        <PrototypeFrontDeskA />
      </Suspense>
    );
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{renderRoot()}</StrictMode>,
);
