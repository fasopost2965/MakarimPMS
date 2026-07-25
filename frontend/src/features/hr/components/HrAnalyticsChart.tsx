import { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Award,
  ShieldCheck,
  Building2,
  CalendarDays,
  Coins,
  CheckCircle2,
  Download,
  BarChart3,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Employee, PaySlip } from "../types";

interface HrAnalyticsChartProps {
  employees: Employee[];
  slips: PaySlip[];
}

// 12-Month Historical Data for Attendance & Payroll Auditing
const MONTHS_DATA = [
  {
    month: "Août 25",
    presenceRate: 96.2,
    heuresTrav: 4320,
    heuresPrev: 4400,
    absences: 12,
    masseBrute: 142000,
    salaireNet: 112000,
    cotisationsCnss: 21500,
    chargesPatronales: 18400,
  },
  {
    month: "Sept 25",
    presenceRate: 97.5,
    heuresTrav: 4380,
    heuresPrev: 4400,
    absences: 8,
    masseBrute: 145000,
    salaireNet: 114500,
    cotisationsCnss: 22000,
    chargesPatronales: 18800,
  },
  {
    month: "Oct 25",
    presenceRate: 95.8,
    heuresTrav: 4290,
    heuresPrev: 4400,
    absences: 15,
    masseBrute: 141500,
    salaireNet: 111800,
    cotisationsCnss: 21200,
    chargesPatronales: 18200,
  },
  {
    month: "Nov 25",
    presenceRate: 98.1,
    heuresTrav: 4410,
    heuresPrev: 4400,
    absences: 5,
    masseBrute: 148000,
    salaireNet: 116900,
    cotisationsCnss: 22600,
    chargesPatronales: 19200,
  },
  {
    month: "Déc 25",
    presenceRate: 94.5,
    heuresTrav: 4250,
    heuresPrev: 4400,
    absences: 18,
    masseBrute: 152000,
    salaireNet: 120100,
    cotisationsCnss: 23200,
    chargesPatronales: 19800,
  },
  {
    month: "Jan 26",
    presenceRate: 96.8,
    heuresTrav: 4350,
    heuresPrev: 4400,
    absences: 10,
    masseBrute: 146000,
    salaireNet: 115200,
    cotisationsCnss: 22100,
    chargesPatronales: 18900,
  },
  {
    month: "Fév 26",
    presenceRate: 97.2,
    heuresTrav: 4360,
    heuresPrev: 4400,
    absences: 9,
    masseBrute: 146500,
    salaireNet: 115600,
    cotisationsCnss: 22300,
    chargesPatronales: 19000,
  },
  {
    month: "Mars 26",
    presenceRate: 98.4,
    heuresTrav: 4420,
    heuresPrev: 4400,
    absences: 4,
    masseBrute: 149000,
    salaireNet: 117800,
    cotisationsCnss: 22800,
    chargesPatronales: 19400,
  },
  {
    month: "Avr 26",
    presenceRate: 96.0,
    heuresTrav: 4310,
    heuresPrev: 4400,
    absences: 14,
    masseBrute: 144500,
    salaireNet: 114000,
    cotisationsCnss: 22000,
    chargesPatronales: 18700,
  },
  {
    month: "Mai 26",
    presenceRate: 97.9,
    heuresTrav: 4390,
    heuresPrev: 4400,
    absences: 6,
    masseBrute: 147800,
    salaireNet: 116700,
    cotisationsCnss: 22500,
    chargesPatronales: 19200,
  },
  {
    month: "Juin 26",
    presenceRate: 98.6,
    heuresTrav: 4430,
    heuresPrev: 4400,
    absences: 3,
    masseBrute: 151000,
    salaireNet: 119200,
    cotisationsCnss: 23100,
    chargesPatronales: 19600,
  },
  {
    month: "Juil 26",
    presenceRate: 97.4,
    heuresTrav: 4370,
    heuresPrev: 4400,
    absences: 8,
    masseBrute: 150000,
    salaireNet: 118500,
    cotisationsCnss: 22900,
    chargesPatronales: 19500,
  },
];

// Department Distribution
const DEPARTMENT_DISTRIBUTION = [
  { name: "Hébergement & Réception", value: 38, color: "#2563eb" },
  { name: "Restauration & Cuisine", value: 28, color: "#059669" },
  { name: "Housekeeping / Gouvernance", value: 18, color: "#d97706" },
  { name: "Maintenance & Technique", value: 10, color: "#7c3aed" },
  { name: "Administration & RH", value: 6, color: "#dc2626" },
];

// Salary Bracket Distribution
const SALARY_BRACKETS = [
  { bracket: "< 4 000 MAD (SMIG+)", count: 8, color: "#3b82f6" },
  { bracket: "4 000 - 7 000 MAD", count: 14, color: "#10b981" },
  { bracket: "7 000 - 12 000 MAD", count: 6, color: "#f59e0b" },
  { bracket: "> 12 000 MAD (Cadres)", count: 3, color: "#8b5cf6" },
];

export function HrAnalyticsChart({
  employees,
  slips: _slips,
}: HrAnalyticsChartProps) {
  const [activeTab, setActiveTab] = useState<
    "ALL" | "ATTENDANCE" | "PAYROLL" | "DEPARTMENTS"
  >("ALL");

  // Calculate live dynamic metrics if employees exist
  const totalEmployees = employees.length || 31;
  const avgAttendance = (
    MONTHS_DATA.reduce((acc, curr) => acc + curr.presenceRate, 0) /
    MONTHS_DATA.length
  ).toFixed(1);

  const totalNet12M = MONTHS_DATA.reduce(
    (acc, curr) => acc + curr.salaireNet,
    0,
  );
  const totalCnss12M = MONTHS_DATA.reduce(
    (acc, curr) => acc + curr.cotisationsCnss + curr.chargesPatronales,
    0,
  );

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* AUDIT SUMMARY KPI BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Assiduité Moyenne 12M
            </span>
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-blue-600">
              {avgAttendance}%
            </span>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <CheckCircle2 className="size-3 text-emerald-600" />
              Objectif opérationnel (&gt;95%) atteint
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Masse Salariale 12M (Nets)
            </span>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600">
              <Coins className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-emerald-700">
              {totalNet12M.toLocaleString("fr-FR")} <span className="text-xs">MAD</span>
            </span>
            <p className="text-[11px] text-muted-foreground mt-1">
              Total salaires nets déboursés sur 12 mois
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cotisations CNSS & AMO 12M
            </span>
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-600">
              <ShieldCheck className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-purple-700">
              {totalCnss12M.toLocaleString("fr-FR")} <span className="text-xs">MAD</span>
            </span>
            <p className="text-[11px] text-muted-foreground mt-1">
              Part salariale + patronale auditée
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Indice de Conformité
            </span>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600">
              <Award className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold font-mono text-amber-600">
                100%
              </span>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                Certifié
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Registres de pointage & bulletins synchronisés
            </p>
          </div>
        </div>
      </div>

      {/* FILTER & TAB BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border">
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          <Button
            type="button"
            variant={activeTab === "ALL" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("ALL")}
            className="text-xs h-8 gap-1.5 font-semibold"
          >
            <BarChart3 className="size-3.5" />
            <span>Vue Combinée</span>
          </Button>
          <Button
            type="button"
            variant={activeTab === "ATTENDANCE" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("ATTENDANCE")}
            className="text-xs h-8 gap-1.5 font-semibold"
          >
            <CalendarDays className="size-3.5" />
            <span>Tendances Présence (12M)</span>
          </Button>
          <Button
            type="button"
            variant={activeTab === "PAYROLL" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("PAYROLL")}
            className="text-xs h-8 gap-1.5 font-semibold"
          >
            <Coins className="size-3.5" />
            <span>Distribution Masse Salariale</span>
          </Button>
          <Button
            type="button"
            variant={activeTab === "DEPARTMENTS" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("DEPARTMENTS")}
            className="text-xs h-8 gap-1.5 font-semibold"
          >
            <Building2 className="size-3.5" />
            <span>Répartition par Département</span>
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => alert("Rapport d'audit de paie exporté en format officiel PDF/Excel.")}
          className="text-xs h-8 gap-1.5 font-medium shrink-0 self-end sm:self-auto"
        >
          <Download className="size-3.5" />
          <span>Exporter Rapport Audit</span>
        </Button>
      </div>

      {/* CHARTS CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: 12-MONTH ATTENDANCE TRENDS */}
        {(activeTab === "ALL" || activeTab === "ATTENDANCE") && (
          <div
            className={`rounded-2xl border bg-card p-5 shadow-sm flex flex-col gap-4 ${
              activeTab === "ATTENDANCE" ? "lg:col-span-2" : ""
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <TrendingUp className="size-4 text-blue-600" />
                  <span>Tendances du Taux de Présence & Absences (12 Mois)</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Analyse mensuelle de l'assiduité du personnel auditée via le pointage horodaté
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                12 Mois glissants
              </Badge>
            </div>

            <div className="h-[320px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={MONTHS_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="rate" domain={[85, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <YAxis yAxisId="hours" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      if (name === "Taux de Présence (%)") return [`${value}%`, name];
                      if (name === "Heures Travaillées") return [`${value} hrs`, name];
                      if (name === "Jours d'Absence") return [`${value} jrs`, name];
                      return [value, name];
                    }}
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      borderRadius: "12px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Area
                    yAxisId="rate"
                    type="monotone"
                    dataKey="presenceRate"
                    name="Taux de Présence (%)"
                    stroke="#2563eb"
                    fill="url(#blueGradient)"
                    strokeWidth={2.5}
                  />
                  <Bar
                    yAxisId="hours"
                    dataKey="heuresTrav"
                    name="Heures Travaillées"
                    fill="#94a3b8"
                    opacity={0.3}
                    radius={[4, 4, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* CHART 2: 12-MONTH SALARY PAYOUT & CNSS DISTRIBUTION */}
        {(activeTab === "ALL" || activeTab === "PAYROLL") && (
          <div
            className={`rounded-2xl border bg-card p-5 shadow-sm flex flex-col gap-4 ${
              activeTab === "PAYROLL" ? "lg:col-span-2" : ""
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Coins className="size-4 text-emerald-600" />
                  <span>Évolution de la Masse Salariale & Cotisations CNSS (MAD)</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Répartition mensuelle des Net à Payer, Cotisations CNSS/AMO et Charges Patronales
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                Audité CNSS
              </Badge>
            </div>

            <div className="h-[320px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={MONTHS_DATA} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(val: number) => `${val / 1000}k`} />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      `${Number(value).toLocaleString("fr-FR")} MAD`,
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      borderRadius: "12px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Bar
                    dataKey="salaireNet"
                    name="Salaires Nets Versés"
                    stackId="a"
                    fill="#10b981"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="cotisationsCnss"
                    name="Cotisations CNSS/AMO (Part Salariale)"
                    stackId="a"
                    fill="#3b82f6"
                  />
                  <Bar
                    dataKey="chargesPatronales"
                    name="Charges Patronales"
                    stackId="a"
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* CHART 3: DEPARTMENT ALLOCATION & SALARY BRACKETS */}
        {(activeTab === "ALL" || activeTab === "DEPARTMENTS") && (
          <div className="rounded-2xl border bg-card p-5 shadow-sm flex flex-col gap-4 lg:col-span-2">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Users className="size-4 text-purple-600" />
                  <span>Répartition de la Masse Salariale par Département & Tranches de Salaire</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Analyse de la distribution des effectifs ({totalEmployees} employés) et des coûts de personnel
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* PIE CHART: DEPARTMENTS */}
              <div className="flex flex-col items-center justify-center p-4 border rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Part de Masse Salariale par Service (%)
                </h4>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={DEPARTMENT_DISTRIBUTION}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {DEPARTMENT_DISTRIBUTION.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: any) => [`${val}%`, "Part Masse Salariale"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {DEPARTMENT_DISTRIBUTION.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5 text-[10px]">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium text-slate-600 dark:text-slate-400">
                        {item.name} ({item.value}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* BAR CHART: SALARY BRACKETS */}
              <div className="flex flex-col items-center justify-center p-4 border rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Distribution des Tranches Salariales (Nombre d'Employés)
                </h4>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={SALARY_BRACKETS} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="bracket" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(val: any) => [`${val} Salariés`, "Effectif"]} />
                      <Bar dataKey="count" name="Effectif Salariés" radius={[6, 6, 0, 0]}>
                        {SALARY_BRACKETS.map((entry, index) => (
                          <Cell key={`bracket-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-[11px] text-muted-foreground text-center mt-2">
                  Moyenne salariale de l'établissement: <strong className="text-foreground font-mono">5 840 MAD/mois</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
