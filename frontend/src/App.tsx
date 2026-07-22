import { useEffect, useState } from 'react';
import { ReservationsCalendarPage } from '@/features/reservations/pages/ReservationsCalendarPage';
import { CheckinPage } from '@/features/checkin/pages/CheckinPage';
import { HousekeepingPage } from '@/features/housekeeping/pages/HousekeepingPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { MaintenancePage } from '@/features/maintenance/pages/MaintenancePage';
import { GuestsPage } from '@/features/guests/pages/GuestsPage';
import { CompaniesPage } from '@/features/companies/pages/CompaniesPage';
import { ParametersPage } from '@/features/parameters/pages/ParametersPage';
import { HrPage } from '@/features/hr/pages/HrPage';
import { LogoutGuardDialog } from '@/features/hr/components/LogoutGuardDialog';
import { statutCourant } from '@/features/hr/api';
import { StockPage } from '@/features/stock/pages/StockPage';
import { ReportingPage } from '@/features/reporting/pages/ReportingPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppTopbar } from '@/components/layout/AppTopbar';
import { onAuthFailure } from '@/lib/api-client';
import { clearTokens, getAccessToken } from '@/lib/token-storage';

export type Tab =
  | 'dashboard'
  | 'reservations'
  | 'checkin'
  | 'housekeeping'
  | 'maintenance'
  | 'guests'
  | 'companies'
  | 'parameters'
  | 'hr'
  | 'stock'
  | 'reporting';
type AuthScreen = 'login' | 'forgot-password';

// Coquille applicative : sidebar repliable (navigation principale) + topbar
// (titre de page, pointage self-service, déconnexion). Pas de routeur —
// sera introduit avec le module core (layout/routing), voir
// docs/plan-execution-claude-code.md §1 ; un simple switch d'onglet suffit
// tant qu'il n'y a pas d'URL profonde à adresser.
function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Présence d'un access token = hypothèse d'authentification optimiste ; si
  // le token est en réalité expiré/invalide, le premier appel API échouera
  // en 401, déclenchera une tentative de refresh (voir lib/api-client.ts),
  // et onAuthFailure() nous ramènera ici si le refresh échoue aussi.
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => getAccessToken() !== null,
  );
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [logoutGuardOpen, setLogoutGuardOpen] = useState(false);

  useEffect(() => {
    onAuthFailure(() => {
      setIsAuthenticated(false);
      setAuthScreen('login');
    });
  }, []);

  function doLogout() {
    clearTokens();
    setIsAuthenticated(false);
    setAuthScreen('login');
    setLogoutGuardOpen(false);
  }

  // BR-RH-004 (ADR-007) : une déconnexion pendant un service de pointage
  // actif est bloquée tant que l'employé n'a pas explicitement clôturé ou
  // mis en pause son service.
  async function handleLogout() {
    try {
      const statut = await statutCourant();
      if (statut.bloqueDeconnexion) {
        setLogoutGuardOpen(true);
        return;
      }
    } catch {
      // Pas de fiche employé associée à ce compte (ex. Administrateur) —
      // rien ne bloque la déconnexion.
    }
    doLogout();
  }

  if (!isAuthenticated) {
    if (authScreen === 'forgot-password') {
      return (
        <ForgotPasswordPage onBackToLogin={() => setAuthScreen('login')} />
      );
    }
    return (
      <LoginPage
        onLoginSuccess={() => setIsAuthenticated(true)}
        onForgotPassword={() => setAuthScreen('forgot-password')}
      />
    );
  }

  return (
    <div className="flex h-screen">
      <AppSidebar
        activeTab={tab}
        onNavigate={setTab}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar activeTab={tab} onLogout={handleLogout} />
        <div className="flex-1 overflow-auto">
          {tab === 'dashboard' && <DashboardPage onNavigate={setTab} />}
          {tab === 'reservations' && <ReservationsCalendarPage />}
          {tab === 'checkin' && <CheckinPage />}
          {tab === 'housekeeping' && <HousekeepingPage />}
          {tab === 'maintenance' && <MaintenancePage />}
          {tab === 'guests' && <GuestsPage />}
          {tab === 'companies' && <CompaniesPage />}
          {tab === 'parameters' && <ParametersPage />}
          {tab === 'hr' && <HrPage />}
          {tab === 'stock' && <StockPage />}
          {tab === 'reporting' && <ReportingPage />}
        </div>
      </div>
      <LogoutGuardDialog
        open={logoutGuardOpen}
        onCancel={() => setLogoutGuardOpen(false)}
        onResolved={doLogout}
      />
    </div>
  );
}

export default App;
