import { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MonthlyTrend {
  month: string;
  revenue: number;
  occupancy: number;
  reservations: number;
}

const mockTrendData: MonthlyTrend[] = [
  { month: "Jan", revenue: 145000, occupancy: 62, reservations: 120 },
  { month: "Fév", revenue: 162000, occupancy: 68, reservations: 135 },
  { month: "Mar", revenue: 198000, occupancy: 76, reservations: 160 },
  { month: "Avr", revenue: 220000, occupancy: 82, reservations: 185 },
  { month: "Mai", revenue: 245000, occupancy: 88, reservations: 210 },
  { month: "Juin", revenue: 270000, occupancy: 91, reservations: 235 },
  { month: "Juil", revenue: 310000, occupancy: 95, reservations: 270 },
  { month: "Aoû", revenue: 325000, occupancy: 98, reservations: 285 },
  { month: "Sep", revenue: 250000, occupancy: 85, reservations: 215 },
  { month: "Oct", revenue: 210000, occupancy: 78, reservations: 175 },
  { month: "Nov", revenue: 175000, occupancy: 70, reservations: 145 },
  { month: "Déc", revenue: 230000, occupancy: 84, reservations: 195 },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-popover p-3 shadow-md text-popover-foreground text-xs space-y-1">
        <p className="font-semibold border-b pb-1 mb-1.5">{label} 2026</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}:
            </span>
            <span className="font-bold">
              {entry.dataKey === "revenue"
                ? `${entry.value.toLocaleString("fr-MA")} MAD`
                : entry.dataKey === "occupancy"
                  ? `${entry.value}%`
                  : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export function BookingTrendsChart() {
  const [viewMode, setViewMode] = useState<
    "combined" | "revenue" | "occupancy"
  >("combined");

  // Calculate annual highlights
  const totalRevenue = mockTrendData.reduce(
    (acc, curr) => acc + curr.revenue,
    0,
  );
  const avgOccupancy = Math.round(
    mockTrendData.reduce((acc, curr) => acc + curr.occupancy, 0) /
      mockTrendData.length,
  );
  const totalReservations = mockTrendData.reduce(
    (acc, curr) => acc + curr.reservations,
    0,
  );

  return (
    <div className="rounded-lg border bg-card p-5 shadow-xs flex flex-col gap-4">
      {/* HEADER & TOGGLES */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" />
            <h3 className="text-base font-bold tracking-tight">
              Tendances des Réservations & Revenue
            </h3>
          </div>
          <p className="text-muted-foreground text-xs">
            Évolution mensuelle du chiffre d'affaires et du taux d'occupation
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-md border">
          <Button
            type="button"
            variant={viewMode === "combined" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("combined")}
            className="text-xs h-7 px-2.5"
          >
            Vue Combinée
          </Button>
          <Button
            type="button"
            variant={viewMode === "revenue" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("revenue")}
            className="text-xs h-7 px-2.5"
          >
            Revenus (MAD)
          </Button>
          <Button
            type="button"
            variant={viewMode === "occupancy" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("occupancy")}
            className="text-xs h-7 px-2.5"
          >
            Occupation (%)
          </Button>
        </div>
      </div>

      {/* HIGHLIGHT METRICS STRIP */}
      <div className="grid grid-cols-3 gap-3 bg-muted/30 p-3 rounded-md border text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground font-medium">
            CA Annuel Cumulé
          </span>
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            {totalRevenue.toLocaleString("fr-MA")} MAD
            <ArrowUpRight className="size-3.5 text-emerald-600" />
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground font-medium">
            Occupation Moyenne
          </span>
          <p className="text-sm font-bold text-primary flex items-center gap-1">
            {avgOccupancy}%
            <Badge
              variant="outline"
              className="text-[10px] px-1 py-0 font-normal"
            >
              Objectif: 75%
            </Badge>
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground font-medium">
            Volume Réservations
          </span>
          <p className="text-sm font-bold text-foreground">
            {totalReservations} nuits vendues
          </p>
        </div>
      </div>

      {/* RECHARTS VISUALIZATION */}
      <div className="w-full h-64 sm:h-72 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === "combined" ? (
            <BarChart
              data={mockTrendData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="stroke-border/40"
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                className="text-[11px] fill-muted-foreground"
              />
              <YAxis
                yAxisId="left"
                axisLine={false}
                tickLine={false}
                className="text-[10px] fill-muted-foreground"
                tickFormatter={(val) => `${val / 1000}k`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                className="text-[10px] fill-muted-foreground"
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: "10px", fontSize: "11px" }}
              />
              <Bar
                yAxisId="left"
                dataKey="revenue"
                name="Revenu (MAD)"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                opacity={0.85}
              />
              <Bar
                yAxisId="right"
                dataKey="occupancy"
                name="Taux Occupation (%)"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                opacity={0.75}
              />
            </BarChart>
          ) : viewMode === "revenue" ? (
            <AreaChart
              data={mockTrendData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="stroke-border/40"
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                className="text-[11px] fill-muted-foreground"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                className="text-[10px] fill-muted-foreground"
                tickFormatter={(val) => `${val / 1000}k MAD`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenu (MAD)"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#revenueGrad)"
              />
            </AreaChart>
          ) : (
            <AreaChart
              data={mockTrendData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0.0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="stroke-border/40"
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                className="text-[11px] fill-muted-foreground"
              />
              <YAxis
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                className="text-[10px] fill-muted-foreground"
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="occupancy"
                name="Taux Occupation (%)"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#occGrad)"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
