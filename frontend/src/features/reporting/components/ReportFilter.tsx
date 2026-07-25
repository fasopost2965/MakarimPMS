import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Filter, Search, RotateCcw, Check } from "lucide-react";
import { DEPARTMENTS } from "../constants";

export interface FilterState {
  dateDebut: string;
  dateFin: string;
  departments: string[];
  search: string;
  preset: string;
}

interface ReportFilterProps {
  initialFilter?: Partial<FilterState>;
  onFilterChange: (filters: FilterState) => void;
  showDepartments?: boolean;
  showSearch?: boolean;
}

function getFormattedDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPresetRange(preset: string): [string, string] {
  const now = new Date();
  if (preset === "today") {
    const s = getFormattedDate(now);
    return [s, s];
  }
  if (preset === "yesterday") {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const s = getFormattedDate(y);
    return [s, s];
  }
  if (preset === "last_30") {
    const s = new Date();
    s.setDate(now.getDate() - 30);
    return [getFormattedDate(s), getFormattedDate(now)];
  }
  if (preset === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return [getFormattedDate(start), getFormattedDate(end)];
  }
  if (preset === "this_year") {
    const start = new Date(now.getFullYear(), 0, 1);
    return [getFormattedDate(start), getFormattedDate(now)];
  }
  // default: this_month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return [getFormattedDate(start), getFormattedDate(now)];
}

export function ReportFilter({
  initialFilter,
  onFilterChange,
  showDepartments = true,
  showSearch = true,
}: ReportFilterProps) {
  const defaultDates = getPresetRange("this_month");
  const [preset, setPreset] = useState<string>(initialFilter?.preset || "this_month");
  const [dateDebut, setDateDebut] = useState<string>(
    initialFilter?.dateDebut || defaultDates[0],
  );
  const [dateFin, setDateFin] = useState<string>(
    initialFilter?.dateFin || defaultDates[1],
  );
  const [selectedDepts, setSelectedDepts] = useState<string[]>(
    initialFilter?.departments || DEPARTMENTS.map((d) => d.id),
  );
  const [search, setSearch] = useState<string>(initialFilter?.search || "");

  const triggerChange = (
    newPreset: string,
    newDebut: string,
    newFin: string,
    newDepts: string[],
    newSearch: string,
  ) => {
    onFilterChange({
      preset: newPreset,
      dateDebut: newDebut,
      dateFin: newFin,
      departments: newDepts,
      search: newSearch,
    });
  };

  const handlePresetClick = (pId: string) => {
    setPreset(pId);
    if (pId !== "custom") {
      const [start, end] = getPresetRange(pId);
      setDateDebut(start);
      setDateFin(end);
      triggerChange(pId, start, end, selectedDepts, search);
    }
  };

  const toggleDept = (dId: string) => {
    let next: string[];
    if (selectedDepts.includes(dId)) {
      next = selectedDepts.filter((id) => id !== dId);
    } else {
      next = [...selectedDepts, dId];
    }
    setSelectedDepts(next);
    triggerChange(preset, dateDebut, dateFin, next, search);
  };

  const selectAllDepts = () => {
    const all = DEPARTMENTS.map((d) => d.id);
    setSelectedDepts(all);
    triggerChange(preset, dateDebut, dateFin, all, search);
  };

  const resetFilters = () => {
    const [start, end] = getPresetRange("this_month");
    const allDepts = DEPARTMENTS.map((d) => d.id);
    setPreset("this_month");
    setDateDebut(start);
    setDateFin(end);
    setSelectedDepts(allDepts);
    setSearch("");
    triggerChange("this_month", start, end, allDepts, "");
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4 print:hidden">
      {/* Top Row: Presets & Date Inputs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Preset Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-primary" /> Période :
          </span>
          {[
            { id: "today", label: "Aujourd'hui" },
            { id: "yesterday", label: "Hier" },
            { id: "this_month", label: "Ce mois" },
            { id: "last_month", label: "Mois dernier" },
            { id: "last_30", label: "30 jours" },
            { id: "this_year", label: "Année" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => handlePresetClick(p.id)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                preset === p.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Pickers */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="rf-start" className="text-xs text-slate-500 font-medium">
              Du
            </Label>
            <Input
              id="rf-start"
              type="date"
              value={dateDebut}
              className="h-8 text-xs w-32 bg-slate-50 border-slate-200"
              onChange={(e) => {
                setPreset("custom");
                setDateDebut(e.target.value);
                triggerChange("custom", e.target.value, dateFin, selectedDepts, search);
              }}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Label htmlFor="rf-end" className="text-xs text-slate-500 font-medium">
              Au
            </Label>
            <Input
              id="rf-end"
              type="date"
              value={dateFin}
              className="h-8 text-xs w-32 bg-slate-50 border-slate-200"
              onChange={(e) => {
                setPreset("custom");
                setDateFin(e.target.value);
                triggerChange("custom", dateDebut, e.target.value, selectedDepts, search);
              }}
            />
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-slate-500 hover:text-slate-900 gap-1 px-2"
            onClick={resetFilters}
            title="Réinitialiser les filtres"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Réinit.
          </Button>
        </div>
      </div>

      {/* Middle Row: Multi-Department Selector */}
      {showDepartments && (
        <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-primary" /> Départements :
            </span>
            {DEPARTMENTS.map((dept) => {
              const isSelected = selectedDepts.includes(dept.id);
              return (
                <button
                  key={dept.id}
                  onClick={() => toggleDept(dept.id)}
                  className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-md border transition-all flex items-center gap-1 ${
                    isSelected
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 text-primary" />}
                  {dept.label}
                </button>
              );
            })}
          </div>

          {selectedDepts.length < DEPARTMENTS.length && (
            <button
              onClick={selectAllDepts}
              className="text-[11px] font-bold text-primary hover:underline shrink-0"
            >
              Tout sélectionner
            </button>
          )}
        </div>
      )}

      {/* Bottom Row: Custom Search */}
      {showSearch && (
        <div className="relative pt-1">
          <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
          <Input
            type="text"
            placeholder="Rechercher par nom de client, numéro de chambre, référence..."
            value={search}
            className="pl-9 h-8 text-xs bg-slate-50 border-slate-200"
            onChange={(e) => {
              setSearch(e.target.value);
              triggerChange(preset, dateDebut, dateFin, selectedDepts, e.target.value);
            }}
          />
        </div>
      )}
    </div>
  );
}
