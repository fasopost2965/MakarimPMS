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
  Building2, CheckCircle2, ImagePlus, Percent, Receipt, Save, ShieldCheck, Sun, Trash2,
} from 'lucide-react';
import { FORMULES, HOTEL, PARAMS, POLITIQUE, TYPES_CHAMBRE } from '../data';
import { useApp } from '../store';
import { fmtLong, money } from '../lib/date';
import { Button, Card, CardHeader, Pill, cx, useToast } from '../components/ui';
import { InfoBulle } from '../components/InfoBulle';

const OPTIONS = [
  { cle: 'dayUse', label: 'Séjours à la demi-journée', detail: 'Matinée ou après-midi, forfait fixe sans nuitée.' },
  { cle: 'minibar', label: 'Minibar lié aux chambres', detail: 'Consommation déclarée depuis le plan des chambres, portée au folio.' },
  { cle: 'stock', label: 'Gestion de stock', detail: 'Inventaire, seuils critiques et mouvements.' },
  { cle: 'channelManager', label: 'Channel manager', detail: 'Connexion aux plateformes de distribution.' },
  { cle: 'fichePolice', label: 'Fiches de police', detail: 'Registre d’hébergement et impression.' },
  { cle: 'tournees', label: 'Tours de quart', detail: 'Relève des trois shifts et cahier de transmission.' },
];

export function Rates() {
  const { state, actions } = useApp();
  const { push } = useToast();
  const fichierLogo = useRef(null);

  const params = state.parametres;
  const [grille, setGrille] = useState(() => structuredClone(params.grille));
  const [saisons, setSaisons] = useState(() => structuredClone(params.saisons));
  const [demiJournee, setDemiJournee] = useState(params.demiJournee);
  const [nomHotel, setNomHotel] = useState(params.hotel.nom);

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
    actions.publierGrille(grille, saisons, Number(demiJournee), state.session?.nom ?? 'Direction');
    push(
      `Grille publiée — version ${params.version + 1}. Les nouveaux prix s’appliquent dès la prochaine réservation.`,
      'success',
    );
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
              sousTitre="Prix par nuit et par type, en MAD TTC (TVA 10 %)"
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
                            value={grille[cle]?.prix ?? publie}
                            onChange={(e) =>
                              setGrille((g) => ({ ...g, [cle]: { ...g[cle], prix: e.target.value } }))
                            }
                            className={cx(
                              'tnum w-24 rounded-lg border bg-surface px-2 py-1.5 text-right text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25',
                              nouveau !== publie ? 'border-saffron text-ink' : 'border-line-strong',
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
                      onChange={(e) =>
                        setSaisons((liste) =>
                          liste.map((x, j) => (j === i ? { ...x, coef: e.target.value } : x)),
                        )
                      }
                      className="tnum w-16 rounded-lg border border-line-strong bg-surface px-2 py-1 text-right text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
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
            <CardHeader titre="Fiscalité" sousTitre="Paramètres appliqués aux factures" />
            <ul className="divide-y divide-line-soft">
              {[
                ['Taxe de séjour', `${PARAMS.taxeSejour} MAD / nuit / adulte`],
                ['TVA hébergement & pensions', `${PARAMS.tvaHebergement} %`],
                ['TVA restauration & annexes', `${PARAMS.tvaAnnexe} %`],
                ['Acompte événement', `${PARAMS.acompteEvenement} %`],
                ['Plafond espèces', `${money(PARAMS.plafondEspeces)} MAD`],
              ].map(([l, v]) => (
                <li key={l} className="flex items-center justify-between px-5 py-2.5 text-[12px]">
                  <span className="flex items-center gap-2 text-ink-2">
                    <Percent className="size-3.5 text-ink-3" /> {l}
                  </span>
                  <span className="tnum font-medium text-ink">{v}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-line-soft px-5 py-3">
              <p className="flex items-start gap-2 text-[11px] leading-4 text-ink-3">
                <Receipt className="mt-0.5 size-3.5 shrink-0" />
                Modifiables en base (BR-TR-003) — non éditables ici pour éviter une erreur fiscale en
                démonstration.
              </p>
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
    </div>
  );
}
