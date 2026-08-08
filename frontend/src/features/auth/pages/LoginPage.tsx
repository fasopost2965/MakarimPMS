import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { login, rolesActifs } from '../api';
import { setCsrfToken, setLoggedInHint } from '@/lib/token-storage';
import type { RoleActif } from '../types';

interface Props {
  onLoginSuccess: () => void;
  onForgotPassword: () => void;
  // Design Marine & Or — logo/nom configurables (GET /parameters/branding,
  // Paramètres), chargés avant authentification (route @Public()). `null`/
  // absent tant que non chargé ou non configuré : fallback sur le nom en
  // dur "Hôtel Makarim", jamais de plantage sur un logo absent.
  logoUrl?: string | null;
  raisonSociale?: string;
}

// Landing page dynamique par profil (cahier des charges §5.2.1) : les rôles
// affichés proviennent de GET /auth/roles-actifs — un rôle sans permission
// accordée (ex. Maintenance/RH tant que ces modules n'existent pas) ne
// s'affiche pas ici. Cette liste est informative ; l'authentification reste
// email + mot de passe, le rôle est déterminé côté serveur par le compte.
export function LoginPage({
  onLoginSuccess,
  onForgotPassword,
  logoUrl,
  raisonSociale,
}: Props) {
  const [roles, setRoles] = useState<RoleActif[]>([]);
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    try {
      setRoles(await rolesActifs());
    } catch {
      // Non bloquant : la connexion reste possible même si cet appel échoue.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRoles();
  }, [loadRoles]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { csrfToken } = await login(email, motDePasse);
      setCsrfToken(csrfToken);
      setLoggedInHint();
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-muted flex h-screen items-center justify-center p-6">
      <div className="bg-card flex w-full max-w-[420px] flex-col overflow-hidden rounded-xl shadow-[var(--shadow-elevated)]">
        {/* Liseré de marque — DESIGN-002 (§1.1) : le dégradé marine → or a
            été remplacé par une variation d'intensité de --primary, l'or
            n'existant plus dans le design system 2026. */}
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

        <form onSubmit={handleSubmit} className="flex flex-col px-9 pt-5 pb-9">
          <h1 className="mb-0.5 text-[21px] font-semibold">Connexion</h1>
          <p className="text-muted-foreground mb-5 text-[13px]">
            Entrez vos identifiants pour continuer
          </p>

          {roles.length > 0 && (
            <div className="mb-[22px] flex flex-wrap gap-1.5">
              {roles.map((role) => (
                <Badge
                  key={role.id}
                  variant="outline"
                  className="bg-primary/10 text-primary border-transparent"
                >
                  {role.nom}
                </Badge>
              ))}
            </div>
          )}

          <div className="mb-4 flex flex-col gap-1.5">
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
          <div className="mb-6 flex flex-col gap-1.5">
            <Label htmlFor="motDePasse" className="text-[13px]">
              Mot de passe
            </Label>
            <Input
              id="motDePasse"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="bg-muted/40 h-10"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-destructive mb-4 text-sm">{error}</p>}

          <Button type="submit" disabled={submitting} className="h-[42px]">
            {submitting ? 'Connexion…' : 'Se connecter'}
          </Button>

          <Button
            type="button"
            variant="link"
            className="mt-4 self-center"
            onClick={onForgotPassword}
          >
            Mot de passe oublié ?
          </Button>
        </form>
      </div>
    </div>
  );
}
