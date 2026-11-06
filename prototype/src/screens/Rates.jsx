// ------------------------------------------------------------------
// Tarifs & paramètres — tout ce qui doit changer sans redéploiement.
//
// Grille tarifaire éditable puis **publiée** (c'est la publication qui rend
// les prix effectifs), coefficients de saison, forfait demi-journée, identité
// de l'établissement (nom, logo) et fonctionnalités activables.
//
// Règles matérialisées : BR-TR-003 (aucun taux ni tarif codé en dur),
// BR-AUD-002 (publication journalisée et versionnée), BR-FAC-007 (taxe de
// séjour), BR-TR-004 (les options n'enlèvent jamais un droit, elles masquent
// un module).
// ------------------------------------------------------------------

import { useMemo, useRef, useState } from 'react';
import {
  Building2, CheckCircle2, ImagePlus, KeyRound, Lock, Percent, Receipt, Save,
  ShieldAlert, ShieldCheck, Sun, Trash2, Unlock,
} from 'lucide-react';
import { FORMULES, HOTEL, PARAMS, POLITIQUE, TYPES_CHAMBRE } from '../data';
import { useApp } from '../store';
import { fmtLong, money } from '../lib/date';
import { Button, Card, CardHeader, Modal, Pill, cx, useToast } from '../components/ui';
import { InfoBulle } from '../components/InfoBulle';

const OPTIONS = [
  { cle: 'dayUse', label: 'Séjours à la demi-journée', detail: 'Matinée ou après-midi, forfait fixe sans nuitée.' },
  { cle: 'minibar', label: 'Minibar lié aux chambres', detail: 'Consommation déclarée depuis le plan des chambres, portée au folio.' },
  { cle: 'stock', label: 'Gestion de stock', detail: 'Inventaire, seuils critiques et mouvements.' },
  { cle: 'channelManager', label: 'Channel manager', detail: 'Connexion aux plateformes de distribution.' },
  { cle: 'fichePolice', label: 'Fiches de police', detail: 'Registre d’hébergement et impression.' },
  { cle: 'tournees', label: 'Tours de quart', detail: 'Relève des trois shifts et cahier de transmission.' },
];

// Code de déverrouillage de la grille. En production, il s'agit du second
// facteur du directeur (mot de passe + OTP) ; ici, un code d'exploitation
// annoncé à l'écran pour que la démonstration reste praticable.
const CODE_VERROU = 'MAKARIM';

// Champs fiscaux éditables. Les taux sont des pourcentages, la taxe de séjour
// et le plafond d'espèces sont en dirhams.
const CHAMPS_FISCAUX = {
  tvaHebergement: { label: 'TVA hébergement & pensions', suffixe: '%' },
  tvaAnnexe: { label: 'TVA restauration & annexes', suffixe: '%' },
  tvaSalle: { label: 'TVA salle de conférence', suffixe: '%' },
  taxeSejour: { label: 'Taxe de séjour / nuit / adulte', suffixe: 'MAD' },
  plafondEspeces: { label: 'Plafond espèces', suffixe: 'MAD' },
};

export function Rates() {
  const { state, actions } = useApp();
  const { push } = useToast();
  const fichierLogo = useRef(null);

  const params = state.parametres;
  const [grille, setGrille] = useState(() => structuredClone(params.grille));
  const [saisons, setSaisons] = useState(() => structuredClone(params.saisons));
  const [demiJournee, setDemiJournee] = useState(params.demiJournee);
  const [nomHotel, setNomHotel] = useState(params.hotel.nom);
  const [fiscalite, setFiscalite] = useState(() => ({ ...params.fiscalite }));
  const [deverrouille, setDeverrouille] = useState(false);
  const [demandeCode, setDemandeCode] = useState(false);
  const [codeSaisi, setCodeSaisi] = useState('');
  const [confirmation, setConfirmation] = useState(false); // publication de la grille
  const [confirmationFiscale, setConfirmationFiscale] = useState(false);

  // Tant que la grille est verrouillée, les prix ne sont pas éditables : une
  // erreur de tarif se paie en chambres vendues à perte.
  const verrouille = Boolean(params.verrouTarifs) && !deverrouille;

  const modifie = useMemo(
    () => JSON.stringify({ grille, saisons, demiJournee }) !== JSON.stringify({
      grille: params.grille,
      saisons: params.saisons,
      demiJournee: params.demiJournee,
    }),
    [grille, saisons, demiJournee, params],
  );

  const erreurs = useMemo(() => {
    const e = [];
    for (const [cle, g] of Object.entries(grille)) {
      const v = Number(g.prix);
      if (!Number.isFinite(v) || v <= 0) e.push(`${TYPES_CHAMBRE[cle].label} : prix invalide`);
    }
    for (const s of saisons) {
      const c = Number(s.coef);
      if (!Number.isFinite(c) || c < 0.5 || c > 3) e.push(`${s.nom} : coefficient hors bornes (0,5 – 3)`);
    }
    if (!Number.isFinite(Number(demiJournee)) || Number(demiJournee) <= 0) {
      e.push('Forfait demi-journée invalide');
    }
    return e;
  }, [grille, saisons, demiJournee]);

  const publier = () => {
    if (erreurs.length > 0) {
      push(`Publication impossible : ${erreurs[0]}.`, 'info');
      return;
    }
    // Rien ne s'écrit sans une seconde validation explicite : le récapitulatif
    // des écarts est présenté avant d'engager la version suivante.
    setConfirmation(true);
  };

  const appliquerGrille = () => {
    actions.publierGrille(grille, saisons, Number(demiJournee), state.session?.nom ?? 'Direction');
    push(
      `Grille publiée — version ${params.version + 1}. Les nouveaux prix s’appliquent dès la prochaine réservation.`,
      'success',
    );
    setConfirmation(false);
  };

  const enregistrerFiscalite = () => {
    actions.setFiscalite(
      Object.fromEntries(
        Object.keys(CHAMPS_FISCAUX).map((cle) => [cle, Number(fiscalite[cle])]),
      ),
    );
    push('Fiscalité enregistrée — les prochaines écritures utilisent les nouveaux taux.', 'success');
    setConfirmationFiscale(false);
  };

  const chargerLogo = (fichier) => {
    if (!fichier) return;
    if (fichier.size > 400_000) {
      push('Logo trop lourd (400 Ko maximum).', 'info');
      return;
    }
    const lecteur = new FileReader();
    lecteur.onload = () => {
      actions.setHotel({ logo: String(lecteur.result) });
      push('Logo de l’établissement mis à jour.', 'success');
    };
    lecteur.readAsDataURL(fichier);
  };

  const ecarts = useMemo(() => {
    const liste = [];
    for (const [cle, g] of Object.entries(grille)) {
      const avant = Number(params.grille[cle]?.prix);
      const apres = Number(g.prix);
      if (avant !== apres) {
        liste.push({ label: TYPES_CHAMBRE[cle].label, avant: `${money(avant)} MAD`, apres: `${money(apres)} MAD` });
      }
    }
    saisons.forEach((s, i) => {
      const avant = params.saisons[i];
      if (!avant) return;
      if (Number(avant.coef) !== Number(s.coef)) {
        liste.push({ label: `Coefficient ${s.nom}`, avant: `× ${avant.coef}`, apres: `× ${s.coef}` });
      }
    });
    if (Number(params.demiJournee) !== Number(demiJournee)) {
      liste.push({
        label: 'Forfait demi-journée',
        avant: `${money(params.demiJournee)} MAD`,
        apres: `${money(Number(demiJournee))} MAD`,
      });
    }
    return liste;
  }, [grille, saisons, demiJournee, params]);

  const ecartsFiscaux = useMemo(() => {
    const liste = [];
    for (const [cle, meta] of Object.entries(CHAMPS_FISCAUX)) {
      const avant = params.fiscalite?.[cle];
      const apres = fiscalite[cle];
      if (String(avant) !== String(apres)) {
        liste.push({ label: meta.label, avant: `${meta.suffixe === '%' ? `${avant} %` : `${money(avant)} MAD`}`, apres: `${meta.suffixe === '%' ? `${apres} %` : `${money(apres)} MAD`}` });
      }
    }
    return liste;
  }, [fiscalite, params]);

  const totalChambres = state.chambres.filter((c) => c.active !== false).length;

  return (
    <div className="space-y-4 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.1em] text-ink-3 uppercase">Administration · Référentiel</p>
          <h2 className="font-display mt-1 text-[26px] leading-tight">Tarifs & paramètres</h2>
          <p className="mt-1 max-w-2xl text-[14px] text-ink-2">
            Grille, saisons, forfaits, identité et modules. Rien n’est codé en dur : ce que vous
            publiez ici s’applique immédiatement aux parcours.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {modifie && (
            <span className="flex items-center gap-1.5 rounded-full bg-saffron-100 px-2.5 py-1 text-[11px] font-medium text-saffron">
              Modifications non publiées
            </span>
          )}
          <Button onClick={publier} disabled={!modifie || erreurs.length > 0}>
            <Save className="size-3.5" /> Publier la grille
          </Button>
        </div>
      </div>

      {params.verrouTarifs && !deverrouille ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-saffron/40 bg-saffron-100/50 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Lock className="mt-0.5 size-4 shrink-0 text-saffron" />
            <div>
              <p className="text-[12px] font-semibold text-ink">Grille verrouillée</p>
              <p className="text-[11px] leading-4 text-ink-2">
                Les prix ne sont pas modifiables sans déverrouillage. Chaque publication engage
                l’hôtel sur ses tarifs : elle reste confirmée et journalisée.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => { setCodeSaisi(''); setDemandeCode(true); }}>
            <KeyRound className="size-3.5" /> Déverrouiller
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-jade/40 bg-jade-100/40 px-4 py-2.5">
          <p className="flex items-center gap-2 text-[12px] text-ink-2">
            <Unlock className="size-3.5 text-jade" /> Grille déverrouillée pour cette session.
          </p>
          {params.verrouTarifs && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                actions.setVerrouTarifs(true);
                setDeverrouille(false);
                push('Grille reverrouillée.', 'info');
              }}
            >
              <Lock className="size-3.5" /> Reverrouiller
            </Button>
          )}
        </div>
      )}

      {erreurs.length > 0 && (
        <div className="rounded-xl border border-crimson/40 bg-crimson-100/50 p-3">
          <p className="text-[12px] font-medium text-crimson">Publication bloquée :</p>
          <ul className="mt-1 list-inside list-disc text-[12px] leading-5 text-ink-2">
            {erreurs.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Grille tarifaire"
              sousTitre={`Prix de base par nuit et par type, en MAD TTC (TVA ${state.parametres?.fiscalite?.tvaHebergement ?? PARAMS.tvaHebergement} %)`}
              action={
                <div className="flex items-center gap-2">
                  <InfoBulle titre="Publication de la grille" cote="gauche">
                    Tant que vous n’avez pas publié, vos modifications restent un brouillon : les
                    parcours continuent d’utiliser la version en vigueur (v{params.version}). Chaque
                    publication crée une nouvelle version journalisée.
                  </InfoBulle>
                  <Pill tone="maj">{totalChambres} chambres</Pill>
                </div>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-line text-left text-[10px] tracking-[0.06em] text-ink-3 uppercase">
                    <th className="px-5 py-2.5 font-medium">Type</th>
                    <th className="px-3 py-2.5 text-center font-medium">Chambres</th>
                    <th className="px-3 py-2.5 text-center font-medium">Capacité</th>
                    <th className="px-3 py-2.5 text-right font-medium">Prix publié</th>
                    <th className="px-3 py-2.5 text-right font-medium">Nouveau prix</th>
                    <th className="px-5 py-2.5 text-right font-medium">Haute saison</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {Object.entries(TYPES_CHAMBRE).map(([cle, t]) => {
                    const publie = params.grille[cle]?.prix ?? t.prix;
                    const nouveau = Number(grille[cle]?.prix ?? publie);
                    const haute = Math.round(nouveau * (saisons.find((s) => s.nom === 'Haute saison')?.coef ?? 1.38));
                    return (
                      <tr key={cle} className="hover:bg-sand-50/60">
                        <td className="px-5 py-3 font-medium text-ink">{t.label}</td>
                        <td className="tnum px-3 py-3 text-center text-ink-2">
                          {state.chambres.filter((c) => c.type === cle && c.active !== false).length}
                        </td>
                        <td className="tnum px-3 py-3 text-center text-ink-2">{t.capacite}</td>
                        <td className="tnum px-3 py-3 text-right text-ink-3">{money(publie)}</td>
                        <td className="px-3 py-3 text-right">
                          <input
                            aria-label={`Nouveau prix ${t.label}`}
                            type="number"
                            min="1"
                            disabled={verrouille}
                            value={grille[cle]?.prix ?? publie}
                            onChange={(e) =>
                              setGrille((g) => ({ ...g, [cle]: { ...g[cle], prix: e.target.value } }))
                            }
                            className={cx(
                              'tnum w-24 rounded-lg border bg-surface px-2 py-1.5 text-right text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25',
                              nouveau !== publie ? 'border-saffron text-ink' : 'border-line-strong',
                              verrouille && 'cursor-not-allowed bg-sand-50 text-ink-3',
                            )}
                          />
                        </td>
                        <td className="tnum px-5 py-3 text-right text-ink-2">{money(haute)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-sand-50">
                    <td className="px-5 py-2.5 text-[12px] font-semibold text-ink">Version publiée</td>
                    <td className="tnum px-3 py-2.5 text-center text-[12px] text-ink-2">{totalChambres}</td>
                    <td />
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 text-right text-[11px] text-ink-3">
                      v{params.version} · {fmtLong(params.publieeLe)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-[11px] text-ink-3">{params.publieePar}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader titre="Saisons" sousTitre="Coefficient appliqué au prix publié" />
              <ul className="divide-y divide-line-soft">
                {saisons.map((s, i) => (
                  <li key={s.nom} className="flex items-center justify-between gap-2 px-5 py-2.5">
                    <span className="flex items-center gap-2 text-[12px] text-ink-2">
                      <Sun className="size-3.5 text-saffron" />
                      <span>
                        {s.nom}
                        <span className="block text-[11px] text-ink-3">{s.periode}</span>
                      </span>
                    </span>
                    <input
                      aria-label={`Coefficient ${s.nom}`}
                      type="number"
                      step="0.01"
                      min="0.5"
                      max="3"
                      value={s.coef}
                      disabled={verrouille}
                      onChange={(e) =>
                        setSaisons((liste) =>
                          liste.map((x, j) => (j === i ? { ...x, coef: e.target.value } : x)),
                        )
                      }
                      className={cx(
                        'tnum w-16 rounded-lg border border-line-strong bg-surface px-2 py-1 text-right text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25',
                        verrouille && 'cursor-not-allowed bg-sand-50 text-ink-3',
                      )}
                    />
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader
                titre="Formules & forfaits"
                sousTitre="Supplément par personne et par nuit"
              />
              <ul className="divide-y divide-line-soft">
                {FORMULES.map((f) => (
                  <li key={f.code} className="flex items-center justify-between px-5 py-2.5">
                    <span className="flex items-center gap-2 text-[12px] text-ink-2">
                      <Pill tone="outline">{f.code}</Pill>
                      {f.label}
                    </span>
                    <span className="tnum text-[12px] font-medium text-ink">
                      {f.supplement === 0 ? 'inclus' : `+ ${f.supplement} MAD`}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line-soft px-5 py-3">
                <label htmlFor="rt-demijournee" className="text-[12px] font-semibold text-ink-2">
                  Forfait demi-journée (matinée ou après-midi)
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    id="rt-demijournee"
                    type="number"
                    min="1"
                    value={demiJournee}
                    disabled={verrouille}
                    onChange={(e) => setDemiJournee(e.target.value)}
                    className="tnum w-24 rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-right text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
                  />
                  <span className="text-[12px] text-ink-3">MAD TTC · sans taxe de séjour</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader titre="Identité de l’établissement" sousTitre="Nom et logo affichés à la connexion et dans l’application" />
            <div className="space-y-3 px-5 py-4">
              <div>
                <label htmlFor="rt-nom" className="text-[12px] font-semibold text-ink-2">Nom commercial</label>
                <input
                  id="rt-nom"
                  value={nomHotel}
                  onChange={(e) => setNomHotel(e.target.value)}
                  onBlur={() => nomHotel.trim() && actions.setHotel({ nom: nomHotel.trim() })}
                  className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
                />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-ink-2">Logo</p>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="grid size-14 place-items-center overflow-hidden rounded-xl border border-line bg-sand-50">
                    {params.hotel.logo ? (
                      <img src={params.hotel.logo} alt="" className="size-full object-contain" />
                    ) : (
                      <Building2 className="size-5 text-ink-3" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <input
                      ref={fichierLogo}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="sr-only"
                      onChange={(e) => chargerLogo(e.target.files?.[0])}
                    />
                    <Button variant="outline" size="sm" onClick={() => fichierLogo.current?.click()}>
                      <ImagePlus className="size-3.5" /> Choisir une image
                    </Button>
                    {params.hotel.logo && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => actions.setHotel({ logo: null })}
                      >
                        <Trash2 className="size-3.5" /> Retirer
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] leading-4 text-ink-3">
                  PNG, JPG ou SVG, 400 Ko maximum. Le logo remplace la marque par défaut sur la page
                  de connexion et dans la barre latérale.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader titre="Modules" sousTitre="Fonctionnalités activables selon l’exploitation" />
            <ul className="divide-y divide-line-soft">
              {OPTIONS.map((o) => {
                const actif = Boolean(params.options?.[o.cle]);
                return (
                  <li key={o.cle} className="flex items-start justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-ink">{o.label}</p>
                      <p className="text-[11px] leading-4 text-ink-3">{o.detail}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={actif}
                      aria-label={o.label}
                      onClick={() => actions.setOption(o.cle, !actif)}
                      className={cx(
                        'mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors',
                        actif ? 'border-maj bg-maj' : 'border-line-strong bg-sand-200',
                      )}
                    >
                      <span
                        className={cx(
                          'block size-3.5 rounded-full bg-surface transition-transform',
                          actif ? 'translate-x-[18px]' : 'translate-x-[3px]',
                        )}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-line-soft px-5 py-3">
              <p className="text-[11px] leading-4 text-ink-3">
                Désactiver un module masque son écran et sa carte ; aucune donnée n’est supprimée et
                les droits des rôles restent inchangés.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader
              titre="Fiscalité"
              sousTitre="Taux appliqués aux factures et aux encaissements"
              action={<Pill tone={ecartsFiscaux.length ? 'saffron' : 'neutral'}>{ecartsFiscaux.length ? 'Non enregistré' : 'À jour'}</Pill>}
            />
            <div className="divide-y divide-line-soft">
              {Object.entries(CHAMPS_FISCAUX).map(([cle, meta]) => (
                <label key={cle} htmlFor={`fisc-${cle}`} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <span className="flex items-center gap-2 text-[12px] text-ink-2">
                    <Percent className="size-3.5 text-ink-3" /> {meta.label}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <input
                      id={`fisc-${cle}`}
                      type="number"
                      min="0"
                      step={meta.suffixe === '%' ? '0.5' : '1'}
                      value={fiscalite[cle] ?? ''}
                      disabled={state.profil !== 'direction'}
                      onChange={(e) => setFiscalite((f) => ({ ...f, [cle]: e.target.value }))}
                      className={cx(
                        'tnum w-24 rounded-lg border bg-surface px-2 py-1 text-right text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25',
                        String(params.fiscalite?.[cle]) !== String(fiscalite[cle])
                          ? 'border-saffron text-ink'
                          : 'border-line-strong',
                      )}
                    />
                    <span className="w-10 text-[11px] text-ink-3">{meta.suffixe}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-5 py-3">
              <p className="flex items-start gap-2 text-[11px] leading-4 text-ink-3">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                Un taux erroné fausse toutes les factures : l’enregistrement demande une
                confirmation, et l’écart est journalisé.
              </p>
              <Button
                size="sm"
                disabled={!ecartsFiscaux.length || state.profil !== 'direction'}
                onClick={() => setConfirmationFiscale(true)}
              >
                <Save className="size-3.5" /> Enregistrer
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader titre="Mentions légales" sousTitre="Reprises sur les factures et documents" />
            <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
              {[
                ['identifiantFiscal', 'Identifiant fiscal'],
                ['ice', 'ICE'],
                ['rc', 'Registre de commerce'],
                ['acompteEvenement', 'Acompte événement (%)'],
              ].map(([cle, label]) => (
                <div key={cle}>
                  <label htmlFor={`leg-${cle}`} className="text-[11px] font-semibold text-ink-2">{label}</label>
                  <input
                    id={`leg-${cle}`}
                    value={cle === 'acompteEvenement' ? (params.acompteEvenement ?? '') : (fiscalite[cle] ?? '')}
                    disabled={cle === 'acompteEvenement' || state.profil !== 'direction'}
                    onChange={(e) => setFiscalite((f) => ({ ...f, [cle]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-[12px] outline-none focus:border-maj disabled:bg-sand-50 disabled:text-ink-3"
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader titre="Politique d’annulation" sousTitre="Opposable au client à la réservation" />
        <ul className="divide-y divide-line-soft">
          {POLITIQUE.map((p) => (
            <li key={p} className="flex items-start gap-2 px-5 py-2.5 text-[12px] text-ink-2">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-jade" /> {p}
            </li>
          ))}
        </ul>
        <div className="border-t border-line-soft px-5 py-3">
          <p className="flex items-start gap-2 text-[11px] leading-4 text-ink-3">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            {HOTEL.nom} — {HOTEL.adresse}. Les mentions légales utilisées sur les documents se
            règlent dans le module Documents.
          </p>
        </div>
      </Card>

      {/* Déverrouillage de la grille : le code est demandé à chaque session. */}
      <Modal
        open={demandeCode}
        onClose={() => setDemandeCode(false)}
        title="Déverrouiller la grille tarifaire"
        subtitle={`Code d’exploitation (démonstration : ${CODE_VERROU})`}
        width="max-w-sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDemandeCode(false)}>Annuler</Button>
            <Button
              disabled={codeSaisi.trim().toUpperCase() !== CODE_VERROU}
              onClick={() => {
                setDeverrouille(true);
                setDemandeCode(false);
                push('Grille déverrouillée pour cette session.', 'success');
              }}
            >
              <Unlock className="size-3.5" /> Déverrouiller
            </Button>
          </div>
        }
      >
        <label htmlFor="rt-code" className="text-[12px] font-semibold text-ink-2">Code</label>
        <input
          id="rt-code"
          autoFocus
          value={codeSaisi}
          onChange={(e) => setCodeSaisi(e.target.value)}
          placeholder="MAKARIM"
          className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13px] tracking-[0.15em] uppercase outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
        />
        <p className="mt-2 text-[11px] text-ink-3">
          En production, ce contrôle est le second facteur du directeur. Le déverrouillage ne
          vaut que pour la session en cours.
        </p>
      </Modal>

      {/* Confirmation de publication : récapitulatif des écarts. */}
      <Modal
        open={confirmation}
        onClose={() => setConfirmation(false)}
        title="Confirmer la publication de la grille"
        subtitle={`Version ${params.version} → ${params.version + 1} · ${ecarts.length} changement(s)`}
        width="max-w-md"
        footer={
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => setConfirmation(false)}>Revenir</Button>
            <Button onClick={appliquerGrille}>
              <Save className="size-3.5" /> Publier la version {params.version + 1}
            </Button>
          </div>
        }
      >
        <ul className="space-y-1.5 text-[12px]">
          {ecarts.length === 0 && (
            <li className="text-ink-3">Aucun écart de prix : seule une nouvelle version sera créée.</li>
          )}
          {ecarts.map((e) => (
            <li key={e.label} className="flex items-center justify-between rounded-lg bg-sand-50 px-3 py-2">
              <span className="text-ink-2">{e.label}</span>
              <span className="tnum text-ink-3">
                {e.avant} <span className="text-ink-3">→</span>{' '}
                <span className="font-semibold text-ink">{e.apres}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-lg bg-maj-50 px-3 py-2 text-[11px] leading-4 text-maj">
          La publication est immédiate : les nouvelles réservations, le check-in, la prolongation et
          les canaux utilisent ces prix. L’opération est journalisée à votre nom.
        </p>
      </Modal>

      {/* Confirmation fiscale : deux clics, jamais un seul. */}
      <Modal
        open={confirmationFiscale}
        onClose={() => setConfirmationFiscale(false)}
        title="Confirmer la modification fiscale"
        subtitle={`${ecartsFiscaux.length} taux concerné(s)`}
        width="max-w-md"
        footer={
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => setConfirmationFiscale(false)}>Revenir</Button>
            <Button onClick={enregistrerFiscalite}>
              <Save className="size-3.5" /> Enregistrer
            </Button>
          </div>
        }
      >
        <ul className="space-y-1.5 text-[12px]">
          {ecartsFiscaux.map((e) => (
            <li key={e.label} className="flex items-center justify-between rounded-lg bg-sand-50 px-3 py-2">
              <span className="text-ink-2">{e.label}</span>
              <span className="tnum text-ink-3">
                {e.avant} → <span className="font-semibold text-ink">{e.apres}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-lg bg-crimson-100/60 px-3 py-2 text-[11px] leading-4 text-crimson">
          Les factures déjà émises ne sont pas recalculées. Seules les écritures suivantes
          appliquent les nouveaux taux.
        </p>
      </Modal>
    </div>
  );
}
