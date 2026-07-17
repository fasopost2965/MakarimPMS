import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ReservationsCalendarPage } from '@/features/reservations/pages/ReservationsCalendarPage';
import { CheckinPage } from '@/features/checkin/pages/CheckinPage';

type Tab = 'reservations' | 'checkin';

// Pas de routeur pour l'instant — sera introduit avec le module core
// (layout/routing), voir docs/plan-execution-claude-code.md §1. Un simple
// switch d'onglet suffit tant qu'il n'y a que deux écrans de premier niveau.
function App() {
  const [tab, setTab] = useState<Tab>('reservations');

  return (
    <div className="flex h-screen flex-col">
      <nav className="flex items-center gap-1 border-b p-2">
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
      </nav>
      <div className="flex-1 overflow-auto">
        {tab === 'reservations' ? (
          <ReservationsCalendarPage />
        ) : (
          <CheckinPage />
        )}
      </div>
    </div>
  );
}

export default App;
