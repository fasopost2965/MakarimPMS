import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { login, rolesActifs } from '../api';
import { setTokens } from '@/lib/token-storage';
import type { RoleActif } from '../types';

interface Props {
  onLoginSuccess: () => void;
  onForgotPassword: () => void;
}

// Landing page dynamique par profil (cahier des charges §5.2.1) : les rôles
// affichés proviennent de GET /auth/roles-actifs — un rôle sans permission
// accordée (ex. Maintenance/RH tant que ces modules n'existent pas) ne
// s'affiche pas ici. Cette liste est informative ; l'authentification reste
// email + mot de passe, le rôle est déterminé côté serveur par le compte.
export function LoginPage({ onLoginSuccess, onForgotPassword }: Props) {
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
      const { accessToken, refreshToken } = await login(email, motDePasse);
      setTokens(accessToken, refreshToken);
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Hôtel Makarim</h1>
          <p className="text-muted-foreground text-sm">
            Système de gestion hôtelière
          </p>
        </div>

        {roles.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1">
            {roles.map((role) => (
              <Badge key={role.id} variant="outline">
                {role.nom}
              </Badge>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="motDePasse">Mot de passe</Label>
            <Input
              id="motDePasse"
              type="password"
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Connexion…' : 'Se connecter'}
          </Button>

          <Button
            type="button"
            variant="link"
            className="self-center"
            onClick={onForgotPassword}
          >
            Mot de passe oublié ?
          </Button>
        </form>
      </div>
    </div>
  );
}
