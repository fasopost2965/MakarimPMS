import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Printer,
  Download,
  TrendingUp,
  Building2,
  BedDouble,
  Sparkles,
  Wrench,
  ShieldCheck,
  BarChart3,
  DollarSign,
  CheckCircle2,
  Clock,
  Layers,
  Package,
  Compass,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
} from "lucide-react";
import {
  getFinancialSummary,
  getTaxesReport,
  getOccupancySummary,
  getHousekeepingSummary,
  getMaintenanceSummary,
  getPoliceStats,
  getYieldForecast,
  exportGrandLivre,
  exportPoliceRegister,
} from "../api";
import type {
  FinancialSummary,
  TaxesReport,
  OccupancySummary,
  HousekeepingSummary,
  MaintenanceSummary,
  PoliceStats,
  YieldForecastReport,
} from "../types";
import { ReportingDashboard } from "../components/ReportingDashboard";
import { ReportFilter } from "../components/ReportFilter";
import type { FilterState } from "../components/ReportFilter";
import { DEPARTMENTS } from "../constants";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";

type TabType =
  | "dashboard"
  | "financial"
  | "occupancy"
  | "housekeeping"
  | "maintenance"
  | "police"
  | "yield"
  | "custom"
  | "future";

export function ReportingPage() {
  // Date & Filter State
  const [dateDebut, setDateDebut] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
  });
  const [dateFin, setDateFin] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [selectedDepts, setSelectedDepts] = useState<string[]>(
    DEPARTMENTS.map((d) => d.id),
  );
  const [globalSearch, setGlobalSearch] = useState<string>("");

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

  // Data states
  const [financialData, setFinancialData] = useState<FinancialSummary | null>(
    null,
  );
  const [taxesData, setTaxesData] = useState<TaxesReport | null>(null);
  const [occupancyData, setOccupancyData] = useState<OccupancySummary | null>(
    null,
  );
  const [housekeepingData, setHousekeepingData] =
    useState<HousekeepingSummary | null>(null);
  const [maintenanceData, setMaintenanceData] =
    useState<MaintenanceSummary | null>(null);
  const [policeData, setPoliceData] = useState<PoliceStats | null>(null);
  const [yieldData, setYieldData] = useState<YieldForecastReport | null>(null);

  // Status states
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);

  // Custom Generator Filter State
  const [customCategory, setCustomCategory] = useState("all");

  const handleFilterChange = (filters: FilterState) => {
    setDateDebut(filters.dateDebut);
    setDateFin(filters.dateFin);
    setSelectedDepts(filters.departments);
    setGlobalSearch(filters.search);
  };

  const loadDashboardData = useCallback(async () => {
    if (!dateDebut || !dateFin) return;
    setLoading(true);
    setError(null);
    try {
      const [fin, tax, occ, hk, maint, pol, yld] = await Promise.all([
        getFinancialSummary(dateDebut, dateFin).catch(() => null),
        getTaxesReport(dateDebut, dateFin).catch(() => null),
        getOccupancySummary(dateDebut, dateFin).catch(() => null),
        getHousekeepingSummary().catch(() => null),
        getMaintenanceSummary().catch(() => null),
        getPoliceStats(dateDebut, dateFin).catch(() => null),
        getYieldForecast(dateDebut, dateFin).catch(() => null),
      ]);

      setFinancialData(fin);
      setTaxesData(tax);
      setOccupancyData(occ);
      setHousekeepingData(hk);
      setMaintenanceData(maint);
      setPoliceData(pol);
      setYieldData(yld);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors du chargement des rapports",
      );
    } finally {
      setLoading(false);
    }
  }, [dateDebut, dateFin]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDashboardData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadDashboardData]);

  // Export handlers
  const handleExportGrandLivre = async () => {
    if (!dateDebut || !dateFin) return;
    setExporting(true);
    try {
      await exportGrandLivre(dateDebut, dateFin);
    } catch (err) {
      alert(
        "Erreur export grand livre: " +
          (err instanceof Error ? err.message : "Erreur"),
      );
    } finally {
      setExporting(false);
    }
  };

  const handleExportPolice = async () => {
    if (!dateDebut || !dateFin) return;
    setExporting(true);
    try {
      await exportPoliceRegister(dateDebut, dateFin);
    } catch (err) {
      alert(
        "Erreur export registre police: " +
          (err instanceof Error ? err.message : "Erreur"),
      );
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Generic Export Helpers per Tab
  const exportCurrentTabExcel = () => {
    if (activeTab === "financial" && taxesData?.detail) {
      exportToExcel(
        taxesData.detail,
        `Taxes_Fiscalc_${dateDebut}_${dateFin}.xlsx`,
      );
    } else if (activeTab === "occupancy" && occupancyData?.roomTypeBreakdown) {
      exportToExcel(
        occupancyData.roomTypeBreakdown,
        `Occupancy_Types_${dateDebut}_${dateFin}.xlsx`,
      );
    } else if (activeTab === "housekeeping" && housekeepingData?.stockItems) {
      exportToExcel(
        housekeepingData.stockItems,
        `Housekeeping_Stock_${dateDebut}.xlsx`,
      );
    } else if (activeTab === "maintenance" && maintenanceData?.recentTickets) {
      const rows = maintenanceData.recentTickets.map((t) => ({
        Chambre: t.room ? t.room.numero : "Partie commune",
        TypePanne: t.typePanne,
        Priorite: t.priorite,
        AssigneA: t.assigneA || "Non assigné",
        Statut: t.resoluAt ? "Résolu" : "En cours",
        DateCreation: t.createdAt.slice(0, 10),
      }));
      exportToExcel(rows, `Maintenance_Tickets_${dateDebut}.xlsx`);
    } else if (activeTab === "police" && policeData?.records) {
      exportToExcel(
        policeData.records,
        `Police_Fiches_${dateDebut}_${dateFin}.xlsx`,
      );
    } else if (activeTab === "custom") {
      exportToExcel(customRows, `Custom_Report_${dateDebut}_${dateFin}.xlsx`);
    } else {
      alert("Export Excel disponible pour les vues de données filtrées.");
    }
  };

  const exportCurrentTabPDF = () => {
    if (activeTab === "financial" && taxesData?.detail) {
      const headers = [
        "Type de Taxe",
        "Mode",
        "Collecté Trésor",
        "Lignes",
        "Montant",
      ];
      const rows = taxesData.detail.map((t) => [
        t.type,
        t.mode,
        t.collectePourTresor ? "Trésor Public" : "Interne",
        t.nbLignes,
        `${t.montantCollecte} MAD`,
      ]);
      exportToPDF(
        "Rapport des Taxes Collectées (DGI)",
        headers,
        rows,
        `Taxes_${dateDebut}_${dateFin}.pdf`,
        `Période du ${dateDebut} au ${dateFin}`,
      );
    } else if (activeTab === "occupancy" && occupancyData?.roomTypeBreakdown) {
      const headers = [
        "Category / Type",
        "Chambres Totales",
        "Nuitées Vendues",
      ];
      const rows = occupancyData.roomTypeBreakdown.map((r) => [
        r.nom,
        r.totalChambres,
        r.nuiteesVendues,
      ]);
      exportToPDF(
        "Rapport d'Occupation par Categorie",
        headers,
        rows,
        `Occupancy_${dateDebut}_${dateFin}.pdf`,
        `Période du ${dateDebut} au ${dateFin}`,
      );
    } else if (activeTab === "housekeeping" && housekeepingData?.stockItems) {
      const headers = [
        "Code",
        "Libellé Article",
        "Quantité Dispo",
        "Unité",
        "Seuil Alerte",
      ];
      const rows = housekeepingData.stockItems.map((s) => [
        s.code,
        s.libelle,
        s.quantiteDisponible,
        s.uniteMesure,
        s.seuilAlerte,
      ]);
      exportToPDF(
        "Inventaire Lingerie & Produits Gouvernance",
        headers,
        rows,
        `Housekeeping_${dateDebut}.pdf`,
      );
    } else if (activeTab === "maintenance" && maintenanceData?.recentTickets) {
      const headers = [
        "Chambre",
        "Panne / Incident",
        "Priorité",
        "Assigné À",
        "Statut",
      ];
      const rows = maintenanceData.recentTickets.map((t) => [
        t.room ? `Ch. ${t.room.numero}` : "Partie commune",
        t.typePanne,
        t.priorite,
        t.assigneA || "Non assigné",
        t.resoluAt ? "Résolu" : "En cours",
      ]);
      exportToPDF(
        "Registre des Incidents & Tickets Maintenance",
        headers,
        rows,
        `Maintenance_${dateDebut}.pdf`,
      );
    } else if (activeTab === "police" && policeData?.records) {
      const headers = [
        "Nom Client",
        "Chambre",
        "Piece / N°",
        "Nationalité",
        "Date Arrivée",
      ];
      const rows = policeData.records.map((r) => [
        r.nom,
        `Ch. ${r.chambre}`,
        `${r.typePiece} - ${r.numeroPiece}`,
        r.nationalite,
        r.dateArrivee,
      ]);
      exportToPDF(
        "Registre Répartition Police & Sécurité (DGSN)",
        headers,
        rows,
        `Police_${dateDebut}_${dateFin}.pdf`,
      );
    } else if (activeTab === "custom") {
      const headers = [
        "Nom Client",
        "Chambre",
        "Pièce",
        "Nationalité",
        "Arrivée",
      ];
      const rows = customRows.map((r) => [
        r.nom,
        `Ch. ${r.chambre}`,
        `${r.typePiece} ${r.numeroPiece}`,
        r.nationalite,
        r.dateArrivee,
      ]);
      exportToPDF(
        "Rapport Sur-Mesure Personnalisé",
        headers,
        rows,
        `Custom_${dateDebut}_${dateFin}.pdf`,
      );
    } else {
      alert("Export PDF disponible pour ce tableau de données.");
    }
  };

  // Custom report data filtering
  let customRows = policeData ? policeData.records : [];
  const query = globalSearch.toLowerCase();
  if (query) {
    customRows = customRows.filter(
      (r) =>
        r.nom.toLowerCase().includes(query) ||
        r.chambre.toLowerCase().includes(query) ||
        r.numeroPiece.toLowerCase().includes(query) ||
        r.nationalite.toLowerCase().includes(query),
    );
  }
  if (customCategory !== "all") {
    customRows = customRows.filter((r) => r.typePiece === customCategory);
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50 p-4 md:p-6 space-y-6 print:p-0 print:bg-white text-slate-900">
      {/* Printable Header (Visible only when printing) */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wide">
              Hôtel Makarim ****
            </h1>
            <p className="text-xs text-slate-600">
              Rapport d'Exploitation & Performance Analytique
            </p>
            <p className="text-xs text-slate-500">
              Période : {dateDebut} au {dateFin} | Édité le :{" "}
              {new Date().toLocaleDateString("fr-FR")}
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <p className="font-semibold">ICE : 001524896000034</p>
            <p>IF : 40289123 | RC : 12458</p>
            <p>Rabat, Maroc</p>
          </div>
        </div>
      </div>

      {/* Main Screen Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Rapports & Analytics
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Tableaux de bord analytiques, synthèses financières et registres
                réglementaires
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4 text-slate-600" />
            Imprimer / PDF
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-xs font-semibold shadow-xs text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/50 border-emerald-200"
            onClick={exportCurrentTabExcel}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-xs font-semibold shadow-xs text-sky-700 bg-sky-50/50 hover:bg-sky-100/50 border-sky-200"
            onClick={exportCurrentTabPDF}
          >
            <FileText className="h-4 w-4" />
            Export PDF
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-xs font-semibold shadow-xs text-slate-700 bg-slate-100 hover:bg-slate-200"
            disabled={exporting}
            onClick={handleExportGrandLivre}
          >
            <Download className="h-4 w-4" />
            {exporting ? "Export…" : "Grand Livre CSV"}
          </Button>
        </div>
      </div>

      {/* REUSABLE REPORT FILTER COMPONENT */}
      <ReportFilter
        initialFilter={{
          dateDebut,
          dateFin,
          departments: selectedDepts,
          search: globalSearch,
        }}
        onFilterChange={handleFilterChange}
        showDepartments={true}
        showSearch={true}
      />

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20 flex items-center justify-between">
          <span>{error}</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => void loadDashboardData()}
          >
            Réessayer
          </Button>
        </div>
      )}

      {/* Dashboard Navigation Tabs */}
      <div className="border-b border-slate-200 overflow-x-auto pb-0.5 scrollbar-none print:hidden">
        <nav className="flex space-x-1 min-w-max">
          {[
            {
              id: "dashboard",
              label: "Tableau de Bord & KPIs",
              icon: LayoutDashboard,
            },
            {
              id: "financial",
              label: "Financier & Taxes (DGI)",
              icon: DollarSign,
              badge: financialData
                ? `${financialData.soldeBrutEncaisse} MAD`
                : undefined,
            },
            {
              id: "occupancy",
              label: "Hébergement & Séjours",
              icon: BedDouble,
              badge: occupancyData
                ? `${occupancyData.kpis.tauxOccupationNet}% TO`
                : undefined,
            },
            {
              id: "housekeeping",
              label: "Gouvernance & Lingerie",
              icon: Sparkles,
              badge: housekeepingData
                ? `${housekeepingData.chambresTotal} Ch.`
                : undefined,
            },
            {
              id: "maintenance",
              label: "Maintenance & Incidents",
              icon: Wrench,
              badge: maintenanceData
                ? `${maintenanceData.openTicketsCount} Ouverts`
                : undefined,
            },
            {
              id: "police",
              label: "Police & Sécurité (DGSN)",
              icon: ShieldCheck,
              badge: policeData
                ? `${policeData.totalFichesPolice} Arrivées`
                : undefined,
            },
            {
              id: "yield",
              label: "Yield & Tarifs (F3)",
              icon: TrendingUp,
              badge: "Revenue Mgr",
            },
            { id: "custom", label: "Générateur Sur-Mesure", icon: Layers },
            {
              id: "future",
              label: "Évolutions Recommandées",
              icon: Compass,
              alert: true,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                  isActive
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${isActive ? "text-primary" : "text-slate-400"}`}
                />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
                {tab.alert && (
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB 0: REPORTING DASHBOARD COMPONENT (AGGREGATING OCCUPANCY, REVPAR, ADR & CHARTS) */}
      {activeTab === "dashboard" && (
        <ReportingDashboard
          occupancyData={occupancyData}
          financialData={financialData}
          dateDebut={dateDebut}
          dateFin={dateFin}
          loading={loading}
        />
      )}

      {/* TAB CONTENT 1: FINANCIAL & TAXES */}
      {(activeTab === "financial" || window.matchMedia("print").matches) && (
        <div className="space-y-6">
          {/* Key Financial KPIs Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                CA HT Hébergement
              </span>
              <p className="text-lg font-extrabold text-slate-900 font-mono">
                {financialData?.caNetHtHebergement || "0.00"}{" "}
                <span className="text-xs font-sans text-slate-500">MAD</span>
              </p>
              <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
                <CheckCircle2 className="h-3 w-3" /> Hors TVA 10%
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                CA HT Extras / Repas
              </span>
              <p className="text-lg font-extrabold text-slate-900 font-mono">
                {financialData?.caNetHtExtras || "0.00"}{" "}
                <span className="text-xs font-sans text-slate-500">MAD</span>
              </p>
              <p className="text-[10px] text-slate-500 font-medium">
                Consommations folios
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                TVA Hébergement
              </span>
              <p className="text-lg font-extrabold text-amber-600 font-mono">
                {financialData?.tvaHebergementCollectee || "0.00"}{" "}
                <span className="text-xs font-sans text-slate-500">MAD</span>
              </p>
              <p className="text-[10px] text-amber-700 font-medium">
                Collectée (Taux 10%)
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                TVA Extras (20%)
              </span>
              <p className="text-lg font-extrabold text-amber-600 font-mono">
                {financialData?.tvaExtrasCollectee || "0.00"}{" "}
                <span className="text-xs font-sans text-slate-500">MAD</span>
              </p>
              <p className="text-[10px] text-slate-500 font-medium">
                Restauration & services
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Taxe de Séjour
              </span>
              <p className="text-lg font-extrabold text-sky-600 font-mono">
                {financialData?.taxeSejourCollectee || "0.00"}{" "}
                <span className="text-xs font-sans text-slate-500">MAD</span>
              </p>
              <p className="text-[10px] text-sky-700 font-medium">
                Reversée à la commune
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-900/20 bg-slate-900 text-white p-4 shadow-md space-y-1">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Solde Encaisse TTC
              </span>
              <p className="text-xl font-black font-mono text-emerald-400">
                {financialData?.soldeBrutEncaisse || "0.00"}{" "}
                <span className="text-xs font-sans text-slate-300">MAD</span>
              </p>
              <p className="text-[10px] text-slate-400">
                Encaissements réels folios
              </p>
            </div>
          </div>

          {/* Tax Breakdown & DGI Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Tax Details Table */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Déclaration Fiscale & Section Trésor Public (DGI)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ventilation détaillée des taxes collectées par catégorie
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={exportCurrentTabExcel}
                  >
                    Excel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={exportCurrentTabPDF}
                  >
                    PDF
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px]">
                    <tr>
                      <th className="p-2.5 rounded-l-lg">Type de Taxe</th>
                      <th className="p-2.5">Mode</th>
                      <th className="p-2.5">Destination</th>
                      <th className="p-2.5 text-center">Nbr Lignes</th>
                      <th className="p-2.5 text-right rounded-r-lg">
                        Montant Collecté
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {taxesData?.detail && taxesData.detail.length > 0 ? (
                      taxesData.detail.map((t) => (
                        <tr key={t.taxeId} className="hover:bg-slate-50/80">
                          <td className="p-2.5 font-bold text-slate-900">
                            {t.type}
                          </td>
                          <td className="p-2.5">{t.mode}</td>
                          <td className="p-2.5">
                            {t.collectePourTresor ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold text-[10px]">
                                Trésor Public (État)
                              </span>
                            ) : (
                              <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                                Interne Hôtel
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center font-mono">
                            {t.nbLignes}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                            {t.montantCollecte} MAD
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-6 text-center text-slate-400 italic"
                        >
                          Aucune taxe spécifique générée sur cette période.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Visual Revenue Distribution */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Répartition Visuelle du CA
              </h3>
              <p className="text-xs text-slate-500">
                Poids des hébergements, extras et taxes collectées
              </p>

              {financialData && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-600">
                        Part Hébergement HT
                      </span>
                      <span className="font-mono text-slate-900">
                        {financialData.caNetHtHebergement} MAD
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: "75%" }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-600">
                        Part Extras & Restauration HT
                      </span>
                      <span className="font-mono text-slate-900">
                        {financialData.caNetHtExtras} MAD
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 transition-all"
                        style={{ width: "18%" }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-600">
                        Cumul Taxes (TVA + Séjour)
                      </span>
                      <span className="font-mono text-slate-900">
                        {(
                          Number(financialData.tvaHebergementCollectee) +
                          Number(financialData.tvaExtrasCollectee) +
                          Number(financialData.taxeSejourCollectee)
                        ).toFixed(2)}{" "}
                        MAD
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 transition-all"
                        style={{ width: "12%" }}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1 mt-4">
                    <p className="font-bold text-slate-900">
                      Note de Conformité Comptable
                    </p>
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      Les montants sont extraits directement des folios scellés.
                      Les taxes collectées sont exclues du CA Net selon la norme
                      comptable hôtelière marocaine.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: OCCUPANCY & STAYS */}
      {activeTab === "occupancy" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Taux Occupation Net
              </span>
              <p className="text-2xl font-black text-primary font-mono">
                {occupancyData?.kpis.tauxOccupationNet || "0"}%
              </p>
              <p className="text-[10px] text-emerald-600 font-medium">
                Exclut chamb. en maintenance
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Prix Moyen (ADR)
              </span>
              <p className="text-xl font-extrabold text-slate-900 font-mono">
                {occupancyData?.kpis.adr || "0.00"}{" "}
                <span className="text-xs font-sans text-slate-500">MAD</span>
              </p>
              <p className="text-[10px] text-slate-500 font-medium">
                Par nuitée vendue
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                RevPAR
              </span>
              <p className="text-xl font-extrabold text-emerald-600 font-mono">
                {occupancyData?.kpis.revpar || "0.00"}{" "}
                <span className="text-xs font-sans text-slate-500">MAD</span>
              </p>
              <p className="text-[10px] text-slate-500 font-medium">
                Par chambre dispo
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Nuitées Vendues
              </span>
              <p className="text-xl font-extrabold text-slate-900 font-mono">
                {occupancyData?.kpis.occupiedNightsCount || "0"} /{" "}
                {occupancyData?.kpis.totalAvailableRoomNights || "0"}
              </p>
              <p className="text-[10px] text-slate-500 font-medium">
                Sur {occupancyData?.kpis.totalDays || 1} jour(s)
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Flux Séjours
              </span>
              <p className="text-sm font-bold text-slate-800 font-mono pt-1">
                {occupancyData?.kpis.checkinsCount || 0} Arr. /{" "}
                {occupancyData?.kpis.checkoutsCount || 0} Dép.
              </p>
              <p className="text-[10px] text-emerald-600 font-medium">
                {occupancyData?.kpis.staysEnCours || 0} séjours en cours
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Compass className="h-4 w-4 text-primary" />
                Répartition par Canal de Réservation
              </h3>

              <div className="space-y-3">
                {occupancyData?.canalBreakdown &&
                occupancyData.canalBreakdown.length > 0 ? (
                  occupancyData.canalBreakdown.map((c) => (
                    <div key={c.canal} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-700">{c.canal}</span>
                        <span className="font-mono text-slate-900">
                          {c.count} réservation(s)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${Math.min(
                              100,
                              (c.count /
                                (occupancyData.kpis.occupiedNightsCount || 1)) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Aucune donnée canal disponible.
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <BedDouble className="h-4 w-4 text-primary" />
                  Performance par Type de Chambre
                </h3>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={exportCurrentTabExcel}
                  >
                    Excel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={exportCurrentTabPDF}
                  >
                    PDF
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px]">
                    <tr>
                      <th className="p-2">Type</th>
                      <th className="p-2 text-center">Chambres</th>
                      <th className="p-2 text-center">Nuitées Vendues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {occupancyData?.roomTypeBreakdown.map((rt) => (
                      <tr key={rt.roomTypeId}>
                        <td className="p-2 font-bold text-slate-900">
                          {rt.nom}
                        </td>
                        <td className="p-2 text-center font-mono">
                          {rt.totalChambres}
                        </td>
                        <td className="p-2 text-center font-mono font-bold text-primary">
                          {rt.nuiteesVendues}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: HOUSEKEEPING & LINGERIE */}
      {activeTab === "housekeeping" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {housekeepingData?.chambresParStatut &&
              Object.entries(housekeepingData.chambresParStatut).map(
                ([statut, count]) => (
                  <div
                    key={statut}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1"
                  >
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {statut}
                    </span>
                    <p className="text-2xl font-black text-slate-900 font-mono">
                      {count}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {Math.round(
                        (count / (housekeepingData.chambresTotal || 1)) * 100,
                      )}
                      % des chambres
                    </p>
                  </div>
                ),
              )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  État des Stocks Consommables & Lingerie
                </h3>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={exportCurrentTabExcel}
                  >
                    Excel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={exportCurrentTabPDF}
                  >
                    PDF
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px]">
                    <tr>
                      <th className="p-2">Code</th>
                      <th className="p-2">Article</th>
                      <th className="p-2 text-center">Quantité</th>
                      <th className="p-2 text-center">Seuil Alerte</th>
                      <th className="p-2 text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {housekeepingData?.stockItems.map((item) => {
                      const isAlert =
                        item.quantiteDisponible <= item.seuilAlerte;
                      return (
                        <tr key={item.id}>
                          <td className="p-2 font-mono text-slate-500">
                            {item.code}
                          </td>
                          <td className="p-2 font-bold text-slate-900">
                            {item.libelle}
                          </td>
                          <td className="p-2 text-center font-mono font-bold">
                            {item.quantiteDisponible} {item.uniteMesure}
                          </td>
                          <td className="p-2 text-center font-mono text-slate-500">
                            {item.seuilAlerte}
                          </td>
                          <td className="p-2 text-right">
                            {isAlert ? (
                              <span className="bg-destructive/10 text-destructive text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Alerte Réassort
                              </span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Ok
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Derniers Mouvements de Stock
              </h3>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 text-xs">
                {housekeepingData?.recentMovements.map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {m.stockItem.libelle}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {m.motif} {m.room ? `• Ch. ${m.room.numero}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-mono font-bold ${m.typeMouvement === "ENTREE" ? "text-emerald-600" : "text-slate-700"}`}
                      >
                        {m.typeMouvement === "ENTREE" ? "+" : "-"}
                        {m.quantite}
                      </span>
                      <p className="text-[10px] text-slate-400">
                        {m.createdAt.slice(0, 10)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: MAINTENANCE & INCIDENTS */}
      {activeTab === "maintenance" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Tickets Total
              </span>
              <p className="text-2xl font-black text-slate-900 font-mono">
                {maintenanceData?.totalTickets || 0}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                Tickets Ouverts
              </span>
              <p className="text-2xl font-black text-amber-900 font-mono">
                {maintenanceData?.openTicketsCount || 0}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                Résolus
              </span>
              <p className="text-2xl font-black text-emerald-900 font-mono">
                {maintenanceData?.resolvedTicketsCount || 0}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-destructive uppercase tracking-wider">
                Chambres Bloquées
              </span>
              <p className="text-2xl font-black text-destructive font-mono">
                {maintenanceData?.roomsInMaintenanceCount || 0}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                Liste des Incidents & Pannes Signalés
              </h3>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={exportCurrentTabExcel}
                >
                  Excel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={exportCurrentTabPDF}
                >
                  PDF
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="p-2">Chambre</th>
                    <th className="p-2">Type Panne</th>
                    <th className="p-2 text-center">Priorité</th>
                    <th className="p-2">Assigné À</th>
                    <th className="p-2 text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {maintenanceData?.recentTickets.map((t) => (
                    <tr key={t.id}>
                      <td className="p-2 font-bold text-slate-900">
                        {t.room ? `Ch. ${t.room.numero}` : "Partie commune"}
                      </td>
                      <td className="p-2">{t.typePanne}</td>
                      <td className="p-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.priorite === "URGENTE" || t.priorite === "HAUTE"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {t.priorite}
                        </span>
                      </td>
                      <td className="p-2 text-slate-600">
                        {t.assigneA || "Non assigné"}
                      </td>
                      <td className="p-2 text-right">
                        {t.resoluAt ? (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Résolu
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            En cours
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: POLICE & REGULATORY */}
      {activeTab === "police" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Répartition des Nationalités
              </h3>

              <div className="space-y-2">
                {policeData?.nationalities.map((n) => (
                  <div
                    key={n.nationalite}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-xs"
                  >
                    <span className="font-bold text-slate-800">
                      {n.nationalite}
                    </span>
                    <span className="font-mono font-bold text-primary">
                      {n.count} client(s)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-900">
                  Fiches de Police Enregistrées (
                  {policeData?.totalFichesPolice || 0})
                </h3>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={exportCurrentTabExcel}
                  >
                    Excel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={exportCurrentTabPDF}
                  >
                    PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleExportPolice}
                  >
                    CSV DGSN
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] sticky top-0">
                    <tr>
                      <th className="p-2">Client</th>
                      <th className="p-2">Chambre</th>
                      <th className="p-2">Pièce / N°</th>
                      <th className="p-2">Nationalité</th>
                      <th className="p-2">Arrivée</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {policeData?.records.map((r) => (
                      <tr key={r.id}>
                        <td className="p-2 font-bold text-slate-900">
                          {r.nom}
                        </td>
                        <td className="p-2 font-mono text-slate-600">
                          Ch. {r.chambre}
                        </td>
                        <td className="p-2 font-mono text-slate-700">
                          {r.typePiece} - {r.numeroPiece}
                        </td>
                        <td className="p-2">{r.nationalite}</td>
                        <td className="p-2 font-mono text-slate-500">
                          {r.dateArrivee}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 6: YIELD MANAGEMENT (F3) */}
      {activeTab === "yield" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Prévisions d'Occupation & Recommandations Tarifaires (Revenue
                  Manager)
                </h3>
                <p className="text-xs text-slate-500">
                  Calculs prédictifs basés sur la demande et soustrayant
                  automatiquement les chambres bloquées en maintenance.
                </p>
              </div>
            </div>

            {yieldData?.typesChambre.map((type) => (
              <div
                key={type.roomTypeId}
                className="border border-slate-200 rounded-xl p-4 space-y-3"
              >
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">
                      {type.nom}
                    </h4>
                    <span className="text-xs text-slate-500">
                      Inventaire : {type.totalChambres} chambre(s)
                    </span>
                  </div>
                  <span className="px-2.5 py-1 bg-primary/10 text-primary font-bold rounded-lg text-xs font-mono">
                    Occupation Moyenne : {type.tauxOccupationMoyen}%
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-1">
                  {type.previsions.slice(0, 12).map((prev) => (
                    <div
                      key={prev.date}
                      className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                        prev.recommandation === "HAUSSE"
                          ? "bg-emerald-50/60 border-emerald-200"
                          : prev.recommandation === "BAISSE"
                            ? "bg-amber-50/60 border-amber-200"
                            : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <p className="font-mono text-[10px] text-slate-500">
                        {prev.date}
                      </p>
                      <p className="font-bold text-slate-900 font-mono">
                        {prev.tauxOccupation}% occ.
                      </p>
                      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-200/50">
                        <span className="font-mono font-semibold text-slate-700">
                          {prev.prixActuel} DH
                        </span>
                        <span
                          className={`font-bold ${
                            prev.recommandation === "HAUSSE"
                              ? "text-emerald-700"
                              : prev.recommandation === "BAISSE"
                                ? "text-amber-700"
                                : "text-slate-600"
                          }`}
                        >
                          {prev.recommandation}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 7: CUSTOM GENERATOR */}
      {activeTab === "custom" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Générateur de Rapports Sur-Mesure
              </h3>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={exportCurrentTabExcel}
                >
                  Excel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={exportCurrentTabPDF}
                >
                  PDF
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label htmlFor="customCat" className="text-xs text-slate-500">
                  Filtrer par Pièce d'Identité
                </Label>
                <select
                  id="customCat"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full h-8 text-xs bg-slate-50 border border-slate-200 rounded-md px-2 mt-1"
                >
                  <option value="all">Toutes les pièces</option>
                  <option value="CIN">CIN Marocaine</option>
                  <option value="PASSPORT">Passeport Étranger</option>
                  <option value="CARTE_SEJOUR">Carte de Séjour</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="p-2.5">Nom & Prénom</th>
                    <th className="p-2.5">Chambre</th>
                    <th className="p-2.5">Type & N° Pièce</th>
                    <th className="p-2.5">Nationalité</th>
                    <th className="p-2.5 text-right">Date d'Arrivée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {customRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">
                        {r.nom}
                      </td>
                      <td className="p-2.5 font-mono text-slate-600">
                        Ch. {r.chambre}
                      </td>
                      <td className="p-2.5 font-mono">
                        {r.typePiece} - {r.numeroPiece}
                      </td>
                      <td className="p-2.5">{r.nationalite}</td>
                      <td className="p-2.5 text-right font-mono text-slate-500">
                        {r.dateArrivee}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 8: RECOMMENDED EVOLUTIONS */}
      {activeTab === "future" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <Compass className="h-5 w-5 text-amber-500" />
            Feuille de Route & Recommandations Prochaines
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Pour amplifier encore la valeur décisionnelle du PMS Hôtel Makarim,
            les fonctionnalités analytiques suivantes ont été préservées pour de
            futurs développements :
          </p>
          <ul className="space-y-2 text-xs text-slate-700 list-disc list-inside">
            <li>
              <strong>
                Connexion directe API DGSN (Télé-déclaration automatisée)
              </strong>{" "}
              : envoi instantané des fiches préfectorales dès la signature sur
              tablette tactile.
            </li>
            <li>
              <strong>
                Export direct CIH / Attijariwafa Bank (Format CFONB)
              </strong>{" "}
              : rapprochement bancaire automatique des encaissements carte TPE.
            </li>
            <li>
              <strong>Prévisions de Demande par IA (Machine Learning)</strong> :
              analyse historique des fêtes religieuses (Aïd, Ramadan) et
              événements locaux pour optimiser l'ADR.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
