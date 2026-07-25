import { useState, useEffect } from "react";
import {
  runConnectivityDiagnostics,
  type DiagnosticReport,
} from "@/lib/diagnostics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Server,
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
} from "lucide-react";

export function EnvironmentDiagnosticCard() {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [loading, setLoading] = useState(false);

  const rawViteApiUrl = import.meta.env.VITE_API_URL;
  const currentOrigin =
    typeof window !== "undefined" ? window.location.origin : "";
  const resolvedApiUrl =
    rawViteApiUrl &&
    !rawViteApiUrl.includes("localhost") &&
    !rawViteApiUrl.includes("127.0.0.1")
      ? rawViteApiUrl
      : "/api";

  async function refreshDiagnostic() {
    setLoading(true);
    try {
      const rep = await runConnectivityDiagnostics();
      setReport(rep);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    runConnectivityDiagnostics()
      .then((rep) => {
        if (active) setReport(rep);
      })
      .catch(console.error);

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm space-y-3">
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Server className="w-4 h-4 text-primary" />
          <span>Diagnostic Environnement API & Origine</span>
        </div>
        {report && (
          <Badge
            variant="outline"
            className={
              report.overallStatus === "success"
                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300"
                : report.overallStatus === "warning"
                  ? "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300"
                  : "bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-300"
            }
          >
            {report.overallStatus === "success" && (
              <CheckCircle2 className="w-3 h-3 mr-1" />
            )}
            {report.overallStatus === "warning" && (
              <AlertTriangle className="w-3 h-3 mr-1" />
            )}
            {report.overallStatus === "error" && (
              <XCircle className="w-3 h-3 mr-1" />
            )}
            {report.overallStatus.toUpperCase()}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-2.5 rounded-lg bg-muted/50 border space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
            <Info className="w-3.5 h-3.5" />
            <span>import.meta.env.VITE_API_URL</span>
          </div>
          <p className="font-mono text-foreground font-semibold break-all">
            {rawViteApiUrl || "(non défini / vide)"}
          </p>
        </div>

        <div className="p-2.5 rounded-lg bg-muted/50 border space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
            <Globe className="w-3.5 h-3.5" />
            <span>Origine du Navigateur (window.origin)</span>
          </div>
          <p className="font-mono text-foreground font-semibold break-all">
            {currentOrigin || "inconnu"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs pt-1">
        <div className="text-muted-foreground">
          Cible API effective:{" "}
          <code className="font-mono text-primary font-semibold px-1.5 py-0.5 rounded bg-muted">
            {resolvedApiUrl}
          </code>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={refreshDiagnostic}
          disabled={loading}
        >
          <RefreshCw
            className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`}
          />
          Tester
        </Button>
      </div>
    </div>
  );
}
