// ------------------------------------------------------------------
// Page de connexion.
//
// Chaque agent ouvre sa propre session : le rôle est porté par le compte,
// pas choisi dans une liste au moment de l'utilisation. C'est la différence
// entre une démonstration et un logiciel réel — et la condition pour que le
// journal d'audit (BR-AUD-002) désigne quelqu'un.
//
// Démonstration : un mot de passe commun est affiché à l'écran, et chaque
// compte est proposé en un clic. En production : mot de passe individuel,
// verrouillage après échecs, double facteur pour la Direction.
// ------------------------------------------------------------------

import { useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { HOTEL, MOT_DE_PASSE_DEMO, PROFILS } from '../data';
import { useApp } from '../store';
import { Button, cx } from '../components/ui';

function Logo({ src, nom, grand = false }) {
  if (src) {
    return (
      <img
        src={src}
        alt={nom}
        className={cx('rounded-xl object-contain', grand ? 'size-16' : 'size-10')}
      />
    );
  }
  return (
    <div
      className={cx(
        'grid place-items-center rounded-xl bg-maj text-white shadow-card',
        grand ? 'size-16' : 'size-10',
      )}
    >
      <svg viewBox="0 0 32 32" className={grand ? 'size-10' : 'size-6'} aria-hidden>
        <path
          fill="currentColor"
          opacity="0.95"
          d="M16 2l3.2 6.6L26 6.6l-2 6.5 6.6 3.2-6.6 3.2 2 6.5-6.8-2L16 31l-3.2-6.9-6.8 2 2-6.5L1.4 16.6l6.6-3.2-2-6.5 6.8 2z"
        />
        <circle cx="16" cy="16.5" r="3.4" fill="var(--color-maj)" />
      </svg>
    </div>
  );
}

export function Login({ onConnecte }) {
  const { state, actions } = useApp();
  const hotel = state.parametres?.hotel ?? { nom: HOTEL.nom, logo: null };
  // La liste vient de l'état : un compte créé dans « Rôles & permissions »
  // est immédiatement utilisable ici, un compte désactivé disparaît.
  const comptes = (state.comptes ?? []).filter((c) => c.actif !== false);
  const [compte, setCompte] = useState(comptes[1]?.identifiant ?? comptes[0]?.identifiant ?? '');
  const [motDePasse, setMotDePasse] = useState('');
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const connexion = () => {
    const c = comptes.find((x) => x.identifiant === compte);
    if (!c) {
      setErreur('Compte inconnu.');
      return;
    }
    if (motDePasse !== MOT_DE_PASSE_DEMO) {
      setErreur('Mot de passe incorrect. En démonstration : makarim2026.');
      return;
    }
    setErreur('');
    setEnCours(true);
    // Petit délai : on montre l'appel réseau qu'il y aura en production.
    setTimeout(() => {
      actions.login(c);
      onConnecte?.();
    }, 380);
  };

  return (
    <div className="grid min-h-screen bg-sand-100 lg:grid-cols-[1.1fr_1fr]">
      {/* Colonne gauche : identité de l'établissement */}
      <div className="relative hidden overflow-hidden bg-ink px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 opacity-[0.13]" aria-hidden>
          <svg width="100%" height="100%">
            <defs>
              <pattern id="zellige-login" width="44" height="44" patternUnits="userSpaceOnUse">
                <path d="M22 0l22 22-22 22L0 22z" fill="none" stroke="white" strokeWidth="0.6" />
                <circle cx="22" cy="22" r="4" fill="none" stroke="white" strokeWidth="0.6" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#zellige-login)" />
          </svg>
        </div>

        <div className="relative flex items-center gap-3">
          <Logo src={hotel.logo} nom={hotel.nom} />
          <div>
            <p className="font-display text-[17px] leading-tight">{hotel.nom}</p>
            <p className="text-[11px] text-white/60">{HOTEL.categorie} · {HOTEL.ville} · Maroc</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="font-display text-[34px] leading-tight">
            30 chambres, un restaurant, une salle.
            <br />
            Un seul poste de travail.
          </h1>
          <p className="mt-4 text-[14px] leading-6 text-white/70">
            Réception, housekeeping, restauration, caisse et direction partagent la
            même journée d’exploitation. Chaque geste est tracé, chaque note se
            retrouve dans le folio du client.
          </p>
          <ul className="mt-6 space-y-2 text-[12px] text-white/60">
            <li>· Arrivées et départs en un clic, folio toujours à jour</li>
            <li>· Note restaurant portée en chambre, régie reversée au restaurant</li>
            <li>· Fiche de police, tours de quart et rapports imprimables</li>
          </ul>
        </div>

        <p className="relative text-[11px] text-white/40">
          Démonstration — données fictives, aucune information client réelle.
        </p>
      </div>

      {/* Colonne droite : formulaire */}
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo src={hotel.logo} nom={hotel.nom} />
            <div>
              <p className="font-display text-[16px] leading-tight">{hotel.nom}</p>
              <p className="text-[11px] text-ink-3">{HOTEL.categorie} · {HOTEL.ville}</p>
            </div>
          </div>

          <h2 className="font-display text-[26px] leading-tight text-ink">Connexion</h2>
          <p className="mt-1 text-[13px] text-ink-2">
            Identifiez-vous avec votre compte personnel.
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              connexion();
            }}
          >
            <div>
              <label htmlFor="login-compte" className="text-[12px] font-semibold text-ink-2">
                Compte
              </label>
              <select
                id="login-compte"
                value={compte}
                onChange={(e) => {
                  setCompte(e.target.value);
                  setErreur('');
                }}
                className="mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-[13px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
              >
                {comptes.map((c) => (
                  <option key={c.id} value={c.identifiant}>
                    {c.nom} — {PROFILS[c.profil].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="login-mdp" className="text-[12px] font-semibold text-ink-2">
                Mot de passe
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 py-2.5 focus-within:border-maj focus-within:ring-2 focus-within:ring-maj/25">
                <KeyRound className="size-4 text-ink-3" />
                <input
                  id="login-mdp"
                  type={voir ? 'text' : 'password'}
                  value={motDePasse}
                  onChange={(e) => {
                    setMotDePasse(e.target.value);
                    setErreur('');
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-transparent text-[13px] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setVoir((v) => !v)}
                  aria-label={voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="text-ink-3 hover:text-ink"
                >
                  {voir ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {erreur && (
              <p role="alert" className="rounded-lg bg-crimson-100 px-3 py-2 text-[12px] text-crimson">
                {erreur}
              </p>
            )}

            <Button type="submit" className="w-full justify-center" disabled={enCours}>
              {enCours ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
              {enCours ? 'Connexion…' : 'Ouvrir ma session'}
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-line bg-sand-50 px-3 py-2.5">
            <p className="text-[11px] leading-4 text-ink-2">
              <strong className="font-semibold text-ink">Démonstration :</strong> mot de passe{' '}
              <code className="rounded bg-surface px-1 py-0.5 text-[11px]">{MOT_DE_PASSE_DEMO}</code>{' '}
              pour tous les comptes. En production chaque agent a son propre mot de passe et la
              Direction un second facteur.
            </p>
          </div>

          <p className="mt-6 text-[11px] leading-4 text-ink-3">
            Le rôle attaché au compte détermine les écrans accessibles. Il est paramétrable par la
            Direction dans « Rôles & permissions ».
          </p>
        </div>
      </div>
    </div>
  );
}
