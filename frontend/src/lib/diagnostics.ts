import { getCsrfToken } from "./token-storage";

export interface DiagnosticStep {
  name: string;
  status: "pending" | "running" | "success" | "warning" | "error";
  details: string;
  durationMs?: number;
  data?: Record<string, unknown>;
}

export interface DiagnosticReport {
  timestamp: string;
  environment: {
    rawViteApiUrl: string | undefined;
    resolvedApiUrl: string;
    windowOrigin: string;
    userAgent: string;
  };
  steps: DiagnosticStep[];
  overallStatus: "success" | "warning" | "error";
  recommendations: string[];
}

export async function runConnectivityDiagnostics(): Promise<DiagnosticReport> {
  const startTime = performance.now();
  const rawViteApiUrl = import.meta.env.VITE_API_URL;
  
  // Resolve base API URL (matching api-client logic)
  const resolvedApiUrl =
    rawViteApiUrl &&
    !rawViteApiUrl.includes("localhost") &&
    !rawViteApiUrl.includes("127.0.0.1")
      ? rawViteApiUrl
      : "/api";

  const windowOrigin = typeof window !== "undefined" ? window.location.origin : "server";
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";

  const steps: DiagnosticStep[] = [];
  const recommendations: string[] = [];

  // Step 1: Configuration Analysis
  const isLocalhostConfigured = rawViteApiUrl && (rawViteApiUrl.includes("localhost") || rawViteApiUrl.includes("127.0.0.1"));
  steps.push({
    name: "Analyse de la configuration VITE_API_URL",
    status: isLocalhostConfigured ? "warning" : "success",
    details: isLocalhostConfigured
      ? `VITE_API_URL contient '${rawViteApiUrl}'. Le client frontend bascule automatiquement vers '${resolvedApiUrl}' pour éviter l'erreur NetworkError dans le navigateur.`
      : `Configuration API résolue avec succès vers '${resolvedApiUrl}'.`,
    data: {
      rawViteApiUrl: rawViteApiUrl ?? "(non défini)",
      resolvedApiUrl,
      windowOrigin,
    },
  });

  if (isLocalhostConfigured) {
    recommendations.push(
      "VITE_API_URL contenait une URL 'localhost' inaccessible depuis le navigateur client. Le fallback '/api' avec proxy inverse à été appliqué automatiquement."
    );
  }

  // Step 2: CORS Preflight (OPTIONS) Check
  const corsStepStart = performance.now();
  try {
    const corsEndpoint = `${resolvedApiUrl}/auth/login`;
    const corsRes = await fetch(corsEndpoint, {
      method: "OPTIONS",
      headers: {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type, x-csrf-token",
        Origin: windowOrigin,
      },
    });

    const corsDuration = Math.round(performance.now() - corsStepStart);
    const allowOrigin = corsRes.headers.get("access-control-allow-origin");
    const allowCredentials = corsRes.headers.get("access-control-allow-credentials");
    const allowHeaders = corsRes.headers.get("access-control-allow-headers");
    const allowMethods = corsRes.headers.get("access-control-allow-methods");

    const corsOk = corsRes.ok || corsRes.status === 204;

    steps.push({
      name: "Test CORS Preflight (OPTIONS /auth/login)",
      status: corsOk ? "success" : "warning",
      durationMs: corsDuration,
      details: corsOk
        ? `Preflight CORS réussi (Status ${corsRes.status}). Origin autorisé: '${allowOrigin ?? "none"}', Credentials: '${allowCredentials ?? "none"}'.`
        : `Preflight CORS a renvoyé le statut HTTP ${corsRes.status}.`,
      data: {
        status: corsRes.status,
        allowOrigin: allowOrigin ?? "non fourni",
        allowCredentials: allowCredentials ?? "non fourni",
        allowHeaders: allowHeaders ?? "non fourni",
        allowMethods: allowMethods ?? "non fourni",
      },
    });

    if (!corsOk) {
      recommendations.push(
        "Le backend a refusé la requête OPTIONS CORS Preflight. Vérifiez la configuration CORS NestJS dans main.ts."
      );
    }
  } catch (err) {
    const corsDuration = Math.round(performance.now() - corsStepStart);
    steps.push({
      name: "Test CORS Preflight (OPTIONS /auth/login)",
      status: "error",
      durationMs: corsDuration,
      details: `Échec réseau lors du Preflight CORS: ${err instanceof Error ? err.message : String(err)}.`,
      data: { error: String(err) },
    });
    recommendations.push(
      "Impossible d'atteindre le serveur lors du test CORS (NetworkError). Vérifiez que le serveur backend tourne sur le port 3000."
    );
  }

  // Step 3: HTTP Handshake & API Reachability
  const handshakeStart = performance.now();
  try {
    const handshakeEndpoint = `${resolvedApiUrl}/auth/roles-actifs`;
    const res = await fetch(handshakeEndpoint, {
      method: "GET",
      credentials: "include",
    });

    const duration = Math.round(performance.now() - handshakeStart);
    const contentType = res.headers.get("content-type") ?? "inconnu";

    if (res.ok) {
      const data = await res.json().catch(() => null);
      steps.push({
        name: "Test d'Handshake HTTP (GET /auth/roles-actifs)",
        status: "success",
        durationMs: duration,
        details: `Connexion HTTP établie avec succès (Status ${res.status} OK, latence ${duration}ms).`,
        data: {
          status: res.status,
          contentType,
          rolesCount: Array.isArray(data) ? data.length : "format inattendu",
        },
      });
    } else {
      steps.push({
        name: "Test d'Handshake HTTP (GET /auth/roles-actifs)",
        status: "warning",
        durationMs: duration,
        details: `Réponse du serveur reçue mais avec statut HTTP ${res.status} ${res.statusText}.`,
        data: {
          status: res.status,
          statusText: res.statusText,
          contentType,
        },
      });
      recommendations.push(
        `Le backend a répondu avec le statut HTTP ${res.status}. Vérifiez les logs backend.`
      );
    }
  } catch (err) {
    const duration = Math.round(performance.now() - handshakeStart);
    steps.push({
      name: "Test d'Handshake HTTP (GET /auth/roles-actifs)",
      status: "error",
      durationMs: duration,
      details: `NetworkError lors de la requête HTTP: ${err instanceof Error ? err.message : String(err)}.`,
      data: { error: String(err) },
    });
    recommendations.push(
      "Échec de connexion au serveur (NetworkError). Assurez-vous que le reverse proxy et le backend sont démarrés."
    );
  }

  // Step 4: CSRF Token Availability
  const currentCsrfToken = getCsrfToken();
  const hasCsrfToken = Boolean(currentCsrfToken);

  steps.push({
    name: "Vérification des Tokens CSRF",
    status: hasCsrfToken ? "success" : "warning",
    details: hasCsrfToken
      ? `Jeton CSRF présent en mémoire client (${currentCsrfToken?.substring(0, 8)}...).`
      : "Aucun jeton CSRF en mémoire. Il sera automatiquement obtenu et transmis lors du premier login ou refresh.",
    data: {
      hasCsrfToken,
      tokenPreview: currentCsrfToken ? `${currentCsrfToken.substring(0, 8)}...` : null,
    },
  });

  // Calculate overall status
  const hasError = steps.some((s) => s.status === "error");
  const hasWarning = steps.some((s) => s.status === "warning");
  const overallStatus = hasError ? "error" : hasWarning ? "warning" : "success";

  const totalDuration = Math.round(performance.now() - startTime);

  const report: DiagnosticReport = {
    timestamp: new Date().toISOString(),
    environment: {
      rawViteApiUrl,
      resolvedApiUrl,
      windowOrigin,
      userAgent,
    },
    steps,
    overallStatus,
    recommendations: recommendations.length > 0 ? recommendations : ["Tous les tests de connectivité sont passés au vert."],
  };

  // Log detailed output to browser console
  console.group(`🔍 [Makarim Diagnostic] Rapport de connectivité (${new Date().toLocaleTimeString()}) - ${totalDuration}ms`);
  console.log("Statut global:", overallStatus.toUpperCase());
  console.log("URL VITE_API_URL (raw):", rawViteApiUrl);
  console.log("URL API résolue:", resolvedApiUrl);
  console.log("Origin du navigateur:", windowOrigin);
  console.table(steps.map(s => ({
    Étape: s.name,
    Statut: s.status,
    Durée: s.durationMs ? `${s.durationMs}ms` : "-",
    Détails: s.details,
  })));
  if (recommendations.length > 0) {
    console.log("Recommandations:", recommendations);
  }
  console.groupEnd();

  return report;
}

// Expose on window object for easy manual invocation in DevTools
if (typeof window !== "undefined") {
  (window as unknown as { __runMakarimDiagnostics: typeof runConnectivityDiagnostics }).__runMakarimDiagnostics =
    runConnectivityDiagnostics;
}
