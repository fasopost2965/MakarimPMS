import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPassword, resetPassword } from '../api';

interface Props {
  onBackToLogin: () => void;
  // Design Marine & Or — même convention que LoginPage (GET
  // /parameters/branding, chargé une fois dans App.tsx, jamais rechargé ici).
  logoUrl?: string | null;
  raisonSociale?: string;
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
//
// Refonte batch 3 (design_handoff_batch3/MotDePasse.dc.html, CH-069) :
// même carte de marque que LoginPage (liseré dégradé marine→or, logo,
// raison sociale) au lieu d'un formulaire nu ; ajout d'un champ de
// confirmation du nouveau mot de passe (validation client, le backend ne
// reçoit jamais qu'un seul champ nouveauMotDePasse — aucune nouvelle
// capacité serveur) et distinction visuelle du message d'erreur "lien
// expiré/déjà utilisé" par rapport aux autres erreurs. **Écart assumé** :
// l'indice de mot de passe du mockup mentionne un caractère spécial
// obligatoire — ResetPasswordDto (backend) n'exige que minuscule +
// majuscule + chiffre (CH-026(d)), aucun caractère spécial ; le texte
// affiché ici reflète la règle serveur réelle, pas celle du mockup.
export function ForgotPasswordPage({
  onBackToLogin,
  logoUrl,
  raisonSociale,
}: Props) {
  const [step, setStep] = useState<'demande' | 'reinitialisation' | 'termine'>(
    'demande',
  );
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState(
    () => new URLSearchParams(window.location.search).get('resetToken') ?? '',
  );
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmationMotDePasse, setConfirmationMotDePasse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);

  const motsDePasseDifferents =
    confirmationMotDePasse.length > 0 &&
    nouveauMotDePasse !== confirmationMotDePasse;

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
    if (motsDePasseDifferents) return;
    setError(null);
    setTokenError(false);
    setSubmitting(true);
    try {
      await resetPassword(resetToken, nouveauMotDePasse);
      setStep('termine');
    } catch (err) {
      setTokenError(true);
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-muted flex h-screen items-center justify-center p-6">
      <div className="bg-card flex w-full max-w-[420px] flex-col overflow-hidden rounded-xl shadow-[var(--shadow-elevated)]">
        <div
          className="h-1.5 shrink-0"
          style={{
            background:
              'linear-gradient(90deg, var(--primary), var(--primary-soft))',
          }}
        />

        <div className="flex items-center gap-2.5 px-9 pt-8">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="size-[34px] shrink-0 rounded-[9px] object-contain"
            />
          ) : (
            <span className="bg-primary text-primary-ink flex size-[34px] shrink-0 items-center justify-center rounded-[9px] text-[15px] font-bold">
              M
            </span>
          )}
          <span className="text-[15px] font-semibold">
            {raisonSociale ?? 'Hôtel Makarim'}
          </span>
        </div>

        {step === 'demande' && (
          <form
            onSubmit={handleRequestToken}
            className="flex flex-col px-9 pt-5 pb-9"
          >
            <h1 className="mb-0.5 text-[21px] font-semibold">
              Mot de passe oublié
            </h1>
            <p className="text-muted-foreground mb-5 text-[13px]">
              Un lien de réinitialisation sera envoyé par email si le compte
              existe.
            </p>

            <div className="mb-5 flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-[13px]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="vous@hotelmakarim.com"
                className="bg-muted/40 h-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-destructive mb-4 text-sm">{error}</p>}

            <Button type="submit" disabled={submitting} className="h-[42px]">
              {submitting ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}
            </Button>

            <div className="bg-muted mt-4 rounded-lg p-2.5">
              <p className="text-muted-foreground text-xs">
                Message identique que le compte existe ou non — aucune
                information sur l'existence d'un email n'est jamais révélée.
              </p>
            </div>

            <Button
              type="button"
              variant="link"
              className="mt-4 self-center"
              onClick={onBackToLogin}
            >
              ← Retour à la connexion
            </Button>
          </form>
        )}

        {step === 'reinitialisation' && (
          <form onSubmit={handleReset} className="flex flex-col px-9 pt-5 pb-9">
            <h1 className="mb-0.5 text-[21px] font-semibold">
              Nouveau mot de passe
            </h1>
            <p className="text-muted-foreground mb-5 text-[13px]">
              Si ce compte existe, un code de réinitialisation a été envoyé par
              email (valable 30 minutes).
            </p>

            <div className="mb-4 flex flex-col gap-1.5">
              <Label htmlFor="resetToken" className="text-[13px]">
                Code reçu par email
              </Label>
              <Input
                id="resetToken"
                className="bg-muted/40 h-10"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                required
              />
            </div>

            <div className="mb-1.5 flex flex-col gap-1.5">
              <Label htmlFor="nouveauMotDePasse" className="text-[13px]">
                Nouveau mot de passe
              </Label>
              <Input
                id="nouveauMotDePasse"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className="bg-muted/40 h-10"
                minLength={8}
                value={nouveauMotDePasse}
                onChange={(e) => setNouveauMotDePasse(e.target.value)}
                required
              />
            </div>
            <p className="text-muted-foreground mb-4 text-[11.5px]">
              Minimum 8 caractères, avec au moins une minuscule, une majuscule
              et un chiffre.
            </p>

            <div className="mb-1.5 flex flex-col gap-1.5">
              <Label htmlFor="confirmationMotDePasse" className="text-[13px]">
                Confirmer le mot de passe
              </Label>
              <Input
                id="confirmationMotDePasse"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className="bg-muted/40 h-10"
                aria-invalid={motsDePasseDifferents}
                value={confirmationMotDePasse}
                onChange={(e) => setConfirmationMotDePasse(e.target.value)}
                required
              />
            </div>
            {motsDePasseDifferents && (
              <p className="text-destructive mb-4 text-[11.5px]">
                Les mots de passe ne correspondent pas.
              </p>
            )}

            {error && !tokenError && (
              <p className="text-destructive mt-2 mb-1 text-sm">{error}</p>
            )}

            <Button
              type="submit"
              disabled={submitting || motsDePasseDifferents}
              className="mt-4 h-[42px]"
            >
              {submitting ? 'Mise à jour…' : 'Réinitialiser le mot de passe'}
            </Button>

            {tokenError && (
              <div className="border-destructive/30 bg-destructive/8 mt-4 rounded-lg border p-2.5">
                <p className="text-destructive text-xs">
                  Lien expiré ou déjà utilisé ? Refaites une demande depuis «
                  Mot de passe oublié ».
                </p>
              </div>
            )}

            <Button
              type="button"
              variant="link"
              className="mt-4 self-center"
              onClick={() => setStep('demande')}
            >
              ← Refaire une demande
            </Button>
          </form>
        )}

        {step === 'termine' && (
          <div className="flex flex-col items-center px-9 pt-5 pb-9 text-center">
            <h1 className="mb-0.5 text-[21px] font-semibold">
              Mot de passe mis à jour
            </h1>
            <p className="text-muted-foreground mb-6 text-[13px]">
              Vous pouvez maintenant vous connecter avec votre nouveau mot de
              passe.
            </p>
            <Button
              type="button"
              onClick={onBackToLogin}
              className="h-[42px] w-full"
            >
              Retour à la connexion
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
