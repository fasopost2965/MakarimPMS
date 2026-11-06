// ------------------------------------------------------------------
// Page de connexion.
//
// Chaque agent ouvre sa propre session : le rôle est porté par le compte,
// pas choisi dans une liste au moment de l'utilisation. C'est la différence
// entre une démonstration et un logiciel réel · et la condition pour que le
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
        className={cx('rounded-lg object-contain', grand ? 'size-16' : 'size-10')}
      />
    );
  }
  return (
    <div
      className={cx(
        'grid place-items-center rounded-lg bg-maj text-white',
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
  // Identité affichée à gauche : rien n'est écrit en dur, tout vient des
  // paramètres (« Tarifs & paramètres » > Identité de l'établissement).
  const fiche = {
    nom: hotel.nom ?? HOTEL.nom,
    categorie: hotel.categorie ?? HOTEL.categorie,
    ville: hotel.ville ?? HOTEL.ville,
    adresse: hotel.adresse ?? HOTEL.adresse,
    telephone: hotel.telephone ?? '',
    email: hotel.email ?? '',
  };
  const salle = (state.parametres?.salles ?? []).find((x) => x.active !== false);
  const lignes = [
    fiche.adresse && { cle: 'adresse', label: 'Adresse', valeur: fiche.adresse },
    fiche.telephone && { cle: 'telephone', label: 'Téléphone', valeur: fiche.telephone },
    fiche.email && { cle: 'email', label: 'Courriel', valeur: fiche.email },
  ].filter(Boolean);
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
    <div className="grid min-h-screen bg-mist-100 lg:grid-cols-[1.1fr_1fr]">
      {/* Colonne gauche : carte d'identité de l'établissement, alimentée par
          les paramètres. Aucun argument commercial : nom, coordonnées et
          capacité réelle, comme sur la façade. */}
      <div className="relative hidden overflow-hidden bg-nav px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="relative flex items-center gap-3">
          <Logo src={hotel.logo} nom={fiche.nom} />
          <div>
            <p className="font-display text-[17px] leading-tight text-white">{fiche.nom}</p>
            <p className="text-[12px] text-white/55">
              {fiche.categorie} · {fiche.ville} · Maroc
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <p className="font-display text-[40px] leading-[1.1] tracking-[-0.5px] text-white">
            {fiche.nom}
          </p>
          <p className="mt-2 text-[19px] leading-[1.4] text-white/70">
            {fiche.categorie} · {fiche.ville}
          </p>
          <dl className="mt-8 space-y-3 border-t border-white/10 pt-6">
            {lignes.map((l) => (
              <div key={l.cle} className="flex gap-4">
                <dt className="w-24 shrink-0 text-[12px] tracking-[0.02em] text-white/40 uppercase">
                  {l.label}
                </dt>
                <dd className="min-w-0 flex-1 text-[14px] text-white/85">{l.valeur}</dd>
              </div>
            ))}
            <div className="flex gap-4">
              <dt className="w-24 shrink-0 text-[12px] tracking-[0.02em] text-white/40 uppercase">
                Capacité
              </dt>
              <dd className="min-w-0 flex-1 text-[14px] text-white/85">
                {state.chambres.length} chambres
                {salle ? ` · ${salle.nom} (${salle.capacite} places)` : ''}
              </dd>
            </div>
          </dl>
        </div>

        <p className="relative text-[12px] text-white/35">
          Démonstration : données fictives, aucune information client réelle.
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

          <h2 className="font-display text-[32px] leading-[1.1] tracking-[-0.374px] text-ink">Connexion</h2>
          <p className="mt-2 text-[15px] text-ink-2">
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
              <label htmlFor="login-compte" className="text-[13px] font-medium text-ink-2">
                Compte
              </label>
              <select
                id="login-compte"
                value={compte}
                onChange={(e) => {
                  setCompte(e.target.value);
                  setErreur('');
                }}
                className="mt-2 h-11 w-full rounded-[11px] border border-line-strong bg-surface px-3 text-[15px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/20"
              >
                {comptes.map((c) => (
                  <option key={c.id} value={c.identifiant}>
                    {c.nom} · {PROFILS[c.profil].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="login-mdp" className="text-[13px] font-medium text-ink-2">
                Mot de passe
              </label>
              <div className="mt-2 flex h-11 items-center gap-2 rounded-[11px] border border-line-strong bg-surface px-3 focus-within:border-maj focus-within:ring-2 focus-within:ring-maj/20">
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
                  className="w-full bg-transparent text-[15px] outline-none"
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

            <Button type="submit" size="lg" className="w-full justify-center" disabled={enCours}>
              {enCours ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
              {enCours ? 'Connexion…' : 'Ouvrir ma session'}
            </Button>
          </form>

          <div className="mt-6 rounded-[11px] border border-line bg-mist-50 px-3 py-2.5">
            <p className="text-[12px] leading-[1.5] text-ink-2">
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
