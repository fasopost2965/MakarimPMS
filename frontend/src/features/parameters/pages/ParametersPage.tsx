import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  Percent,
  CalendarRange,
  Plus,
  Trash2,
  Settings,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import {
  getHotelConfig,
  updateHotelConfig,
  getTaxRates,
  updateTaxRate,
  getSeasonRates,
  createSeasonRate,
  deleteSeasonRate,
} from "../api";
import { listRooms } from "@/features/reservations/api";
import type { HotelConfig, TaxRateConfig, SeasonRate } from "../types";
import type { Room } from "@/features/reservations/types";

export function ParametersPage() {
  const [activeSubTab, setActiveSubTab] = useState<"hotel" | "taxes" | "seasons">("hotel");

  // State
  const [hotelConfig, setHotelConfig] = useState<HotelConfig | null>(null);
  const [taxRates, setTaxRates] = useState<TaxRateConfig[]>([]);
  const [seasonRates, setSeasonRates] = useState<SeasonRate[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editing state
  const [savingHotel, setSavingHotel] = useState(false);
  const [hotelSuccess, setHotelSuccess] = useState(false);
  const [editingTaxId, setEditingTaxId] = useState<number | null>(null);
  const [editingTaxValue, setEditingTaxValue] = useState("");
  const [savingTax, setSavingTax] = useState(false);

  // New Season Rate State
  const [newSeasonLabel, setNewSeasonLabel] = useState("");
  const [newSeasonStart, setNewSeasonStart] = useState("");
  const [newSeasonEnd, setNewSeasonEnd] = useState("");
  const [newSeasonPrice, setNewSeasonPrice] = useState("");
  const [newSeasonRoomTypeId, setNewSeasonRoomTypeId] = useState("");
  const [creatingSeason, setCreatingSeason] = useState(false);
  const [seasonError, setSeasonError] = useState<string | null>(null);

  useEffect(() => {
    void loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    setError(null);
    try {
      const [config, taxes, seasons, roomsData] = await Promise.all([
        getHotelConfig(),
        getTaxRates(),
        getSeasonRates(),
        listRooms(),
      ]);
      setHotelConfig(config);
      setTaxRates(taxes);
      setSeasonRates(seasons);
      setRooms(roomsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du chargement des paramètres");
    } finally {
      setLoading(false);
    }
  }

  // Get unique room types
  const uniqueRoomTypes = Array.from(
    new Map(rooms.map((r) => [r.roomType.id, r.roomType])).values()
  );

  async function handleUpdateHotel(e: React.FormEvent) {
    e.preventDefault();
    if (!hotelConfig) return;
    setSavingHotel(true);
    setHotelSuccess(false);
    setError(null);
    try {
      const updated = await updateHotelConfig({
        raisonSociale: hotelConfig.raisonSociale,
        ice: hotelConfig.ice,
        identifiantFiscal: hotelConfig.identifiantFiscal,
        rc: hotelConfig.rc,
        adresse: hotelConfig.adresse,
        categorieEtoiles: Number(hotelConfig.categorieEtoiles),
      });
      setHotelConfig(updated);
      setHotelSuccess(true);
      setTimeout(() => setHotelSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'enregistrement");
    } finally {
      setSavingHotel(false);
    }
  }

  async function handleSaveTax(id: number) {
    const val = Number(editingTaxValue);
    if (isNaN(val) || val < 0 || val > 100) {
      alert("Le taux doit être compris entre 0 et 100%");
      return;
    }
    setSavingTax(true);
    setError(null);
    try {
      await updateTaxRate(id, val);
      setTaxRates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, taux: val } : t))
      );
      setEditingTaxId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de mise à jour");
    } finally {
      setSavingTax(false);
    }
  }

  async function handleCreateSeason(e: React.FormEvent) {
    e.preventDefault();
    setSeasonError(null);
    if (!newSeasonLabel || !newSeasonStart || !newSeasonEnd || !newSeasonPrice || !newSeasonRoomTypeId) {
      setSeasonError("Tous les champs sont requis");
      return;
    }
    setCreatingSeason(true);
    try {
      const created = await createSeasonRate({
        libelle: newSeasonLabel,
        dateDebut: newSeasonStart,
        dateFin: newSeasonEnd,
        prixNuit: Number(newSeasonPrice),
        roomTypeId: Number(newSeasonRoomTypeId),
      });
      setSeasonRates((prev) => [...prev, created]);
      // Reset form
      setNewSeasonLabel("");
      setNewSeasonStart("");
      setNewSeasonEnd("");
      setNewSeasonPrice("");
      setNewSeasonRoomTypeId("");
    } catch (err) {
      setSeasonError(err instanceof Error ? err.message : "Erreur de création");
    } finally {
      setCreatingSeason(false);
    }
  }

  async function handleDeleteSeason(id: number) {
    if (!confirm("Voulez-vous vraiment supprimer ce tarif saisonnier ?")) return;
    try {
      await deleteSeasonRate(id);
      setSeasonRates((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur de suppression");
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground text-sm">
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Chargement des paramètres...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Header section */}
      <div className="flex flex-col gap-1 border-b pb-4 text-left">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-serif font-bold text-foreground">
            Paramètres Généraux & Tarifs
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Configurez l'identité fiscale de l'Hôtel Makarim, gérez la grille de TVA et de taxe de séjour, et administrez la grille tarifaire saisonnière dynamique.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive text-xs flex items-center gap-2 text-left">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs list */}
      <div className="flex items-center gap-2 border-b">
        <button
          type="button"
          onClick={() => setActiveSubTab("hotel")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeSubTab === "hotel"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building className="h-3.5 w-3.5" />
          Identité Établissement
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("taxes")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeSubTab === "taxes"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Percent className="h-3.5 w-3.5" />
          TVA & Taxes
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("seasons")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeSubTab === "seasons"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <CalendarRange className="h-3.5 w-3.5" />
          Grille Saisonnière
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-auto">
        {/* Panel 1: Hotel Identity */}
        {activeSubTab === "hotel" && hotelConfig && (
          <form onSubmit={handleUpdateHotel} className="max-w-2xl text-left bg-card rounded-2xl border p-6 shadow-xs flex flex-col gap-5">
            <div className="flex items-center gap-2.5 border-b pb-3">
              <Building className="h-4.5 w-4.5 text-primary" />
              <h3 className="font-serif text-base font-bold text-foreground">
                Informations Légales & Fiscales
              </h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="raisonSociale" className="text-xs font-bold text-muted-foreground uppercase">
                  Raison Sociale
                </Label>
                <Input
                  id="raisonSociale"
                  value={hotelConfig.raisonSociale}
                  onChange={(e) => setHotelConfig({ ...hotelConfig, raisonSociale: e.target.value })}
                  required
                  className="h-9.5 text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="categorieEtoiles" className="text-xs font-bold text-muted-foreground uppercase">
                  Classification (Étoiles)
                </Label>
                <Input
                  id="categorieEtoiles"
                  type="number"
                  min="1"
                  max="5"
                  value={hotelConfig.categorieEtoiles}
                  onChange={(e) => setHotelConfig({ ...hotelConfig, categorieEtoiles: Number(e.target.value) })}
                  required
                  className="h-9.5 text-xs font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ice" className="text-xs font-bold text-muted-foreground uppercase">
                  Identifiant Commun de l'Entreprise (ICE)
                </Label>
                <Input
                  id="ice"
                  value={hotelConfig.ice}
                  onChange={(e) => setHotelConfig({ ...hotelConfig, ice: e.target.value })}
                  required
                  className="h-9.5 text-xs font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="identifiantFiscal" className="text-xs font-bold text-muted-foreground uppercase">
                  Identifiant Fiscal (IF)
                </Label>
                <Input
                  id="identifiantFiscal"
                  value={hotelConfig.identifiantFiscal}
                  onChange={(e) => setHotelConfig({ ...hotelConfig, identifiantFiscal: e.target.value })}
                  required
                  className="h-9.5 text-xs font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rc" className="text-xs font-bold text-muted-foreground uppercase">
                  Registre du Commerce (RC)
                </Label>
                <Input
                  id="rc"
                  value={hotelConfig.rc}
                  onChange={(e) => setHotelConfig({ ...hotelConfig, rc: e.target.value })}
                  required
                  className="h-9.5 text-xs font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="adresse" className="text-xs font-bold text-muted-foreground uppercase">
                  Adresse de l'établissement
                </Label>
                <Input
                  id="adresse"
                  value={hotelConfig.adresse}
                  onChange={(e) => setHotelConfig({ ...hotelConfig, adresse: e.target.value })}
                  required
                  className="h-9.5 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4 mt-2">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <HelpCircle className="h-3 w-3" />
                Ces données apparaîtront automatiquement sur l'ensemble de vos folios et reçus d'hébergement.
              </span>

              <div className="flex items-center gap-3">
                {hotelSuccess && (
                  <span className="text-emerald-500 text-xs font-bold flex items-center gap-1 animate-fade-in">
                    <Check className="h-4 w-4" />
                    Enregistré !
                  </span>
                )}
                <Button type="submit" disabled={savingHotel} className="h-9 text-xs font-bold shadow-xs">
                  {savingHotel ? "Enregistrement..." : "Sauvegarder"}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Panel 2: Taxes */}
        {activeSubTab === "taxes" && (
          <div className="max-w-xl text-left bg-card rounded-2xl border p-6 shadow-xs flex flex-col gap-5">
            <div className="flex items-center gap-2.5 border-b pb-3">
              <Percent className="h-4.5 w-4.5 text-primary" />
              <h3 className="font-serif text-base font-bold text-foreground">
                Taux de Taxes Applicables (TVA & Taxes de séjour)
              </h3>
            </div>

            <div className="flex flex-col gap-4">
              {taxRates.map((tax) => {
                const isEditing = editingTaxId === tax.id;
                let cleanLabel = "";
                let taxUnit = "%";
                if (tax.type === "TVA_HEBERGEMENT") {
                  cleanLabel = "TVA Hébergement standard";
                } else if (tax.type === "TVA_ANNEXE") {
                  cleanLabel = "TVA sur Extras / Restauration / Services";
                } else if (tax.type === "TAXE_SEJOUR") {
                  cleanLabel = "Taxe de séjour communale";
                  taxUnit = " MAD / Nuitée / Client";
                }

                return (
                  <div
                    key={tax.id}
                    className="rounded-xl border p-4.5 bg-background hover:border-primary/20 transition-all flex items-center justify-between gap-4"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">{tax.type}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{cleanLabel}</p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={editingTaxValue}
                            onChange={(e) => setEditingTaxValue(e.target.value)}
                            className="h-8.5 w-20 text-xs text-center font-mono"
                          />
                          <span className="text-xs font-bold text-muted-foreground">{taxUnit}</span>
                          <Button
                            size="sm"
                            className="h-8.5 w-8.5 p-0 bg-primary hover:bg-primary/95 text-primary-foreground shrink-0 shadow-2xs"
                            onClick={() => void handleSaveTax(tax.id)}
                            disabled={savingTax}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="font-mono text-xs px-2.5 py-0.5 h-6">
                            {tax.taux}
                            {taxUnit}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold"
                            onClick={() => {
                              setEditingTaxId(tax.id);
                              setEditingTaxValue(String(tax.taux));
                            }}
                          >
                            Modifier
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Panel 3: Seasonal rates */}
        {activeSubTab === "seasons" && (
          <div className="grid gap-6 lg:grid-cols-12 items-start text-left">
            {/* Left Column: List of existing seasonal rates */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="bg-card rounded-2xl border p-5 shadow-xs flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b pb-3">
                  <CalendarRange className="h-4.5 w-4.5 text-primary" />
                  <h3 className="font-serif text-base font-bold text-foreground">
                    Tarifs de Saison Actifs ({seasonRates.length})
                  </h3>
                </div>

                {seasonRates.length === 0 ? (
                  <div className="text-center py-12 border border-dashed rounded-xl">
                    <CalendarRange className="h-8 w-8 text-muted-foreground opacity-35 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-muted-foreground">Aucun tarif saisonnier configuré</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">La tarification appliquera le prix de base de chaque type de chambre.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 max-h-[480px] overflow-auto pr-1">
                    {seasonRates.map((rate) => {
                      const roomType = uniqueRoomTypes.find((rt) => rt.id === rate.roomTypeId);
                      const startStr = new Date(rate.dateDebut).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      });
                      const endStr = new Date(rate.dateFin).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      });

                      return (
                        <div
                          key={rate.id}
                          className="rounded-xl border p-4 bg-background flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-primary/20 transition-all text-xs"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-foreground">{rate.libelle}</span>
                              <Badge variant="outline" className="text-[9px] uppercase font-bold py-0 h-4 border-amber-500/20 bg-amber-500/5 text-amber-600">
                                {roomType?.nom || `RoomType ID ${rate.roomTypeId}`}
                              </Badge>
                            </div>
                            <span className="text-muted-foreground text-[11px] font-medium font-mono">
                              Du {startStr} au {endStr}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                            <span className="font-mono font-bold text-primary text-sm">{rate.prixNuit} MAD <span className="text-[10px] font-normal text-muted-foreground">/ nuit</span></span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg"
                              onClick={() => void handleDeleteSeason(rate.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Form to create a season rate */}
            <div className="lg:col-span-5">
              <form onSubmit={handleCreateSeason} className="bg-card rounded-2xl border p-5 shadow-xs flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b pb-3">
                  <Plus className="h-4.5 w-4.5 text-primary" />
                  <h3 className="font-serif text-base font-bold text-foreground">
                    Ajouter un Tarif de Saison
                  </h3>
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="seasonLabel" className="text-[10px] font-bold text-muted-foreground uppercase">
                    Libellé de la saison / de l'offre
                  </Label>
                  <Input
                    id="seasonLabel"
                    value={newSeasonLabel}
                    onChange={(e) => setNewSeasonLabel(e.target.value)}
                    placeholder="Ex: Haute saison été, Offre Aid..."
                    required
                    className="h-9 text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="seasonRoomType" className="text-[10px] font-bold text-muted-foreground uppercase">
                    Type de chambre concerné
                  </Label>
                  <select
                    id="seasonRoomType"
                    value={newSeasonRoomTypeId}
                    onChange={(e) => setNewSeasonRoomTypeId(e.target.value)}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Sélectionnez un type...</option>
                    {uniqueRoomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.nom} (Base : {rt.prixBase} MAD)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="seasonStart" className="text-[10px] font-bold text-muted-foreground uppercase">
                      Date de début
                    </Label>
                    <Input
                      id="seasonStart"
                      type="date"
                      value={newSeasonStart}
                      onChange={(e) => setNewSeasonStart(e.target.value)}
                      required
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="seasonEnd" className="text-[10px] font-bold text-muted-foreground uppercase">
                      Date de fin
                    </Label>
                    <Input
                      id="seasonEnd"
                      type="date"
                      value={newSeasonEnd}
                      onChange={(e) => setNewSeasonEnd(e.target.value)}
                      required
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="seasonPrice" className="text-[10px] font-bold text-muted-foreground uppercase">
                    Prix de la nuitée (MAD)
                  </Label>
                  <div className="relative">
                    <Input
                      id="seasonPrice"
                      type="number"
                      min="1"
                      step="0.01"
                      value={newSeasonPrice}
                      onChange={(e) => setNewSeasonPrice(e.target.value)}
                      placeholder="Ex: 850"
                      required
                      className="h-9 text-xs font-mono pr-12"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] font-bold text-muted-foreground">MAD</span>
                  </div>
                </div>

                {seasonError && (
                  <p className="text-destructive font-semibold text-[11px] leading-tight flex items-start gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                    <span>{seasonError}</span>
                  </p>
                )}

                <Button type="submit" disabled={creatingSeason} className="h-9 text-xs font-bold shadow-2xs mt-1 w-full gap-1">
                  {creatingSeason ? "Création..." : "+ Ajouter à la grille"}
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
