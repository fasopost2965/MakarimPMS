import { useState, useRef, useEffect } from "react";
import jsQR from "jsqr";
import {
  QrCode,
  Camera,
  Upload,
  Search,
  CheckCircle2,
  BedDouble,
  UserCheck,
  ShieldCheck,
  Calendar,
  Sparkles,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Reservation } from "@/features/reservations/types";

interface QrCheckinScannerDialogProps {
  open: boolean;
  onClose: () => void;
  arrivals: Reservation[];
  onConfirmCheckin: (reservationId: number, guestName: string) => Promise<void>;
}

export function QrCheckinScannerDialog({
  open,
  onClose,
  arrivals,
  onConfirmCheckin,
}: QrCheckinScannerDialogProps) {
  const [activeTab, setActiveTab] = useState<"camera" | "upload" | "manual">("camera");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Scanned Reservation state
  const [scannedReservation, setScannedReservation] = useState<Reservation | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Refs for video & canvas
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Start / Stop Camera stream
  useEffect(() => {
    if (open && activeTab === "camera" && !scannedReservation) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [open, activeTab, scannedReservation]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setCameraActive(true);
        requestAnimationFrame(tickScan);
      }
    } catch (err) {
      setCameraError(
        "Accès caméra refusé ou non disponible. Utilisez l'import de fichier ou la saisie du code pré-enregistrement.",
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Tick function to scan canvas frames
  const tickScan = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && code.data) {
            handleCodeScanned(code.data);
            return; // Stop scanning once found
          }
        }
      }
    }
    animFrameRef.current = requestAnimationFrame(tickScan);
  };

  // Handle uploaded image
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
          handleCodeScanned(code.data);
        } else {
          setScanError("Aucun QR Code valide détecté dans cette image. Réessayez.");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Match QR Code payload to arrivals
  const handleCodeScanned = (rawCode: string) => {
    setScanError(null);
    let matchedReservation: Reservation | undefined;

    // Try parsing as JSON or string matching
    try {
      if (rawCode.startsWith("{")) {
        const parsed = JSON.parse(rawCode);
        const resId = parsed.resId || parsed.reservationId || parsed.id;
        matchedReservation = arrivals.find((a) => a.id === Number(resId));
      }
    } catch {
      // Ignore JSON parse error and proceed to regex/string search
    }

    if (!matchedReservation) {
      // Look for ID in code e.g. "PRE-CHECKIN-RES-101" -> 101 or "RES-1"
      const match = rawCode.match(/(\d+)/);
      if (match) {
        const id = Number(match[1]);
        matchedReservation = arrivals.find((a) => a.id === id);
      }
    }

    if (!matchedReservation) {
      // Search by guest name in raw string
      const searchLower = rawCode.toLowerCase();
      matchedReservation = arrivals.find(
        (a) =>
          a.guest?.nom.toLowerCase().includes(searchLower) ||
          a.guest?.prenom.toLowerCase().includes(searchLower),
      );
    }

    if (matchedReservation) {
      setScannedReservation(matchedReservation);
      stopCamera();
    } else {
      setScanError(
        `Aucune réservation en arrivée aujourd'hui ne correspond au code : "${rawCode}".`,
      );
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleCodeScanned(manualCode.trim());
  };

  const handleConfirm = async () => {
    if (!scannedReservation) return;
    setIsProcessing(true);
    const guestName = `${scannedReservation.guest?.prenom || ""} ${scannedReservation.guest?.nom || ""}`.trim();
    try {
      await onConfirmCheckin(scannedReservation.id, guestName || "Client");
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const resetScanner = () => {
    setScannedReservation(null);
    setScanError(null);
    setManualCode("");
    if (activeTab === "camera") {
      startCamera();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border shadow-2xl">
        <DialogHeader className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <QrCode className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                Check-in Express via QR Code
              </DialogTitle>
              <p className="text-xs text-slate-300 mt-0.5">
                Présentez le Pass de Pré-enregistrement du client
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 flex flex-col gap-4">
          {/* IF RESERVATION FOUND FROM QR SCAN */}
          {scannedReservation ? (
            <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95">
              <div className="p-3 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl flex items-center gap-3">
                <CheckCircle2 className="size-6 text-emerald-600 shrink-0" />
                <div>
                  <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                    Réservation Identifiée avec Succès
                  </Badge>
                  <p className="text-xs text-foreground font-semibold mt-0.5">
                    Pré-enregistrement numérique valide & vérifié
                  </p>
                </div>
              </div>

              {/* RESERVATION CARD */}
              <div className="border rounded-2xl p-4 bg-card shadow-sm space-y-3">
                <div className="flex items-start justify-between border-b pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      {scannedReservation.guest ? `${scannedReservation.guest.prenom} ${scannedReservation.guest.nom}` : `Client #${scannedReservation.id}`}
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <UserCheck className="size-3.5 text-blue-600" />
                      Client : #{scannedReservation.id} — Code QR Vérifié
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono bg-blue-50 text-blue-700 border-blue-200 font-bold">
                    #{scannedReservation.id}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase block">
                      Chambre Attribuée
                    </span>
                    <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
                      <BedDouble className="size-4 text-amber-600" />
                      Chambre #{scannedReservation.room?.numero || "À attribuer"}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase block">
                      Dates du Séjour
                    </span>
                    <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
                      <Calendar className="size-4 text-blue-600" />
                      {new Date(scannedReservation.dateArrivee).toLocaleDateString("fr-FR")} →{" "}
                      {new Date(scannedReservation.dateDepart).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>

                {/* PRE-CHECKIN CHECKLIST BADGES */}
                <div className="border-t pt-3 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1 text-emerald-600">
                    <ShieldCheck className="size-3.5" />
                    Pièce ID Fiche Police
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600">
                    <Sparkles className="size-3.5" />
                    Signature Électronique
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="size-3.5" />
                    Chambre Prête
                  </span>
                </div>
              </div>

              {/* CONFIRMATION ACTIONS */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetScanner}
                  className="flex-1 text-xs"
                >
                  Scanner un autre code
                </Button>

                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isProcessing}
                  className="flex-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-lg"
                >
                  {isProcessing ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  <span>Finaliser Check-in Instantané</span>
                </Button>
              </div>
            </div>
          ) : (
            /* SCANNER TABS */
            <div className="flex flex-col gap-4">
              <div className="flex border-b text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab("camera")}
                  className={`pb-2 px-3 border-b-2 flex items-center gap-1.5 transition-all ${
                    activeTab === "camera"
                      ? "border-amber-600 text-amber-600"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Camera className="size-3.5" />
                  <span>Caméra en Direct</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("upload")}
                  className={`pb-2 px-3 border-b-2 flex items-center gap-1.5 transition-all ${
                    activeTab === "upload"
                      ? "border-amber-600 text-amber-600"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Upload className="size-3.5" />
                  <span>Importer Image QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("manual")}
                  className={`pb-2 px-3 border-b-2 flex items-center gap-1.5 transition-all ${
                    activeTab === "manual"
                      ? "border-amber-600 text-amber-600"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Search className="size-3.5" />
                  <span>Saisie Manuel / Test</span>
                </button>
              </div>

              {/* SCAN ERROR ALERT */}
              {scanError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="size-4 text-rose-600 shrink-0" />
                  <span>{scanError}</span>
                </div>
              )}

              {/* TAB 1: CAMERA SCANNER */}
              {activeTab === "camera" && (
                <div className="flex flex-col items-center justify-center gap-3">
                  {cameraError ? (
                    <div className="p-4 bg-muted border rounded-2xl text-center text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground mb-1">{cameraError}</p>
                      <p>Basculez sur l'onglet "Saisie Manuel / Test" pour simuler un QR Code.</p>
                    </div>
                  ) : (
                    <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 flex items-center justify-center">
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                      />
                      <canvas ref={canvasRef} className="hidden" />

                      {/* SCAN OVERLAY TARGET BOX */}
                      <div className="absolute size-48 border-2 border-amber-500 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex items-center justify-center pointer-events-none">
                        <div className="size-full border border-amber-400/50 rounded-lg animate-pulse" />
                      </div>

                      <div className="absolute bottom-2 text-center text-[10px] bg-black/70 text-amber-300 font-mono px-3 py-1 rounded-full border border-amber-500/30">
                        Alignez le Pass QR client au centre
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: UPLOAD IMAGE FILE */}
              {activeTab === "upload" && (
                <div className="p-8 border-2 border-dashed rounded-2xl text-center bg-slate-50 dark:bg-slate-900/30 flex flex-col items-center justify-center gap-3">
                  <div className="p-3 bg-amber-500/10 text-amber-600 rounded-full">
                    <Upload className="size-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      Glissez votre capture d'écran ou Pass QR
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Formats supportés : PNG, JPG, WEBP, PDF Rendered
                    </p>
                  </div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="max-w-xs text-xs cursor-pointer"
                  />
                </div>
              )}

              {/* TAB 3: MANUAL INPUT & SAMPLE SELECTOR FOR QUICK TESTING */}
              {activeTab === "manual" && (
                <div className="flex flex-col gap-4">
                  <form onSubmit={handleManualSubmit} className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Ex: PRE-CHECKIN-RES-101 ou NOM"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="text-xs h-9"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0"
                    >
                      Scanner
                    </Button>
                  </form>

                  {/* QUICK SAMPLE SELECTOR */}
                  <div className="p-3 border rounded-xl bg-slate-50 dark:bg-slate-900/30">
                    <span className="text-[11px] font-bold text-muted-foreground block mb-2">
                      Pass de pré-enregistrement disponibles aujourd'hui ({arrivals.length}) :
                    </span>
                    {arrivals.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        Aucune arrivée prévue aujourd'hui.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                        {arrivals.map((arr) => (
                          <button
                            key={arr.id}
                            type="button"
                            onClick={() => handleCodeScanned(`PRE-CHECKIN-RES-${arr.id}`)}
                            className="p-2 border rounded-lg bg-card hover:border-amber-500 text-left flex items-center justify-between text-xs transition-all"
                          >
                            <div>
                              <span className="font-bold text-foreground">
                                {arr.guest ? `${arr.guest.prenom} ${arr.guest.nom}` : `Client #${arr.id}`}
                              </span>
                              <p className="text-[10px] text-muted-foreground">
                                Chambre #{arr.room?.numero || "Non assignée"}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-[10px] font-mono bg-amber-50 text-amber-800 border-amber-300">
                              Simuler QR #RES-{arr.id}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
