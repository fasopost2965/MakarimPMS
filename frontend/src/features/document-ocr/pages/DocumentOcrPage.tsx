import { useState } from "react";
import {
  ScanLine,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  UserPlus,
  Camera,
  Sparkles,
  RefreshCw,
  FileText,
  Users,
  History,
  Calendar,
  CreditCard,
  Globe,
  ArrowRight,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { FormField } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { scanDocument } from "../api";
import type { DocumentOcrResult, TypeDocumentScan } from "../types";
import {
  SPECIMENS,
  generateSpecimenFile,
  type SpecimenDoc,
} from "../utils/specimenGenerator";
import { CameraCaptureDialog } from "../components/CameraCaptureDialog";

// Guest Integration
import { createGuest, searchGuests } from "@/features/guests/api";
import type { CreateGuestInput, Guest } from "@/features/guests/types";
import { CreateGuestDialog } from "@/features/guests/components/CreateGuestDialog";
import { AssignScanDialog } from "../components/AssignScanDialog";

const AUTO = "__AUTO__";

interface ScannedHistoryItem {
  id: string;
  timestamp: string;
  filename: string;
  result: DocumentOcrResult;
  previewUrl: string;
}

export function DocumentOcrPage() {
  const [fichier, setFichier] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [typeDocument, setTypeDocument] = useState<string>(AUTO);
  const [result, setResult] = useState<DocumentOcrResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBrut, setShowBrut] = useState(false);

  // Copy Feedback state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Camera Dialog
  const [cameraOpen, setCameraOpen] = useState(false);

  // Session History (last 5 scans)
  const [history, setHistory] = useState<ScannedHistoryItem[]>([]);

  // PMS Matching Guest State
  const [matchingGuest, setMatchingGuest] = useState<Guest | null>(null);
  const [checkingGuest, setCheckingGuest] = useState(false);

  // Create Guest Dialog State
  const [createGuestOpen, setCreateGuestOpen] = useState(false);
  const [creatingGuest, setCreatingGuest] = useState(false);
  const [createGuestError, setCreateGuestError] = useState<string | null>(null);

  // Assign Scan to Existing Reservation/Guest Dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  function handleFileChange(f: File | null) {
    setFichier(f);
    setResult(null);
    setError(null);
    setMatchingGuest(null);
    if (previewUrl && !previewUrl.startsWith("blob:specimen")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  async function handleScan(fileToScan?: File) {
    const targetFile = fileToScan || fichier;
    if (!targetFile) return;

    setLoading(true);
    setError(null);
    setMatchingGuest(null);

    try {
      const res = await scanDocument(
        targetFile,
        typeDocument === AUTO ? undefined : (typeDocument as TypeDocumentScan),
      );
      setResult(res);

      // Add to session history
      const newUrl = URL.createObjectURL(targetFile);
      const historyItem: ScannedHistoryItem = {
        // eslint-disable-next-line react-hooks/purity
        id: `scan-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        filename: targetFile.name,
        result: res,
        previewUrl: newUrl,
      };

      setHistory((prev) => [historyItem, ...prev.slice(0, 4)]);

      // Auto-check if guest already exists in PMS database by doc number
      if (res.numeroPiece) {
        void checkForExistingGuest(res.numeroPiece);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'analyse OCR");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadSpecimen(specimen: SpecimenDoc) {
    try {
      setLoading(true);
      setError(null);
      const specimenFile = await generateSpecimenFile(specimen);
      setFichier(specimenFile);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(specimenFile));

      // Direct trigger scan
      await handleScan(specimenFile);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur génération spécimen",
      );
    } finally {
      setLoading(false);
    }
  }

  async function checkForExistingGuest(docNum: string) {
    setCheckingGuest(true);
    try {
      const existing = await searchGuests(docNum);
      const match = existing.find(
        (g) => (g.pieceIdentite || "").toLowerCase() === docNum.toLowerCase(),
      );
      setMatchingGuest(match || null);
    } catch {
      setMatchingGuest(null);
    } finally {
      setCheckingGuest(false);
    }
  }

  function handleCopyText(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function handleCopyAllData() {
    if (!result) return;
    const lines = [
      `Nom: ${result.nom || ""}`,
      `Prénom: ${result.prenom || ""}`,
      `N° Pièce: ${result.numeroPiece || ""}`,
      `Nationalité: ${result.nationalite || ""}`,
      `Date Naissance: ${result.dateNaissance || ""}`,
      `Sexe: ${result.sexe || ""}`,
      `Expiration: ${result.dateExpiration || ""}`,
    ].join("\n");

    handleCopyText(lines, "all");
  }

  async function handleCreateGuestConfirm(input: CreateGuestInput) {
    setCreatingGuest(true);
    setCreateGuestError(null);
    try {
      await createGuest(input);
      setCreateGuestOpen(false);
      if (result?.numeroPiece) {
        await checkForExistingGuest(result.numeroPiece);
      }
    } catch (err) {
      setCreateGuestError(
        err instanceof Error ? err.message : "Erreur création client",
      );
    } finally {
      setCreatingGuest(false);
    }
  }

  // Pre-filled CreateGuestInput derived from OCR
  const initialGuestData: Partial<CreateGuestInput> = {
    nom: result?.nom || "",
    prenom: result?.prenom || "",
    pieceIdentite: result?.numeroPiece || "",
    nationalite:
      result?.nationalite === "MAR"
        ? "Marocaine"
        : result?.nationalite || "Marocaine",
  };

  return (
    <div className="flex flex-col h-full bg-background p-4 sm:p-6 space-y-5 overflow-y-auto">
      {/* HEADER ENTRY & COMPLIANCE BANNER */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <ScanLine className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-black tracking-tight text-foreground">
                  Scan de Pièce d'Identité (OCR & MRZ)
                </h1>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 font-bold"
                >
                  ICAO 9303 / CIN Biométrique
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Extraction automatique des données d'identité depuis les zones
                MRZ (CIN Marocaine & Passeports).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] bg-muted/40 p-2 rounded-lg border border-border/60 shrink-0">
            <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
            <span className="text-muted-foreground">
              <strong>100% Confidentiel:</strong> Traitement en mémoire vive,
              aucune image conservée.
            </span>
          </div>
        </div>
      </div>

      {/* DEMO SPECIMEN QUICK LAUNCH BAR */}
      <div className="p-3.5 rounded-xl border border-border/80 bg-gradient-to-r from-card via-card to-muted/20 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-amber-500" />
            <span>Spécimens de Démonstration (Test en 1 Clic)</span>
          </span>
          <span className="text-[10px] text-muted-foreground">
            Sélectionnez une pièce type pour tester l'OCR instantanément
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {SPECIMENS.map((specimen) => (
            <button
              key={specimen.id}
              type="button"
              disabled={loading}
              onClick={() => void handleLoadSpecimen(specimen)}
              className="p-2.5 rounded-lg border border-border bg-background hover:bg-muted/50 hover:border-primary/40 text-left transition-all flex items-center justify-between group shadow-2xs"
            >
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                  {specimen.title}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {specimen.nom} {specimen.prenom} ({specimen.numero})
                </p>
              </div>
              <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKFLOW SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: FILE INPUT & SCAN CONTROLS */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="size-3.5 text-primary" />
                <span>Document à Scanner</span>
              </h2>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCameraOpen(true)}
                className="h-7 text-xs font-semibold gap-1 bg-background"
              >
                <Camera className="size-3.5 text-primary" />
                <span>Caméra / Webcam</span>
              </Button>
            </div>

            <FormField
              id="ocr-fichier"
              label="Fichier Image"
              hint="JPEG, PNG, WebP (8 Mo max)"
              className="w-full"
            >
              <FileUpload
                id="ocr-fichier"
                accept="image/jpeg,image/png,image/webp"
                value={fichier}
                onChange={handleFileChange}
              />
            </FormField>

            <div className="space-y-1.5">
              <Label
                htmlFor="ocr-type-document"
                className="text-xs font-semibold"
              >
                Format / Type de document attendu
              </Label>
              <Select
                value={typeDocument}
                onValueChange={(v) => v && setTypeDocument(v)}
                items={[
                  { value: AUTO, label: "Détection automatique (Recommandé)" },
                  { value: "CIN", label: "CIN Biométrique (Maroc / TD1)" },
                  {
                    value: "PASSEPORT",
                    label: "Passeport International (TD3)",
                  },
                ]}
              >
                <SelectTrigger
                  id="ocr-type-document"
                  size="sm"
                  className="w-full text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO}>
                    Détection automatique (Recommandé)
                  </SelectItem>
                  <SelectItem value="CIN">
                    CIN Biométrique (Maroc / TD1)
                  </SelectItem>
                  <SelectItem value="PASSEPORT">
                    Passeport International (TD3)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              size="sm"
              disabled={!fichier || loading}
              onClick={() => void handleScan()}
              className="w-full text-xs font-bold gap-2 h-9 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <ScanLine className="size-4" />
              <span>
                {loading ? "Analyse OCR en cours…" : "Lancer le Scan OCR"}
              </span>
            </Button>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Erreur de lecture OCR</span>
                </div>
                <p className="text-[11px] leading-relaxed">{error}</p>
              </div>
            )}

            {/* IMAGE PREVIEW BOX WITH ANIMATED SCAN BEAM */}
            {previewUrl && (
              <div className="relative rounded-lg overflow-hidden border border-border bg-black/90 p-2 group flex items-center justify-center min-h-[180px]">
                <img
                  src={previewUrl}
                  alt="Aperçu document"
                  className="max-h-52 w-auto object-contain rounded"
                />

                {loading && (
                  <div className="absolute inset-0 bg-primary/20 backdrop-blur-2xs flex flex-col items-center justify-center space-y-2">
                    <div className="w-full h-1 bg-primary/80 animate-pulse shadow-lg" />
                    <span className="text-xs font-bold text-white bg-black/70 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <RefreshCw className="size-3.5 animate-spin" />
                      Analyse Tesseract.js WASM…
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SESSION HISTORIQUE */}
          {history.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="size-3.5 text-primary" />
                <span>Scans récents de la session ({history.length})</span>
              </p>

              <div className="space-y-2">
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setResult(item.result);
                      setPreviewUrl(item.previewUrl);
                    }}
                    className="w-full p-2.5 rounded-lg border border-border bg-background hover:bg-muted/40 text-left transition-all flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <img
                        src={item.previewUrl}
                        alt="thumb"
                        className="size-8 rounded object-cover border shrink-0 bg-muted"
                      />
                      <div className="truncate">
                        <p className="font-bold text-foreground truncate">
                          {item.result.nom || "Inconnu"}{" "}
                          {item.result.prenom || ""}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {item.result.numeroPiece || "Sans N°"} ·{" "}
                          {item.timestamp}
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className="text-[9px] font-bold shrink-0"
                    >
                      {item.result.formatDetecte || "MRZ"}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: PARSED RESULTS & PMS ACTION PANEL */}
        <div className="lg:col-span-7 space-y-4">
          {!result && !loading && (
            <div className="p-12 text-center border-2 border-dashed border-border/80 rounded-xl bg-card space-y-3">
              <ScanLine className="size-12 mx-auto text-muted-foreground/50" />
              <div>
                <p className="text-sm font-bold text-foreground">
                  Aucun document scanné actuellement
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Importez une photo, capturez via la webcam ou cliquez sur l'un
                  des spécimens de démonstration pour lancer l'extraction OCR
                  des données MRZ.
                </p>
              </div>
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-5 shadow-2xs">
              {/* STATUS & CHECKSUM HEADER */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-foreground">
                      {result.nom} {result.prenom}
                    </h2>
                    {result.formatDetecte && (
                      <Badge
                        variant="secondary"
                        className="font-mono text-[10px] font-bold"
                      >
                        {result.formatDetecte === "TD1_CIN"
                          ? "CIN Marocaine (TD1)"
                          : "Passeport ISO (TD3)"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    N° Pièce:{" "}
                    <strong className="text-foreground">
                      {result.numeroPiece || "Non extrait"}
                    </strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {result.checksumValide ? (
                    <Badge
                      variant="default"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs py-1"
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>Chiffres de contrôle valides</span>
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 gap-1 text-xs py-1"
                    >
                      <AlertTriangle className="size-3.5 text-amber-600" />
                      <span>Chiffres de contrôle indicatifs</span>
                    </Badge>
                  )}
                </div>
              </div>

              {/* WARNING BANNER IF ANY */}
              {result.avertissement && (
                <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
                  <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{result.avertissement}</p>
                </div>
              )}

              {/* PMS MATCHING CLIENT BANNER */}
              {checkingGuest ? (
                <p className="text-xs text-muted-foreground">
                  Recherche du client en base PMS…
                </p>
              ) : matchingGuest ? (
                <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold">
                        Client trouvé en base PMS : {matchingGuest.nom}{" "}
                        {matchingGuest.prenom}
                      </p>
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-mono">
                        CIN/Passeport: {matchingGuest.pieceIdentite} |
                        Catégorie: {matchingGuest.categorie}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-emerald-600 text-white font-bold text-[10px] shrink-0"
                  >
                    Client Déjà Enregistré
                  </Badge>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200 text-xs flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-medium">
                    <UserPlus className="size-4 text-blue-600 shrink-0" />
                    <span>
                      Aucun client correspondant au N° {result.numeroPiece}{" "}
                      trouvé en base.
                    </span>
                  </span>
                  <Button
                    size="sm"
                    onClick={() => setCreateGuestOpen(true)}
                    className="h-7 text-xs font-bold gap-1 bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                  >
                    <UserPlus className="size-3" />
                    <span>Créer Fiche Client</span>
                  </Button>
                </div>
              )}

              {/* STRUCTURED EXTRACTED FIELDS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                    <span className="flex items-center gap-1">
                      <CreditCard className="size-3 text-primary" />
                      Numéro de Pièce
                    </span>
                    {result.numeroPiece && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(result.numeroPiece!, "numeroPiece")
                        }
                        className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                      >
                        {copiedField === "numeroPiece" ? (
                          <Check className="size-3" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        <span>
                          {copiedField === "numeroPiece" ? "Copié !" : "Copier"}
                        </span>
                      </button>
                    )}
                  </div>
                  <p className="text-sm font-extrabold font-mono text-foreground">
                    {result.numeroPiece || "—"}
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                    <span className="flex items-center gap-1">
                      <Globe className="size-3 text-blue-500" />
                      Nationalité (Code ISO)
                    </span>
                    {result.nationalite && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(result.nationalite!, "nationalite")
                        }
                        className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                      >
                        {copiedField === "nationalite" ? (
                          <Check className="size-3" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        <span>
                          {copiedField === "nationalite" ? "Copié !" : "Copier"}
                        </span>
                      </button>
                    )}
                  </div>
                  <p className="text-sm font-extrabold text-foreground">
                    {result.nationalite || "—"}{" "}
                    {result.nationalite === "MAR" ? "(Maroc)" : ""}
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                    <span>Nom de famille</span>
                    {result.nom && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(result.nom!, "nom")}
                        className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                      >
                        {copiedField === "nom" ? (
                          <Check className="size-3" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        <span>
                          {copiedField === "nom" ? "Copié !" : "Copier"}
                        </span>
                      </button>
                    )}
                  </div>
                  <p className="text-sm font-extrabold text-foreground">
                    {result.nom || "—"}
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                    <span>Prénom</span>
                    {result.prenom && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(result.prenom!, "prenom")}
                        className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                      >
                        {copiedField === "prenom" ? (
                          <Check className="size-3" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        <span>
                          {copiedField === "prenom" ? "Copié !" : "Copier"}
                        </span>
                      </button>
                    )}
                  </div>
                  <p className="text-sm font-extrabold text-foreground">
                    {result.prenom || "—"}
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3 text-amber-500" />
                      Date de Naissance & Sexe
                    </span>
                  </div>
                  <p className="text-sm font-extrabold text-foreground">
                    {result.dateNaissance || "—"}{" "}
                    {result.sexe
                      ? `(${result.sexe === "M" ? "Masculin" : "Féminin"})`
                      : ""}
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3 text-emerald-500" />
                      Date d'Expiration Document
                    </span>
                  </div>
                  <p className="text-sm font-extrabold font-mono text-foreground">
                    {result.dateExpiration || "—"}
                  </p>
                </div>
              </div>

              {/* ACTION BAR FOOTER */}
              <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAllData}
                  className="text-xs font-semibold gap-1.5"
                >
                  {copiedField === "all" ? (
                    <Check className="size-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  <span>
                    {copiedField === "all"
                      ? "Toutes les données copiées !"
                      : "Copier toutes les données"}
                  </span>
                </Button>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAssignDialogOpen(true)}
                    className="text-xs font-bold gap-1.5"
                  >
                    <Users className="size-3.5 text-primary" />
                    <span>Rattacher à un Client / Réservation</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setCreateGuestOpen(true)}
                    className="text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <UserPlus className="size-3.5" />
                    <span>Créer Fiche Client avec ces Données</span>
                  </Button>
                </div>
              </div>

              {/* MRZ RAW LINES INSPECTOR */}
              {result.lignesMrz && result.lignesMrz.length > 0 && (
                <div className="pt-2 border-t border-border/60">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBrut(!showBrut)}
                    className="text-xs text-muted-foreground hover:text-foreground h-7 p-0"
                  >
                    {showBrut
                      ? "Masquer la zone MRZ brute"
                      : "Inspecter la zone MRZ brute (Code ICAO)"}
                  </Button>

                  {showBrut && (
                    <div className="mt-2 p-3 rounded-lg bg-black text-emerald-400 font-mono text-xs overflow-x-auto space-y-1">
                      {result.lignesMrz.map((line, idx) => (
                        <p key={idx} className="tracking-widest">
                          {line}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CAMERA CAPTURE DIALOG */}
      <CameraCaptureDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => {
          handleFileChange(file);
          void handleScan(file);
        }}
      />

      {/* CREATE GUEST DIALOG PRE-FILLED WITH OCR RESULT */}
      <CreateGuestDialog
        open={createGuestOpen}
        onClose={() => setCreateGuestOpen(false)}
        onConfirm={handleCreateGuestConfirm}
        submitting={creatingGuest}
        error={createGuestError}
        initialValues={initialGuestData}
      />

      {/* ASSIGN SCAN TO GUEST/RESERVATION DIALOG */}
      <AssignScanDialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        scanResult={result}
        onAssigned={() => {
          if (result?.numeroPiece) {
            void checkForExistingGuest(result.numeroPiece);
          }
        }}
      />
    </div>
  );
}
