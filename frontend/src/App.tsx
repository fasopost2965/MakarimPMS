import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ReservationsCalendarPage } from "@/features/reservations/pages/ReservationsCalendarPage";
import { CheckinPage } from "@/features/checkin/pages/CheckinPage";
import { HousekeepingPage } from "@/features/housekeeping/pages/HousekeepingPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { MaintenancePage } from "@/features/maintenance/pages/MaintenancePage";
import { GuestsPage } from "@/features/guests/pages/GuestsPage";
import { CompaniesPage } from "@/features/companies/pages/CompaniesPage";
import { ParametersPage } from "@/features/parameters/pages/ParametersPage";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { ForgotPasswordPage } from "@/features/auth/pages/ForgotPasswordPage";
import { onAuthFailure } from "@/lib/api-client";
import { clearTokens, getAccessToken } from "@/lib/token-storage";
import {
  LayoutDashboard,
  Calendar,
  UserCheck,
  BedDouble,
  Wrench,
  Users,
  Building2,
  Settings,
  LogOut,
  Sun,
  Moon,
  Clock,
  User,
} from "lucide-react";

type Tab =
  | "dashboard"
  | "reservations"
  | "checkin"
  | "housekeeping"
  | "maintenance"
  | "guests"
  | "companies"
  | "parameters";
type AuthScreen = "login" | "forgot-password";

function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => getAccessToken() !== null,
  );
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login");

  // Dark Mode State & Persistence
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved) return saved === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  // Dynamic Clock State
  const [time, setTime] = useState(new Date());

  // Handle active role state (visual only, for UI display)
  const [mockUser] = useState({
    nom: "Rachid El Amrani",
    role: "Réception",
  });

  useEffect(() => {
    onAuthFailure(() => {
      setIsAuthenticated(false);
      setAuthScreen("login");
    });

    // Clock Interval
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync Dark Class with Document Element
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  function handleLogout() {
    clearTokens();
    setIsAuthenticated(false);
    setAuthScreen("login");
  }

  // Format Date in elegant French
  const formattedDate = time.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedTime = time.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  if (!isAuthenticated) {
    if (authScreen === "forgot-password") {
      return (
        <ForgotPasswordPage onBackToLogin={() => setAuthScreen("login")} />
      );
    }
    return (
      <LoginPage
        onLoginSuccess={() => setIsAuthenticated(true)}
        onForgotPassword={() => setAuthScreen("forgot-password")}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground transition-colors duration-300">
      {/* Upper Brand & Stats Header */}
      <header className="flex flex-col border-b bg-card px-5 py-3 md:flex-row md:items-center md:justify-between">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          {/* Custom Moorish Arched Geometric Crest */}
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2C7.5 2 4 6 4 10.5V21h16v-10.5C20 6 16.5 2 12 2z" />
              <path d="M12 2v19" />
              <path d="M4 14h16" />
              <path d="M12 7c1.5 1 2.5 2.5 2.5 4S13.5 15 12 15s-2.5-2.5-2.5-4S10.5 7 12 7z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg font-bold tracking-wide text-primary">
                Hôtel Makarim
              </span>
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                ★★★ Tétouan
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Système de Gestion Hôtelière
            </p>
          </div>
        </div>

        {/* Center: Live Local Clock (highly relevant for hospitality) */}
        <div className="my-2 flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-xs font-medium md:my-0">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span className="capitalize">{formattedDate}</span>
          <span className="mx-1 text-muted-foreground">•</span>
          <span className="font-mono text-primary font-semibold">
            {formattedTime}
          </span>
        </div>

        {/* Right: User Information, Dark Mode, Logout */}
        <div className="flex items-center gap-3">
          {/* Active User Badge with Role */}
          <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-xs shadow-sm">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              <User className="h-3 w-3" />
            </div>
            <div className="text-left leading-none">
              <p className="font-semibold">{mockUser.nom}</p>
              <span className="text-[10px] font-medium text-muted-foreground">
                {mockUser.role} (Shift Jour)
              </span>
            </div>
          </div>

          {/* Dark Mode Toggle */}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg"
            onClick={() => setIsDark(!isDark)}
            title="Mode nuit"
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-primary" />
            )}
          </Button>

          {/* Logout */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
            title="Déconnexion"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <nav className="flex flex-wrap items-center gap-1 border-b bg-card px-4 py-2">
        <Button
          variant={tab === "dashboard" ? "default" : "ghost"}
          size="sm"
          className="gap-2 rounded-md px-3 font-medium text-xs h-9 transition-all"
          onClick={() => setTab("dashboard")}
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Tableau de bord
        </Button>
        <Button
          variant={tab === "reservations" ? "default" : "ghost"}
          size="sm"
          className="gap-2 rounded-md px-3 font-medium text-xs h-9 transition-all"
          onClick={() => setTab("reservations")}
        >
          <Calendar className="h-3.5 w-3.5" />
          Réservations
        </Button>
        <Button
          variant={tab === "checkin" ? "default" : "ghost"}
          size="sm"
          className="gap-2 rounded-md px-3 font-medium text-xs h-9 transition-all"
          onClick={() => setTab("checkin")}
        >
          <UserCheck className="h-3.5 w-3.5" />
          Check-in
        </Button>
        <Button
          variant={tab === "housekeeping" ? "default" : "ghost"}
          size="sm"
          className="gap-2 rounded-md px-3 font-medium text-xs h-9 transition-all"
          onClick={() => setTab("housekeeping")}
        >
          <BedDouble className="h-3.5 w-3.5" />
          Housekeeping
        </Button>
        <Button
          variant={tab === "maintenance" ? "default" : "ghost"}
          size="sm"
          className="gap-2 rounded-md px-3 font-medium text-xs h-9 transition-all"
          onClick={() => setTab("maintenance")}
        >
          <Wrench className="h-3.5 w-3.5" />
          Maintenance
        </Button>
        <Button
          variant={tab === "guests" ? "default" : "ghost"}
          size="sm"
          className="gap-2 rounded-md px-3 font-medium text-xs h-9 transition-all"
          onClick={() => setTab("guests")}
        >
          <Users className="h-3.5 w-3.5" />
          Clients
        </Button>
        <Button
          variant={tab === "companies" ? "default" : "ghost"}
          size="sm"
          className="gap-2 rounded-md px-3 font-medium text-xs h-9 transition-all"
          onClick={() => setTab("companies")}
        >
          <Building2 className="h-3.5 w-3.5" />
          Entreprises
        </Button>
        <Button
          variant={tab === "parameters" ? "default" : "ghost"}
          size="sm"
          className="gap-2 rounded-md px-3 font-medium text-xs h-9 transition-all"
          onClick={() => setTab("parameters")}
        >
          <Settings className="h-3.5 w-3.5" />
          Paramètres
        </Button>
      </nav>

      {/* Main Content Pane */}
      <div className="flex-1 overflow-auto bg-background p-1">
        {tab === "dashboard" && <DashboardPage onNavigate={setTab} />}
        {tab === "reservations" && <ReservationsCalendarPage />}
        {tab === "checkin" && <CheckinPage />}
        {tab === "housekeeping" && <HousekeepingPage />}
        {tab === "maintenance" && <MaintenancePage />}
        {tab === "guests" && <GuestsPage />}
        {tab === "companies" && <CompaniesPage />}
        {tab === "parameters" && <ParametersPage />}
      </div>
    </div>
  );
}

export default App;
