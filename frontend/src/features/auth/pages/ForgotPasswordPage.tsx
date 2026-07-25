import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPassword, resetPassword } from '../api';

interface Props {
  onBackToLogin: () => void;
}

// CH-002 (docs/governance/REGISTRE_CHANTIERS.md) : le jeton de
// réinitialisation n'est plus jamais renvoyé dans la réponse HTTP — il est
// envoyé exclusivement par email (voir AuthService.forgotPassword). Cette
// page passe donc systématiquement à l'étape de saisie du code après la
// demande, que le compte existe ou non (même comportement observable dans
// les deux cas, cohérent avec le message anti-énumération déjà en place
// côté backend) ; le champ "code" est prérempli automatiquement si l'email
// contenait un lien avec ?resetToken=... (pas de routeur dans ce projet —
// une simple lecture de window.location.search suffit, sans dépendance
// supplémentaire), sinon l'utilisateur colle le code reçu par email.
export function ForgotPasswordPage({ onBackToLogin }: Props) {
  const [step, setStep] = useState<'demande' | 'reinitialisation' | 'termine'>(
    'demande',
  );
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState(
    () => new URLSearchParams(window.location.search).get('resetToken') ?? '',
  );
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestToken(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setStep('reinitialisation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
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
      setStep('termine');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
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

        {step === 'demande' && (
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
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Envoi…' : 'Envoyer le code par email'}
            </Button>
            <Button type="button" variant="link" onClick={onBackToLogin}>
              Retour à la connexion
            </Button>
          </form>
        )}

        {step === 'reinitialisation' && (
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <p className="text-muted-foreground text-sm">
              Si ce compte existe, un code de réinitialisation a été envoyé par
              email (valable 30 minutes). Collez-le ci-dessous avec votre
              nouveau mot de passe.
            </p>
            <div className="flex flex-col gap-1">
              <Label htmlFor="resetToken">Code reçu par email</Label>
              <Input
                id="resetToken"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                required
              />
            </div>
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
              {submitting ? 'Mise à jour…' : 'Réinitialiser le mot de passe'}
            </Button>
          </form>
        )}

        {step === 'termine' && (
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
