import { useEffect, useMemo, useState } from "react";
import { Globe, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { searchGuests } from "../api";
import type { Guest } from "../types";

const ALL_NATIONALITIES = [
  "Marocaine",
  "Ivoirienne",
  "Française",
  "Espagnole",
  "Sénégalaise",
  "Algérienne",
  "Tunisienne",
  "Américaine",
  "Canadienne",
  "Britannique",
  "Allemande",
  "Italienne",
  "Belge",
  "Suisse",
  "Saoudienne",
  "Émiratie",
  "Koweïtienne",
  "Égyptienne",
  "Mauritanienne",
  "Malienne",
  "Guinéenne",
  "Camerounaise",
  "Gabonaise",
  "Congolaise",
  "Chinoise",
  "Japonaise",
  "Turque",
  "Néerlandaise",
  "Portugaise",
  "Russe",
  "Brésilienne",
  "Indienne",
  "Pakistanaise",
  "Autre",
].sort((a, b) => a.localeCompare(b, "fr"));

const DEFAULT_FREQUENT = [
  "Marocaine",
  "Ivoirienne",
  "Française",
  "Espagnole",
  "Sénégalaise",
  "Algérienne",
  "Américaine",
];

interface Props {
  value: string;
  onChange: (val: string) => void;
  id?: string;
  guests?: Guest[];
}

export function NationalitySelect({
  value,
  onChange,
  id = "guest-nat",
  guests: initialGuests,
}: Props) {
  const [guests, setGuests] = useState<Guest[]>(initialGuests || []);
  const [isCustom, setIsCustom] = useState(false);
  const [customVal, setCustomVal] = useState("");

  useEffect(() => {
    if (!initialGuests || initialGuests.length === 0) {
      searchGuests()
        .then((data) => setGuests(data))
        .catch(() => {});
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGuests(initialGuests);
    }
  }, [initialGuests]);

  // Compute frequent nationalities from real CRM usage
  const topNationalities = useMemo(() => {
    if (!guests || guests.length === 0) return DEFAULT_FREQUENT;

    const counts: Record<string, number> = {};
    for (const g of guests) {
      if (g.nationalite && g.nationalite.trim()) {
        const nat = g.nationalite.trim();
        counts[nat] = (counts[nat] || 0) + 1;
      }
    }

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([nat]) => nat);

    if (sorted.length === 0) return DEFAULT_FREQUENT;

    // Fill up to 7 with default list if needed
    const result = [...sorted];
    for (const def of DEFAULT_FREQUENT) {
      if (!result.includes(def) && result.length < 8) {
        result.push(def);
      }
    }

    return result.slice(0, 8);
  }, [guests]);

  // Check if value is in dropdown
  const isInList = ALL_NATIONALITIES.includes(value);

  function handleSelectChange(val: string) {
    if (val === "CUSTOM") {
      setIsCustom(true);
      setCustomVal("");
    } else {
      setIsCustom(false);
      onChange(val);
    }
  }

  function handleCustomBlur() {
    if (customVal.trim()) {
      onChange(customVal.trim());
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label
        htmlFor={id}
        className="font-bold text-xs flex items-center justify-between"
      >
        <span className="flex items-center gap-1.5">
          <Globe className="size-3.5 text-emerald-600" />
          <span>Nationalité</span>
        </span>
        {topNationalities.length > 0 && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-normal">
            <Sparkles className="size-3 text-amber-500" />
            <span>Top selon fréquence d'usage</span>
          </span>
        )}
      </Label>

      {/* DROPDOWN SELECT */}
      {isCustom ? (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            value={customVal}
            onChange={(e) => {
              setCustomVal(e.target.value);
              onChange(e.target.value);
            }}
            onBlur={handleCustomBlur}
            placeholder="Saisissez la nationalité…"
            className="bg-background h-9 text-xs"
          />
          <button
            type="button"
            onClick={() => {
              setIsCustom(false);
              onChange(ALL_NATIONALITIES[0]);
            }}
            className="text-[11px] text-primary hover:underline shrink-0"
          >
            Liste
          </button>
        </div>
      ) : (
        <Select
          value={isInList ? value : value ? "CUSTOM" : "Marocaine"}
          onValueChange={(val) => val && handleSelectChange(val)}
        >
          <SelectTrigger id={id} className="h-9 text-xs bg-background">
            <SelectValue placeholder="Sélectionner une nationalité…" />
          </SelectTrigger>
          <SelectContent className="max-h-60 overflow-y-auto text-xs">
            {ALL_NATIONALITIES.map((nat) => (
              <SelectItem key={nat} value={nat} className="text-xs">
                {nat}
              </SelectItem>
            ))}
            <SelectItem
              value="CUSTOM"
              className="text-xs font-semibold text-primary"
            >
              + Autre nationalité (Saisie libre)…
            </SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* QUICK FREQUENT SUGGESTION CHIPS */}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {topNationalities.map((nat) => {
          const isSelected = value === nat;
          return (
            <button
              key={nat}
              type="button"
              onClick={() => {
                setIsCustom(false);
                onChange(nat);
              }}
              className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                isSelected
                  ? "bg-emerald-100 text-emerald-900 border-emerald-400 font-extrabold dark:bg-emerald-950 dark:text-emerald-200 shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{nat}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
