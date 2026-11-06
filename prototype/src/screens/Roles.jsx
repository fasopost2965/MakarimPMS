// ------------------------------------------------------------------
// Rôles & permissions · paramétrage par la Direction.
//
// La matrice RBAC n'est pas figée dans le code : la Direction ouvre ou ferme
// chaque écran pour chaque rôle, et la navigation se recalcule immédiatement
// pour les profils concernés. C'est un miroir de démonstration : en production
// le serveur reste seul juge (BR-TR-004) · l'écran ne fait que préparer la
// décision, il ne la remplace pas. Toute modification est journalisée
// (BR-AUD-002).
//
// Garde-fous appliqués ici :
//  - un rôle doit conserver au moins un écran, sinon on le rend inutilisable ;
//  - la Direction ne peut pas se retirer l'accès aux rôles (verrou anti-lockout) ;
//  - toute modification est journalisée et tracée dans l'écran.
// ------------------------------------------------------------------

import { Fragment, useMemo, useState } from 'react';
import { KeyRound, Lock, Plus, RotateCcw, Save, ShieldCheck, TriangleAlert, UserPlus } from 'lucide-react';
import { PERMISSIONS, PROFILS } from '../data';
import { useApp } from '../store';
import { Button, Card, CardHeader, Modal, Pill, cx, useToast } from '../components/ui';

export function Roles() {
  const { state, actions } = useApp();
  const { push } = useToast();

  const [brouillon, setBrouillon] = useState(() => structuredClone(state.roles));
  const [modifie, setModifie] = useState(false);
  const [creationCompte, setCreationCompte] = useState(false);
  const [nouveauCompte, setNouveauCompte] = useState({ nom: '', identifiant: '', email: '', profil: 'reception' });

  const roles = useMemo(() => Object.keys(PROFILS), []);
  const groupes = useMemo(() => {
    const acc = {};
    for (const p of PERMISSIONS) (acc[p.groupe] = acc[p.groupe] ?? []).push(p);
    return acc;
  }, []);

  const basculer = (role, ecran) => {
    setModifie(true);
    setBrouillon((b) => {
      const ecrans = b[role].ecrans.includes(ecran)
        ? b[role].ecrans.filter((e) => e !== ecran)
        : [...b[role].ecrans, ecran];
      return { ...b, [role]: { ...b[role], ecrans } };
    });
  };

  const basculerMontants = (role) => {
    setModifie(true);
    setBrouillon((b) => ({ ...b, [role]: { ...b[role], montants: !b[role].montants } }));
  };

  // Un rôle sans écran ne peut plus rien faire : blocage avant enregistrement.
  const rolesVides = roles.filter((r) => brouillon[r].ecrans.length === 0);
  const directionSansRoles = !brouillon.direction.ecrans.includes('roles');

  const enregistrer = () => {
    if (rolesVides.length > 0) {
      push(`Impossible : ${rolesVides.map((r) => PROFILS[r].label).join(', ')} n’a plus aucun écran.`, 'info');
      return;
    }
    if (directionSansRoles) {
      push('Impossible : la Direction doit conserver l’accès aux rôles (verrou anti-lockout).', 'info');
      return;
    }
    actions.setRoles(brouillon);
    setModifie(false);
    push('Matrice des rôles enregistrée · navigation recalculée pour chaque profil.', 'success');
  };

  const reinitialiser = () => {
    const defauts = Object.fromEntries(
      Object.entries(PROFILS).map(([cle, p]) => [cle, { ecrans: [...p.ecrans], montants: p.montants }]),
    );
    setBrouillon(defauts);
    setModifie(true);
    push('Matrice ramenée aux valeurs documentées (non enregistré).', 'info');
  };

  return (
    <div className="space-y-4 px-4 py-5 sm:px-6">
      <Card>
        <CardHeader
          titre="Matrice des rôles"
          sousTitre="Cocher les écrans ouverts à chaque rôle · le serveur reste seul juge en production"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={reinitialiser}>
                <RotateCcw className="size-3.5" /> Valeurs documentées
              </Button>
              <Button onClick={enregistrer} disabled={!modifie}>
                <Save className="size-3.5" /> Enregistrer
              </Button>
            </div>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-surface px-5 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
                  Écran
                </th>
                {roles.map((r) => (
                  <th key={r} className="px-2 py-3 text-center text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
                    {PROFILS[r].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupes).map(([groupe, perms]) => (
                <Fragment key={groupe}>
                  <tr>
                    <td
                      colSpan={roles.length + 1}
                      className="sticky left-0 bg-mist-50 px-5 py-1.5 text-[11px] font-semibold tracking-[0.1em] text-ink-3 uppercase"
                    >
                      {groupe}
                    </td>
                  </tr>
                  {perms.map((p) => (
                    <tr key={p.cle} className="border-b border-line-soft last:border-0">
                      <td className="sticky left-0 z-10 bg-surface px-5 py-2 text-ink-2">{p.label}</td>
                      {roles.map((r) => {
                        const coche = brouillon[r].ecrans.includes(p.cle);
                        const verrou = r === 'direction' && p.cle === 'roles';
                        return (
                          <td key={`${r}-${p.cle}`} className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => !verrou && basculer(r, p.cle)}
                              disabled={verrou}
                              aria-pressed={coche}
                              aria-label={`${p.label} pour ${PROFILS[r].label}`}
                              className={cx(
                                'mx-auto grid size-5 place-items-center rounded border transition-colors',
                                coche ? 'border-maj bg-maj text-white' : 'border-line-strong bg-surface text-transparent',
                                verrou && 'cursor-not-allowed opacity-70',
                              )}
                            >
                              <span className="text-[11px] leading-none">✓</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr className="border-t border-line">
                <td className="sticky left-0 z-10 bg-surface px-5 py-2.5 text-[12px] font-medium text-ink">
                  Voir les montants
                </td>
                {roles.map((r) => (
                  <td key={`m-${r}`} className="px-2 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => basculerMontants(r)}
                      aria-pressed={brouillon[r].montants}
                      aria-label={`Montants visibles pour ${PROFILS[r].label}`}
                      className={cx(
                        'mx-auto grid size-5 place-items-center rounded border transition-colors',
                        brouillon[r].montants
                          ? 'border-maj bg-maj text-white'
                          : 'border-line-strong bg-surface text-transparent',
                      )}
                    >
                      <span className="text-[11px] leading-none">✓</span>
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {(rolesVides.length > 0 || directionSansRoles) && (
        <div className="flex items-start gap-2 rounded-lg border border-crimson/40 bg-crimson-100/50 p-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-crimson" />
          <p className="text-[12px] leading-5 text-ink">
            {rolesVides.length > 0 && (
              <>{rolesVides.map((r) => PROFILS[r].label).join(', ')} n’a plus aucun écran. </>
            )}
            {directionSansRoles && <>La Direction a perdu l’accès aux rôles (verrou anti-lockout). </>}
            Corrigez avant d’enregistrer.
          </p>
        </div>
      )}

      {/* Effet immédiat : la navigation de chaque rôle ---------------------- */}
      <Card>
        <CardHeader
          titre="Navigation résultante"
          sousTitre="Ce que chaque agent verra dans la barre latérale après enregistrement"
        />
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => (
            <div key={r} className="rounded-lg border border-line bg-mist-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-semibold text-ink">{PROFILS[r].label}</p>
                <Pill tone={brouillon[r].montants ? 'maj' : 'neutral'}>
                  {brouillon[r].montants ? 'montants visibles' : 'sans montants'}
                </Pill>
              </div>
              <p className="mt-1 text-[11px] text-ink-3">{PROFILS[r].personne}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {brouillon[r].ecrans.length === 0 && (
                  <span className="text-[11px] text-crimson">aucun écran</span>
                )}
                {brouillon[r].ecrans.map((e) => (
                  <span key={e} className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink-2">
                    {PERMISSIONS.find((p) => p.cle === e)?.label ?? e}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Comptes nominatifs : le rôle est porté par le compte, pas choisi à la
          connexion. Créer un agent ici le rend immédiatement connectable. */}
      <Card>
        <CardHeader
          titre="Comptes agents"
          sousTitre={`${(state.comptes ?? []).filter((c) => c.actif !== false).length} compte(s) actif(s) · un compte par agent, un rôle par compte`}
          action={
            <Button size="sm" onClick={() => setCreationCompte(true)}>
              <UserPlus className="size-3.5" /> Nouvel utilisateur
            </Button>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-line-soft text-[11px] tracking-[0.08em] text-ink-3 uppercase">
                <th className="px-5 py-2 font-semibold">Agent</th>
                <th className="px-3 py-2 font-semibold">Identifiant</th>
                <th className="px-3 py-2 font-semibold">Rôle</th>
                <th className="px-3 py-2 font-semibold">Session</th>
                <th className="px-5 py-2 text-right font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {(state.comptes ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-mist-50/60">
                  <td className="px-5 py-2.5">
                    <p className="font-medium text-ink">{c.nom}</p>
                    <p className="text-[11px] text-ink-3">{c.email || 'sans adresse'}</p>
                  </td>
                  <td className="px-3 py-2.5 text-ink-2">{c.identifiant}</td>
                  <td className="px-3 py-2.5">
                    <select
                      aria-label={`Rôle de ${c.nom}`}
                      value={c.profil}
                      onChange={(e) => actions.majCompte(c.id, { profil: e.target.value })}
                      className="rounded-lg border border-line-strong bg-surface px-2 py-1 text-[11px] text-ink-2 outline-none focus:border-maj"
                    >
                      {Object.entries(PROFILS).map(([cle, p]) => (
                        <option key={cle} value={cle}>{p.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-ink-3">
                    {state.session?.compteId === c.id ? 'ouverture en cours' : 'nc'}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => actions.majCompte(c.id, { actif: c.actif === false })}
                      className={cx(
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium',
                        c.actif === false
                          ? 'border-crimson/30 bg-crimson-100 text-crimson'
                          : 'border-jade/30 bg-jade-100 text-jade',
                      )}
                    >
                      {c.actif === false ? 'Désactivé' : 'Actif'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line-soft px-5 py-3">
          <p className="flex items-start gap-2 text-[11px] leading-4 text-ink-3">
            <KeyRound className="mt-0.5 size-3.5 shrink-0" />
            Démonstration : mot de passe commun <code className="rounded bg-mist-100 px-1">makarim2026</code>.
            En production : mot de passe individuel haché, verrouillage après échecs et second facteur
            pour la Direction.
          </p>
        </div>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-line bg-mist-50 p-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink-3" />
        <p className="text-[12px] leading-5 text-ink-2">
          Le paramétrage est enregistré avec l’état de la démonstration et se répercute immédiatement
          sur le sélecteur de profil. En production, la même matrice est appliquée côté serveur : une
          route fermée ici reste refusée même si l’appel est forgé à la main.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-line bg-surface p-3">
        <Lock className="mt-0.5 size-4 shrink-0 text-ink-3" />
        <p className="text-[12px] leading-5 text-ink-2">
          Verrou anti-lockout : la Direction conserve toujours l’accès à cet écran. Aucun rôle ne peut
          être enregistré sans au moins un écran · un rôle vide serait un compte inutilisable, pas un
          compte restreint.
        </p>
      </div>

      <Modal
        open={creationCompte}
        onClose={() => setCreationCompte(false)}
        title="Nouvel utilisateur"
        subtitle="Le rôle détermine les écrans accessibles dès la première connexion"
        width="max-w-md"
        footer={
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => setCreationCompte(false)}>Annuler</Button>
            <Button
              disabled={
                !nouveauCompte.nom.trim() ||
                !nouveauCompte.identifiant.trim() ||
                (state.comptes ?? []).some(
                  (c) => c.identifiant.toLowerCase() === nouveauCompte.identifiant.trim().toLowerCase(),
                )
              }
              onClick={() => {
                actions.creerCompte({
                  nom: nouveauCompte.nom.trim(),
                  identifiant: nouveauCompte.identifiant.trim(),
                  email: nouveauCompte.email.trim(),
                  profil: nouveauCompte.profil,
                });
                push(`Compte créé · ${nouveauCompte.nom.trim()} (${PROFILS[nouveauCompte.profil].label}).`, 'success');
                setNouveauCompte({ nom: '', identifiant: '', email: '', profil: 'reception' });
                setCreationCompte(false);
              }}
            >
              <Plus className="size-3.5" /> Créer le compte
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <div>
            <label htmlFor="u-nom" className="text-[12px] font-semibold text-ink-2">Nom et prénom</label>
            <input
              id="u-nom"
              autoFocus
              value={nouveauCompte.nom}
              onChange={(e) => setNouveauCompte((c) => ({ ...c, nom: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
            />
          </div>
          <div>
            <label htmlFor="u-ident" className="text-[12px] font-semibold text-ink-2">Identifiant de connexion</label>
            <input
              id="u-ident"
              value={nouveauCompte.identifiant}
              onChange={(e) => setNouveauCompte((c) => ({ ...c, identifiant: e.target.value }))}
              placeholder="prenom.nom"
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
            />
            {(state.comptes ?? []).some(
              (c) => c.identifiant.toLowerCase() === nouveauCompte.identifiant.trim().toLowerCase(),
            ) && <p className="mt-1 text-[11px] text-crimson">Cet identifiant est déjà pris.</p>}
          </div>
          <div>
            <label htmlFor="u-email" className="text-[12px] font-semibold text-ink-2">Adresse e-mail</label>
            <input
              id="u-email"
              type="email"
              value={nouveauCompte.email}
              onChange={(e) => setNouveauCompte((c) => ({ ...c, email: e.target.value }))}
              placeholder="prenom.nom@hotel-makarim.ma"
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
            />
          </div>
          <div>
            <label htmlFor="u-role" className="text-[12px] font-semibold text-ink-2">Rôle</label>
            <select
              id="u-role"
              value={nouveauCompte.profil}
              onChange={(e) => setNouveauCompte((c) => ({ ...c, profil: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
            >
              {Object.entries(PROFILS).map(([cle, p]) => (
                <option key={cle} value={cle}>{p.label}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-ink-3">
              Écrans ouverts par défaut : {(PROFILS[nouveauCompte.profil]?.ecrans ?? []).length}  · 
              ajustables dans la matrice ci-dessous.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
