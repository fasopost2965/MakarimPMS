import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  BedDouble,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Building2,
  CheckCircle2,
  Award,
} from "lucide-react";
import type { OccupancySummary, FinancialSummary } from "../types";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";

interface ReportingDashboardProps {
  occupancyData: OccupancySummary | null;
  financialData: FinancialSummary | null;
  dateDebut: string;
  dateFin: string;
  loading?: boolean;
}

export function ReportingDashboard({
  occupancyData,
  financialData,
  dateDebut,
  dateFin,
  loading = false,
}: ReportingDashboardProps) {
  const [subView, setSubView] = useState<"kpis" | "financial">("kpis");

  // Format chart data for Room Type Performance
  const roomTypeChartData = useMemo(() => {
    if (!occupancyData?.roomTypeBreakdown) return [];
    return occupancyData.roomTypeBreakdown.map((rt) => ({
      name: rt.nom,
      nuitees: rt.nuiteesVendues,
      chambres: rt.totalChambres,
      taux:
        rt.totalChambres > 0
          ? Math.round(
              (rt.nuiteesVendues /
                (rt.totalChambres * (occupancyData.kpis.totalDays || 1))) *
                100,
            )
          : 0,
    }));
  }, [occupancyData]);

  // Channel breakdown chart data
  const canalChartData = useMemo(() => {
    if (!occupancyData?.canalBreakdown) return [];
    return occupancyData.canalBreakdown.map((c) => ({
      canal: c.canal || "Direct",
      reservations: c.count,
    }));
  }, [occupancyData]);

  // Export handlers
  const handleExportDashboardExcel = () => {
    if (!occupancyData) return;
    const kpiRows = [
      {
        Indicator: "Taux d'Occupation Net",
        Value: `${occupancyData.kpis.tauxOccupationNet}%`,
      },
      {
        Indicator: "Prix Moyen Chambre (ADR)",
        Value: `${occupancyData.kpis.adr} MAD`,
      },
      { Indicator: "RevPAR", Value: `${occupancyData.kpis.revpar} MAD` },
      { Indicator: "Chambres Totales", Value: occupancyData.kpis.totalRooms },
      {
        Indicator: "Chambres Hors Service",
        Value: occupancyData.kpis.maintenanceRooms,
      },
      {
        Indicator: "Nuitées Vendues",
        Value: occupancyData.kpis.occupiedNightsCount,
      },
      {
        Indicator: "Chiffre d'Affaires Hébergement HT",
        Value: `${financialData?.caNetHtHebergement || 0} MAD`,
      },
      {
        Indicator: "Chiffre d'Affaires Extras HT",
        Value: `${financialData?.caNetHtExtras || 0} MAD`,
      },
      {
        Indicator: "Solde Encaissé TTC",
        Value: `${financialData?.soldeBrutEncaisse || 0} MAD`,
      },
    ];
    exportToExcel(
      kpiRows,
      `KPI_Dashboard_${dateDebut}_${dateFin}.xlsx`,
      "KPIs Dashboard",
    );
  };

  const handleExportDashboardPDF = () => {
    if (!occupancyData) return;
    const headers = ["Indicateur Clé", "Valeur Mesurée", "Commentaire / Seuil"];
    const rows = [
      [
        "Taux d'Occupation Net",
        `${occupancyData.kpis.tauxOccupationNet}%`,
        "Chambres vendibles uniquement",
      ],
      [
        "Prix Moyen Chambre (ADR)",
        `${occupancyData.kpis.adr} MAD`,
        "Revenu moyen par chambre occupée",
      ],
      [
        "RevPAR",
        `${occupancyData.kpis.revpar} MAD`,
        "Revenu par chambre disponible",
      ],
      [
        "Nuitées Vendues",
        `${occupancyData.kpis.occupiedNightsCount}`,
        `Sur ${occupancyData.kpis.totalDays} jour(s)`,
      ],
      [
        "CA HT Hébergement",
        `${financialData?.caNetHtHebergement || 0} MAD`,
        "Soumis à la TVA 10%",
      ],
      [
        "CA HT Extras & Services",
        `${financialData?.caNetHtExtras || 0} MAD`,
        "Soumis à la TVA 20%",
      ],
      [
        "TVA Totale Collectée",
        `${(Number(financialData?.tvaHebergementCollectee || 0) + Number(financialData?.tvaExtrasCollectee || 0)).toFixed(2)} MAD`,
        "A reverser à la DGI",
      ],
      [
        "Solde Bruts Encaissés TTC",
        `${financialData?.soldeBrutEncaisse || 0} MAD`,
        "Total folios réglés",
      ],
    ];

    exportToPDF(
      "Tableau de Bord Analytique - KPIs Clés",
      headers,
      rows,
      `KPI_Dashboard_${dateDebut}_${dateFin}.pdf`,
      `Période d'Analyse : du ${dateDebut} au ${dateFin}`,
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-slate-200">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const kpis = occupancyData?.kpis;

  return (
    <div className="space-y-6">
      {/* View Switcher & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubView("kpis")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              subView === "kpis"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Vue Synthèse KPIs & RevPAR
          </button>
          <button
            onClick={() => setSubView("financial")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              subView === "financial"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Synthèse Financière & Folios
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1 font-semibold text-emerald-700 bg-emerald-50 border-emerald-200"
            onClick={handleExportDashboardExcel}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1 font-semibold text-destructive bg-destructive/10 border-destructive/20"
            onClick={handleExportDashboardPDF}
          >
            <FileText className="h-3.5 w-3.5" />
            PDF
          </Button>
        </div>
      </div>

      {/* KPI METRICS OVERVIEW CARDS */}
      {subView === "kpis" && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Occupancy Rate */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Taux d'Occupation
                </span>
                <BedDouble className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-black font-mono text-primary">
                {kpis?.tauxOccupationNet || 0}%
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>{kpis?.occupiedNightsCount || 0} nuitées vendues</span>
                <span className="font-semibold text-slate-700">
                  Brut: {kpis?.tauxOccupationBrut || 0}%
                </span>
              </div>
            </div>

            {/* ADR */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Prix Moyen (ADR)
                </span>
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-3xl font-black font-mono text-slate-900">
                {kpis?.adr || "0.00"}{" "}
                <span className="text-xs text-slate-500 font-sans">MAD</span>
              </p>
              <p className="text-[11px] text-emerald-600 font-medium">
                Prix moyen par nuitée réservée
              </p>
            </div>

            {/* RevPAR */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">
                  RevPAR
                </span>
                <TrendingUp className="h-4 w-4 text-sky-600" />
              </div>
              <p className="text-3xl font-black font-mono text-sky-700">
                {kpis?.revpar || "0.00"}{" "}
                <span className="text-xs text-slate-500 font-sans">MAD</span>
              </p>
              <p className="text-[11px] text-slate-500">
                Rendement par chambre disponible
              </p>
            </div>

            {/* CA Total */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md space-y-2">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-xs font-bold uppercase tracking-wider">
                  CA Hébergement HT
                </span>
                <Award className="h-4 w-4 text-amber-400" />
              </div>
              <p className="text-3xl font-black font-mono text-emerald-400">
                {kpis?.caHebergement || "0.00"}{" "}
                <span className="text-xs text-slate-300 font-sans">MAD</span>
              </p>
              <p className="text-[11px] text-slate-400">
                Période du {dateDebut} au {dateFin}
              </p>
            </div>
          </div>

          {/* VISUAL RECHARTS CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Room Type Occupancy & Sold Nights */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <BedDouble className="h-4 w-4 text-primary" />
                  Nuitées Vendues par Category de Chambre
                </h3>
                <p className="text-xs text-slate-500">
                  Distribution du volume de vente par typologie
                </p>
              </div>

              {roomTypeChartData.length > 0 ? (
                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={roomTypeChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#1e293b",
                          borderRadius: "12px",
                          color: "#ffffff",
                          fontSize: "12px",
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                      />
                      <Bar
                        dataKey="nuitees"
                        name="Nuitées Vendues"
                        fill="#3b82f6"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-12 text-center">
                  Aucune donnée disponible
                </p>
              )}
            </div>

            {/* Chart 2: Channel Distribution */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Volume de Réservations par Canal (Direct vs OTA)
                </h3>
                <p className="text-xs text-slate-500">
                  Origine des flux de réservations reçus
                </p>
              </div>

              {canalChartData.length > 0 ? (
                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={canalChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="canal"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#1e293b",
                          borderRadius: "12px",
                          color: "#ffffff",
                          fontSize: "12px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="reservations"
                        name="Réservations"
                        stroke="#10b981"
                        fill="#d1fae5"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-12 text-center">
                  Aucune donnée disponible
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECONDARY VIEW: FINANCIAL SUMMARY */}
      {subView === "financial" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Synthèse Financière Globale & Encaissements
              </h3>
              <p className="text-xs text-slate-500">
                Contrôle fiscal DGI, ventilation du chiffre d'affaires et solde
                des folios
              </p>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
              Conforme Normes DGI
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase">
                CA HT Hébergement
              </span>
              <p className="text-2xl font-black font-mono text-slate-900">
                {financialData?.caNetHtHebergement || "0.00"} MAD
              </p>
              <p className="text-[11px] text-slate-500">
                Exclut TVA 10% & Taxe Séjour
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase">
                CA HT Extras & Repas
              </span>
              <p className="text-2xl font-black font-mono text-slate-900">
                {financialData?.caNetHtExtras || "0.00"} MAD
              </p>
              <p className="text-[11px] text-slate-500">Exclut TVA 20%</p>
            </div>

            <div className="p-4 bg-slate-900 text-white rounded-xl shadow-md space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase">
                Solde Brut Encaissé TTC
              </span>
              <p className="text-2xl font-black font-mono text-emerald-400">
                {financialData?.soldeBrutEncaisse || "0.00"} MAD
              </p>
              <p className="text-[11px] text-slate-400">
                Total paiements validés
              </p>
            </div>
          </div>

          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-amber-900">
              <CheckCircle2 className="h-4 w-4 text-amber-700" /> Note de
              Régularisation Trésor
            </p>
            <p className="text-slate-600 leading-relaxed">
              La Taxe de Séjour collectée (
              {financialData?.taxeSejourCollectee || 0} MAD) est enregistrée
              séparément sur le compte de tiers 445 et n'entre pas dans les
              produits d'exploitation de l'hôtel.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
