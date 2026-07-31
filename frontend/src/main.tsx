import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { HousekeepingMobileApp } from './features/housekeeping/pages/HousekeepingMobileApp.tsx';
import { MaintenanceMobileApp } from './features/maintenance/pages/MaintenanceMobileApp.tsx';

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
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{renderRoot()}</StrictMode>,
);
