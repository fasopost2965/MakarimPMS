import { useState } from "react";
import {
  runConnectivityDiagnostics,
  type DiagnosticReport,
} from "@/lib/diagnostics";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Info,
  Server,
} from "lucide-react";

interface Props {
  triggerText?: string;
  variant?: "outline" | "ghost" | "default" | "secondary" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function ConnectivityDiagnosticModal({
  triggerText = "Diagnostic Réseau",
  variant = "outline",
  size = "sm",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleRun() {
    setRunning(true);
    try {
      const rep = await runConnectivityDiagnostics();
      setReport(rep);
    } catch (err) {
      console.error("Erreur lors de l'exécution du diagnostic:", err);
    } finally {
      setRunning(false);
    }
  }

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen);
    if (newOpen && !report && !running) {
      void handleRun();
    }
  }

  function copyReport() {
    if (!report) return;
    const text = JSON.stringify(report, null, 2);
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function getStatusBadge(status: "success" | "warning" | "error") {
    switch (status) {
      case "success":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Opérationnel
          </Badge>
        );
      case "warning":
        return (
          <Badge className="bg-amber-600 hover:bg-amber-700 text-white gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Attention
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-rose-600 hover:bg-rose-700 text-white gap-1">
            <XCircle className="w-3.5 h-3.5" /> Erreur Réseau
          </Badge>
        );
    }
  }

  function getStepIcon(status: string) {
    switch (status) {
      case "success":
        return (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        );
      case "warning":
        return (
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        );
      case "error":
        return <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />;
      default:
        return <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />;
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant={variant} size={size} className={className}>
            <Activity className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            {triggerText}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Server className="w-5 h-5 text-primary" />
              Diagnostic de Connectivité Frontend ↔ Backend
            </DialogTitle>
            {report && getStatusBadge(report.overallStatus)}
          </div>
        </DialogHeader>

        {running ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">
              Analyse des connexions, CORS et tokens CSRF en cours…
            </p>
          </div>
        ) : report ? (
          <div className="space-y-6 pt-2">
            {/* Metadonnées d'environnement */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs bg-muted/40 p-3 rounded-lg border">
              <div>
                <span className="font-semibold text-muted-foreground">
                  URL VITE_API_URL:
                </span>{" "}
                <code className="bg-background px-1 py-0.5 rounded border">
                  {report.environment.rawViteApiUrl ?? "non défini"}
                </code>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">
                  API Cible Résolue:
                </span>{" "}
                <code className="bg-background px-1 py-0.5 rounded border font-semibold text-primary">
                  {report.environment.resolvedApiUrl}
                </code>
              </div>
              <div className="col-span-full">
                <span className="font-semibold text-muted-foreground">
                  Origine Navigateur:
                </span>{" "}
                <code className="bg-background px-1 py-0.5 rounded border">
                  {report.environment.windowOrigin}
                </code>
              </div>
            </div>

            {/* Liste des Étapes */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Résultats des Tests Réseau
              </h3>
              <div className="space-y-2">
                {report.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border bg-card text-card-foreground flex flex-col gap-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        {getStepIcon(step.status)}
                        <div>
                          <p className="text-sm font-medium leading-none">
                            {step.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {step.details}
                          </p>
                        </div>
                      </div>
                      {step.durationMs !== undefined && (
                        <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {step.durationMs} ms
                        </span>
                      )}
                    </div>

                    {step.data && Object.keys(step.data).length > 0 && (
                      <div className="mt-1 pl-6">
                        <details className="text-[11px] text-muted-foreground cursor-pointer">
                          <summary className="hover:underline font-medium">
                            Afficher les détails techniques
                          </summary>
                          <pre className="mt-1 p-2 bg-muted/60 rounded text-[10px] font-mono overflow-x-auto border">
                            {JSON.stringify(step.data, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Recommandations */}
            {report.recommendations.length > 0 && (
              <div className="p-3.5 rounded-lg border bg-amber-500/10 border-amber-500/20 text-xs space-y-1.5">
                <p className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />{" "}
                  Recommandations & Observations
                </p>
                <ul className="list-disc pl-5 space-y-1 text-amber-800 dark:text-amber-300">
                  {report.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions Footer */}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-[11px] text-muted-foreground">
                Exécuté le {new Date(report.timestamp).toLocaleTimeString()}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRun}
                  disabled={running}
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 mr-1.5 ${running ? "animate-spin" : ""}`}
                  />
                  Re-tester
                </Button>
                <Button variant="secondary" size="sm" onClick={copyReport}>
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />{" "}
                      Copié
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copier le rapport
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
