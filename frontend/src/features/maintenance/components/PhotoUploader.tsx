import React, { useRef, useState } from "react";
import { Camera, Upload, Link, Trash2, Image as ImageIcon, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PhotoUploaderProps {
  value: string;
  onChange: (url: string) => void;
}

export function PhotoUploader({ value, onChange }: PhotoUploaderProps) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Handle local file selection (from computer or mobile gallery)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert("L'image sélectionnée est trop volumineuse (maximum 8 Mo).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") {
        onChange(event.target.result);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input so re-selecting the same file works
    e.target.value = "";
  };

  // Start live camera stream in browser
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraModalOpen(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.warn("Could not access camera via getUserMedia:", err);
      setCameraError(
        "Accès caméra direct indisponible. Utilisez le bouton 'Appareil photo' mobile ci-dessus.",
      );
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraModalOpen(false);
  };

  // Take photo snapshot from video stream
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      onChange(dataUrl);
      stopCamera();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* HIDDEN INPUTS FOR FILE UPLOAD AND DIRECT CAMERA CAPTURE */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* PHOTO PREVIEW IF VALUE EXISTS */}
      {value ? (
        <div className="relative rounded-xl border p-2 bg-muted/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="size-14 rounded-lg overflow-hidden border bg-black/10 shrink-0 flex items-center justify-center">
              <img
                src={value}
                alt="Aperçu incident"
                className="size-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://placehold.co/150?text=Erreur+Image";
                }}
              />
            </div>
            <div className="flex flex-col text-xs min-w-0">
              <span className="font-bold text-foreground flex items-center gap-1">
                <ImageIcon className="size-3.5 text-emerald-600" />
                <span>Photo jointe au ticket</span>
              </span>
              <span className="text-[10px] text-muted-foreground truncate max-w-[200px] font-mono">
                {value.startsWith("data:") ? "Image importée du disque" : value}
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            className="text-destructive hover:bg-destructive/10 h-8 px-2 text-xs gap-1"
          >
            <Trash2 className="size-3.5" />
            <span className="hidden sm:inline">Supprimer</span>
          </Button>
        </div>
      ) : (
        /* UPLOAD OPTIONS WHEN NO PHOTO IS ATTACHED */
        <div className="flex flex-col gap-2">
          {/* ACTION BUTTONS GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {/* UPLOAD FILE FROM DISK */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl border bg-card hover:bg-muted/50 flex flex-col items-center justify-center text-center gap-1 transition-all hover:border-primary/50 text-foreground"
            >
              <Upload className="size-4 text-primary" />
              <span className="font-semibold text-[11px]">Téléverser Fichier</span>
              <span className="text-[9px] text-muted-foreground">Image sur PC / Mac</span>
            </button>

            {/* NATIVE CAMERA MOBILE CAPTURE */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="p-2.5 rounded-xl border bg-card hover:bg-amber-500/10 flex flex-col items-center justify-center text-center gap-1 transition-all hover:border-amber-500 text-foreground"
            >
              <Camera className="size-4 text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-[11px]">Appareil Photo</span>
              <span className="text-[9px] text-muted-foreground">Prendre sur Smartphone</span>
            </button>

            {/* LIVE WEBCAM MODAL TRIGGER */}
            <button
              type="button"
              onClick={startCamera}
              className="p-2.5 rounded-xl border bg-card hover:bg-blue-500/10 flex flex-col items-center justify-center text-center gap-1 transition-all hover:border-blue-500 text-foreground col-span-2 sm:col-span-1"
            >
              <Video className="size-4 text-blue-600" />
              <span className="font-semibold text-[11px]">Caméra Web</span>
              <span className="text-[9px] text-muted-foreground">Capture en direct</span>
            </button>
          </div>

          {/* TOGGLE MANUAL URL MODE */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setMode(mode === "url" ? "upload" : "url")}
              className="text-[10px] text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <Link className="size-3" />
              <span>{mode === "url" ? "Masquer saisie d'URL" : "Ou saisir une URL Web..."}</span>
            </button>
          </div>

          {mode === "url" && (
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://... (Lien image HTTP/HTTPS)"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 text-xs font-mono bg-background"
              />
            </div>
          )}
        </div>
      )}

      {/* LIVE CAMERA CAPTURE MODAL */}
      <Dialog open={isCameraModalOpen} onOpenChange={(next) => !next && stopCamera()}>
        <DialogContent className="sm:max-w-lg max-w-[calc(100%-1rem)] p-4">
          <DialogHeader className="border-b pb-2">
            <DialogTitle className="text-sm font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Camera className="size-4 text-amber-600" />
                <span>Prise de vue Caméra en Direct</span>
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 mt-2">
            {cameraError ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-800 dark:text-amber-300 rounded-xl text-xs flex flex-col gap-2">
                <p className="font-medium">{cameraError}</p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    stopCamera();
                    cameraInputRef.current?.click();
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 self-start"
                >
                  <Camera className="size-3.5" />
                  <span>Ouvrir Appareil Photo Téléphone</span>
                </Button>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={stopCamera}
                className="text-xs"
              >
                Annuler
              </Button>
              {!cameraError && (
                <Button
                  type="button"
                  size="sm"
                  onClick={captureSnapshot}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-2"
                >
                  <Camera className="size-4" />
                  <span>Prendre la Photo</span>
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
