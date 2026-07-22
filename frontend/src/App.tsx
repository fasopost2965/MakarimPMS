import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ReservationsCalendarPage } from '@/features/reservations/pages/ReservationsCalendarPage';
import { CheckinPage } from '@/features/checkin/pages/CheckinPage';
import { HousekeepingPage } from '@/features/housekeeping/pages/HousekeepingPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { MaintenancePage } from '@/features/maintenance/pages/MaintenancePage';
import { GuestsPage } from '@/features/guests/pages/GuestsPage';
import { CompaniesPage } from '@/features/companies/pages/CompaniesPage';
import { ParametersPage } from '@/features/parameters/pages/ParametersPage';
import { HrPage } from '@/features/hr/pages/HrPage';
import { AttendanceWidget } from '@/features/hr/components/AttendanceWidget';
import { LogoutGuardDialog } from '@/features/hr/components/LogoutGuardDialog';
import { statutCourant } from '@/features/hr/api';
import { StockPage } from '@/features/stock/pages/StockPage';
import { ReportingPage } from '@/features/reporting/pages/ReportingPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { onAuthFailure } from '@/lib/api-client';
import { clearTokens, getAccessToken } from '@/lib/token-storage';

type Tab =
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

// Pas de routeur pour l'instant — sera introduit avec le module core
// (layout/routing), voir docs/plan-execution-claude-code.md §1. Un simple
// switch d'onglet suffit tant qu'il n'y a que quatre écrans de premier niveau.
function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
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
    <div className="flex h-screen flex-col">
      <nav className="flex items-center gap-1 border-b p-2">
        <Button
          variant={tab === 'dashboard' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setTab('dashboard')}
        >
          Tableau de bord
        </Button>
        <Button
          variant={tab === 'reservations' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setTab('reservations')}
        >
          Réservations
        </Button>
        <Button
          variant={tab === 'checkin' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setTab('checkin')}
        >
          Check-in
        </Button>
        <Button
          variant={tab === 'housekeeping' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setTab('housekeeping')}
        >
          Housekeeping
        </Button>
        <Button
          variant={tab === 'maintenance' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setTab('maintenance')}
        >
          Maintenance
        </Button>
        <Button
          variant={tab === 'guests' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setTab('guests')}
        >
          Clients
        </Button>
        <Button
          variant={tab === 'companies' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setTab('companies')}
        >
          Entreprises
        </Button>
        <Button
          variant={tab === 'parameters' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setTab('parameters')}
        >
          Paramètres
        </Button>
        <Button
          variant={tab === 'hr' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setTab('hr')}
        >
          RH
        </Button>
        <Button
          variant={tab === 'stock' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setTab('stock')}
        >
          Stock
        </Button>
        <Button
          variant={tab === 'reporting' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setTab('reporting')}
        >
          Reporting
        </Button>
        <div className="ml-auto flex items-center gap-3">
          <AttendanceWidget />
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Déconnexion
          </Button>
        </div>
      </nav>
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
      <LogoutGuardDialog
        open={logoutGuardOpen}
        onCancel={() => setLogoutGuardOpen(false)}
        onResolved={doLogout}
      />
    </div>
  );
}

export default App;
