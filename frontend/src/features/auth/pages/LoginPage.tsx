import { useCallback, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Building2, Sparkles, UtensilsCrossed, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

// DESIGN-005 (intégration Prototype D3 validée, /design-preview/d3) —
// entrée par espace métier, purement visuelle : chaque tuile n'est affichée
// que si le rôle correspondant existe réellement côté serveur (GET
// /auth/roles-actifs, déjà appelé par ce composant avant ce lot), jamais
// une liste inventée. Sélectionner une tuile ne fait QUE remplacer le
// contenu du panneau de droite par le formulaire — cela ne modifie, ne
// présélectionne ni n'autorise rien : le formulaire reste email + mot de
// passe, soumis tel quel à POST /auth/login, et l'accès réel reste
// entièrement déterminé côté serveur par PermissionsGuard (RBAC), exactement
// comme avant ce lot.
//
// FINAL UI CLOSURE — le panneau de droite a une hauteur fixe
// (`min-h-[300px]`, identique que ce soit l'invite ou le formulaire) : la
// bascule invite → formulaire REMPLACE le contenu, elle ne l'allonge
// jamais — d'où le zéro scroll conservé sur 100vh à chaque état.
const ESPACES: {
  roleName: string;
  label: string;
  icon: LucideIcon;
  description: string;
}[] = [
  {
    roleName: 'Réception',
    label: 'Réception',
    icon: Users,
    description: 'Arrivées, départs, réservations',
  },
  {
    roleName: 'RESTAURATEUR',
    label: 'Restaurant',
    icon: UtensilsCrossed,
    description: 'Salle et service',
  },
  {
    roleName: 'Administrateur',
    label: 'Administration',
    icon: Building2,
    description: 'Paramètres, RH, finance',
  },
  {
    roleName: 'Gouvernante',
    label: 'Housekeeping',
    icon: Sparkles,
    description: 'Ménage et contrôle des chambres',
  },
];

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
  // Distinct de `roles.length === 0` : `roles` démarre vide AVANT que
  // l'appel réseau ait résolu, pas seulement quand il n'y a réellement
  // aucun rôle. Sans cette distinction, `showForm` ci-dessous bascule
  // brièvement à `true` (aucun espace connu au tout premier rendu) puis à
  // `false` dès que les rôles arrivent — un utilisateur assez rapide voit
  // le formulaire apparaître puis disparaître, remplacé par l'invite. Bug
  // réel corrigé ici (pas seulement un artefact de test e2e).
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [selectedEspace, setSelectedEspace] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    try {
      setRoles(await rolesActifs());
    } catch {
      // Non bloquant : la connexion reste possible même si cet appel échoue.
    } finally {
      setRolesLoaded(true);
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

  // Filtré contre les rôles réellement actifs — jamais affiché si le rôle
  // n'existe pas côté serveur (ex. instance sans module Restaurant activé).
  const espacesDisponibles = ESPACES.filter((espace) =>
    roles.some((r) => r.nom === espace.roleName),
  );

  // Le formulaire n'apparaît qu'après sélection d'un espace — sauf si
  // aucun espace n'est disponible UNE FOIS les rôles chargés (`rolesLoaded`)
  // : dans ce cas, aucune sélection n'est possible, le formulaire reste
  // donc directement accessible plutôt que de bloquer la connexion derrière
  // une étape impossible à franchir. Avant que les rôles n'aient résolu,
  // `espacesDisponibles` est vide sans qu'on sache encore s'il le restera —
  // le formulaire ne doit donc pas s'afficher prématurément (voir le
  // commentaire sur `rolesLoaded` plus haut).
  const showForm =
    selectedEspace !== null || (rolesLoaded && espacesDisponibles.length === 0);
  const selected = espacesDisponibles.find(
    (e) => e.roleName === selectedEspace,
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0b1220]">
      {/* Colonne espaces métier — largeur fixe, jamais affectée par l'état
          du formulaire à droite (zéro scroll desktop/laptop). Masquée sous
          `sm`, où le formulaire seul suffit. N'apparaît que si au moins un
          espace correspond à un rôle réellement actif. */}
      {espacesDisponibles.length > 0 && (
        <div className="hidden w-[340px] shrink-0 flex-col justify-center gap-8 border-r border-white/10 bg-[#0f1a2e] px-9 sm:flex">
          <div className="flex items-center gap-2.5 text-white">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="size-9 shrink-0 rounded-full object-contain"
              />
            ) : (
              <span className="border-primary-soft/30 bg-primary flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold">
                M
              </span>
            )}
            <span>
              <span className="block text-sm font-semibold tracking-[0.03em]">
                {raisonSociale ?? 'Hôtel Makarim'}
              </span>
              <span className="block text-[11px] text-white/45">
                PMS · Tétouan
              </span>
            </span>
          </div>

          <div>
            <h1 className="text-lg font-semibold text-white">
              Choisissez votre espace
            </h1>
            <p className="mt-1 text-[12px] leading-relaxed text-white/45">
              L'accès réel reste déterminé par votre compte, quel que soit
              l'espace sélectionné.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            {espacesDisponibles.map((espace) => {
              const Icon = espace.icon;
              const active = selectedEspace === espace.roleName;
              return (
                <button
                  key={espace.roleName}
                  type="button"
                  onClick={() => setSelectedEspace(espace.roleName)}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-[var(--duration-fast)] ${
                    active
                      ? 'border-primary bg-primary/15'
                      : 'border-white/10 hover:border-white/25 hover:bg-white/[0.04]'
                  }`}
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-white/10 text-white/70'
                    }`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-white">
                      {espace.label}
                    </span>
                    <span className="block truncate text-[10.5px] leading-tight text-white/45">
                      {espace.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Colonne formulaire — toujours visible, jamais masquée derrière une
          sélection d'espace (la sélection ci-dessus reste une pure mise en
          évidence). Emplacement réservé à une photographie officielle de
          l'hôtel (DESIGN ONLY, fond neutre en attendant l'asset). */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden p-8"
        style={{
          background:
            'radial-gradient(120% 100% at 70% 20%, #16233c 0%, #0b1220 65%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 72px)',
          }}
        />

        {/* Repli mobile/tablette : branding + sélecteur compact au-dessus
            du panneau (invite ou formulaire), seulement si des espaces sont
            disponibles. */}
        <div className="relative flex w-full max-w-[420px] flex-col items-center gap-5 sm:hidden">
          <div className="flex items-center gap-2 text-white">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="size-8 shrink-0 rounded-full object-contain"
              />
            ) : (
              <span className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                M
              </span>
            )}
            <span className="text-sm font-semibold">
              {raisonSociale ?? 'Hôtel Makarim'}
            </span>
          </div>
          {espacesDisponibles.length > 0 && (
            <div className="grid w-full grid-cols-2 gap-2">
              {espacesDisponibles.map((espace) => {
                const Icon = espace.icon;
                const active = selectedEspace === espace.roleName;
                return (
                  <button
                    key={espace.roleName}
                    type="button"
                    onClick={() => setSelectedEspace(espace.roleName)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center ${active ? 'border-primary bg-primary/15' : 'border-white/10'}`}
                  >
                    <Icon className="size-4 text-white/80" />
                    <span className="text-[11px] font-semibold text-white">
                      {espace.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Panneau de droite — hauteur fixe (min-h-[300px]) identique pour
            l'invite et le formulaire : la bascule REMPLACE le contenu,
            jamais ne l'allonge (FINAL UI CLOSURE, zéro scroll conservé). */}
        <div className="relative flex min-h-[300px] w-full max-w-[380px] flex-col justify-center rounded-2xl border border-white/10 bg-[#0f1a2e] p-7 shadow-2xl sm:mt-0">
          {showForm ? (
            <>
              {selected && (
                <div className="mb-1 flex items-center gap-2">
                  <span className="bg-primary/20 text-primary flex size-7 items-center justify-center rounded-lg">
                    <selected.icon className="size-3.5" />
                  </span>
                  <p className="text-sm font-semibold text-white">
                    {selected.label}
                  </p>
                </div>
              )}
              <h2 className="text-lg font-semibold text-white">Connexion</h2>
              <p className="mt-0.5 mb-5 text-[12.5px] text-white/45">
                Entrez vos identifiants pour continuer
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email" className="text-[12px] text-white/70">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="vous@hotelmakarim.com"
                    className="h-10 border-white/15 bg-white/[0.05] text-white placeholder:text-white/30"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="motDePasse"
                    className="text-[12px] text-white/70"
                  >
                    Mot de passe
                  </Label>
                  <Input
                    id="motDePasse"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-10 border-white/15 bg-white/[0.05] text-white placeholder:text-white/30"
                    value={motDePasse}
                    onChange={(e) => setMotDePasse(e.target.value)}
                    required
                  />
                </div>

                {error && <p className="text-destructive text-sm">{error}</p>}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="mt-1 h-11"
                >
                  {submitting ? 'Connexion…' : 'Se connecter'}
                </Button>

                <div className="flex items-center justify-between">
                  {espacesDisponibles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedEspace(null)}
                      className="text-left text-[11px] text-white/40 hover:text-white/70"
                    >
                      ← Changer d'espace
                    </button>
                  )}
                  <Button
                    type="button"
                    variant="link"
                    className="ml-auto text-white/50 hover:text-white"
                    onClick={onForgotPassword}
                  >
                    Mot de passe oublié ?
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="bg-white/5 text-white/30 flex size-11 items-center justify-center rounded-full">
                <Users className="size-5" />
              </span>
              <p className="text-sm font-medium text-white/60">
                Sélectionnez un espace
              </p>
              <p className="text-[11.5px] text-white/35">
                Le formulaire de connexion apparaît ici.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
