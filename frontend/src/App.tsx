import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ReservationsCalendarPage } from '@/features/reservations/pages/ReservationsCalendarPage';
import { CheckinPage } from '@/features/checkin/pages/CheckinPage';
import { HousekeepingPage } from '@/features/housekeeping/pages/HousekeepingPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { onAuthFailure } from '@/lib/api-client';
import { clearTokens, getAccessToken } from '@/lib/token-storage';

type Tab = 'dashboard' | 'reservations' | 'checkin' | 'housekeeping';
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

  useEffect(() => {
    onAuthFailure(() => {
      setIsAuthenticated(false);
      setAuthScreen('login');
    });
  }, []);

  function handleLogout() {
    clearTokens();
    setIsAuthenticated(false);
    setAuthScreen('login');
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
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={handleLogout}
        >
          Déconnexion
        </Button>
      </nav>
      <div className="flex-1 overflow-auto">
        {tab === 'dashboard' && <DashboardPage onNavigate={setTab} />}
        {tab === 'reservations' && <ReservationsCalendarPage />}
        {tab === 'checkin' && <CheckinPage />}
        {tab === 'housekeeping' && <HousekeepingPage />}
      </div>
    </div>
  );
}

export default App;
