import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function CameraCaptureDialog({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCapturedUrl(null);
    setCapturedBlob(null);
    setLoading(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "La caméra n'est pas supportée sur ce navigateur ou dans cette iframe.",
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment", // rear camera preferred if available
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? err.message
          : "Accès à la caméra refusé ou non disponible.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [open, startCamera, stopCamera]);

  function handleTakeSnapshot() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          setCapturedUrl(URL.createObjectURL(blob));
          stopCamera();
        }
      },
      "image/jpeg",
      0.92,
    );
  }

  function handleRetake() {
    if (capturedUrl) {
      URL.revokeObjectURL(capturedUrl);
    }
    void startCamera();
  }

  function handleConfirm() {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `scan_camera_${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    onCapture(file);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-border">
        <DialogHeader className="p-4 pb-3 bg-muted/30 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Camera className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold">
                Capture Caméra / Webcam
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Placez la bande MRZ de la pièce d'identité bien à plat au
                centre.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-3">
          {cameraError ? (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs text-center space-y-2">
              <p className="font-semibold">{cameraError}</p>
              <p className="text-[11px] text-muted-foreground">
                Assurez-vous d'avoir accordé la permission d'accès à la caméra
                ou importez une photo enregistrée.
              </p>
            </div>
          ) : capturedUrl ? (
            <div className="relative rounded-lg overflow-hidden border border-border bg-black">
              <img
                src={capturedUrl}
                alt="Capture webcam"
                className="w-full max-h-[300px] object-contain mx-auto"
              />
            </div>
          ) : (
            <div className="relative rounded-lg overflow-hidden border border-border bg-black min-h-[260px] flex items-center justify-center">
              {loading && (
                <p className="text-xs text-white/70 animate-pulse">
                  Initialisation de la caméra…
                </p>
              )}
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full max-h-[300px] object-contain mx-auto"
              />

              {/* OVERLAY GUIDELINE BOX */}
              <div className="absolute inset-x-8 bottom-6 top-16 border-2 border-dashed border-emerald-400/80 rounded-lg pointer-events-none flex items-end justify-center pb-2">
                <span className="text-[10px] font-mono bg-black/70 text-emerald-300 px-2 py-0.5 rounded">
                  Bande MRZ dans ce cadre
                </span>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        <DialogFooter className="p-4 bg-muted/20 border-t border-border/60 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            <X className="size-3.5 mr-1" />
            Annuler
          </Button>

          {capturedUrl ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRetake}
                className="text-xs"
              >
                <RefreshCw className="size-3.5 mr-1" />
                Reprendre
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirm}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <Check className="size-3.5 mr-1" />
                Utiliser cette photo
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={!!cameraError || loading}
              onClick={handleTakeSnapshot}
              className="text-xs font-semibold gap-1.5"
            >
              <Camera className="size-3.5" />
              <span>Prendre la photo</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
