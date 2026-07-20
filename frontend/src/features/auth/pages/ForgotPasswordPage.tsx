import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPassword, resetPassword } from "../api";

interface Props {
  onBackToLogin: () => void;
}

// Flux "mot de passe oublié" basique (cahier des charges §5.2.1) : pas de
// véritable envoi d'email à ce stade — le backend renvoie directement le
// jeton à usage unique dans la réponse (voir AuthService.forgotPassword),
// donc cette page enchaîne directement sur le formulaire de réinitialisation
// dès qu'un jeton est reçu, plutôt que d'attendre un clic sur un lien reçu
// par email qui n'existe pas encore.
export function ForgotPasswordPage({ onBackToLogin }: Props) {
  const [step, setStep] = useState<"demande" | "reinitialisation" | "termine">(
    "demande",
  );
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleRequestToken(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await forgotPassword(email);
      if (res.resetToken) {
        setResetToken(res.resetToken);
        setStep("reinitialisation");
      } else {
        // Compte inexistant : même message générique, pas de fuite
        // d'information (voir AuthService.forgotPassword).
        setInfo(res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword(resetToken, nouveauMotDePasse);
      setStep("termine");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Mot de passe oublié</h1>
        </div>

        {step === "demande" && (
          <form onSubmit={handleRequestToken} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            {info && <p className="text-muted-foreground text-sm">{info}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Envoi…" : "Générer un lien de réinitialisation"}
            </Button>
            <Button type="button" variant="link" onClick={onBackToLogin}>
              Retour à la connexion
            </Button>
          </form>
        )}

        {step === "reinitialisation" && (
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <p className="text-muted-foreground text-sm">
              Lien généré (valable 30 minutes). Choisissez votre nouveau mot de
              passe.
            </p>
            <div className="flex flex-col gap-1">
              <Label htmlFor="nouveauMotDePasse">Nouveau mot de passe</Label>
              <Input
                id="nouveauMotDePasse"
                type="password"
                minLength={8}
                value={nouveauMotDePasse}
                onChange={(e) => setNouveauMotDePasse(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Mise à jour…" : "Réinitialiser le mot de passe"}
            </Button>
          </form>
        )}

        {step === "termine" && (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-sm">
              Mot de passe mis à jour. Vous pouvez maintenant vous connecter.
            </p>
            <Button type="button" onClick={onBackToLogin}>
              Retour à la connexion
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
