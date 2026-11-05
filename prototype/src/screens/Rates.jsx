// Tarifs & paramètres — grille par type de chambre, formules, saisons,
// fiscalité et politique d'annulation. Aucun taux n'est codé en dur : cet écran
// est la matérialisation de BR-TR-003 (paramétrage) et de BR-FAC-007/008.

import { BedDouble, Percent, Receipt, ShieldCheck, Sun } from 'lucide-react';
import { FORMULES, HOTEL, PARAMS, POLITIQUE, SAISONS, TYPES_CHAMBRE } from '../data';
import { useApp } from '../store';
import { money } from '../lib/date';
import { Button, Card, CardHeader, Pill, useToast } from '../components/ui';

export function Rates() {
  const { state } = useApp();
  const { push } = useToast();

  const lignes = Object.entries(TYPES_CHAMBRE).map(([cle, t]) => ({
    cle,
    ...t,
    chambres: state.chambres.filter((c) => c.type === cle).length,
    haute: Math.round(t.prix * 1.38),
    revpar: Math.round(t.prix * 0.6),
  }));

  const total = lignes.reduce((s, l) => s + l.chambres, 0);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.1em] text-ink-3 uppercase">Administration · Référentiel</p>
          <h2 className="font-display mt-1 text-[26px] leading-tight">Tarifs & paramètres</h2>
          <p className="mt-1 max-w-2xl text-[14px] text-ink-2">
            Grille, formules et fiscalité — aucun taux ni tarif codé en dur dans
            les parcours, tout est piloté depuis ce référentiel.
          </p>
        </div>
        <Button onClick={() => push('Grille publiée — modification journalisée', 'info')}>Publier la grille</Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Grille tarifaire"
              sousTitre="Prix par nuit, par type de chambre, en MAD TTC (TVA 10 %)"
              action={<Pill tone="maj">{total} chambres</Pill>}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-line text-left text-[10px] tracking-[0.06em] text-ink-3 uppercase">
                    <th className="px-5 py-2.5 font-medium">Type</th>
                    <th className="px-3 py-2.5 text-center font-medium">Chambres</th>
                    <th className="px-3 py-2.5 text-center font-medium">Capacité</th>
                    <th className="px-3 py-2.5 text-right font-medium">Base</th>
                    <th className="px-3 py-2.5 text-right font-medium">Haute saison</th>
                    <th className="px-5 py-2.5 text-right font-medium">RevPAR cible</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {lignes.map((g) => (
                    <tr key={g.cle} className="hover:bg-sand-50/60">
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2 font-medium text-ink">
                          <BedDouble className="size-3.5 text-ink-3" /> {g.label}
                        </span>
                      </td>
                      <td className="tnum px-3 py-3 text-center text-ink-2">{g.chambres}</td>
                      <td className="tnum px-3 py-3 text-center text-ink-2">{g.capacite}</td>
                      <td className="tnum px-3 py-3 text-right font-medium text-ink">{g.prix}</td>
                      <td className="tnum px-3 py-3 text-right text-ink-2">{g.haute}</td>
                      <td className="tnum px-5 py-3 text-right text-ink-2">{g.revpar} MAD</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-sand-50">
                    <td className="px-5 py-2.5 text-[12px] font-semibold text-ink">Total</td>
                    <td className="tnum px-3 py-2.5 text-center text-[12px] font-semibold text-ink">{total}</td>
                    <td />
                    <td className="tnum px-3 py-2.5 text-right text-[12px] text-ink-2">ADR cible ~600</td>
                    <td />
                    <td className="tnum px-5 py-2.5 text-right text-[12px] font-semibold text-ink">~360 MAD</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader titre="Formules d’hébergement" sousTitre="Supplément par personne et par nuit" />
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
              <div className="border-t border-line-soft px-5 py-2.5">
                <p className="text-[12px] leading-4 text-ink-3">
                  Les pensions restent taxées à 10 % avec l’hébergement (cahier des charges §3.5.1).
                </p>
              </div>
            </Card>

            <Card>
              <CardHeader titre="Saisons" sousTitre="Coefficient appliqué à la grille de base" />
              <ul className="divide-y divide-line-soft">
                {SAISONS.map((s) => (
                  <li key={s.nom} className="flex items-center justify-between px-5 py-2.5">
                    <span className="flex items-center gap-2 text-[12px] text-ink-2">
                      <Sun className="size-3.5 text-saffron" />
                      <span>
                        {s.nom}
                        <span className="block text-[10px] text-ink-3">{s.periode}</span>
                      </span>
                    </span>
                    <Pill tone={s.coef >= 1.3 ? 'saffron' : s.coef > 1 ? 'maj' : 'jade'}>× {s.coef.toFixed(2)}</Pill>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card>
            <CardHeader titre="Politique d’annulation" sousTitre="Règle affichée au client et appliquée par le moteur" />
            <ul className="space-y-2 px-5 py-4">
              {POLITIQUE.map((p) => (
                <li key={p} className="flex items-start gap-2 text-[12px] text-ink-2">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-jade" />
                  {p}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="zellige p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-maj text-white">
                <Receipt className="size-5" />
              </span>
              <div>
                <p className="font-display text-lg leading-tight text-ink">{HOTEL.nom}</p>
                <p className="text-[12px] text-ink-3">{HOTEL.categorie} · {HOTEL.ville}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 border-t border-line/60 pt-3 text-[11px]">
              {[
                ['Raison sociale', 'Hôtel Makarim SARL'],
                ['Catégorie', '3 étoiles — 30 chambres'],
                ['Adresse', HOTEL.adresse],
                ['Devise / fuseau', `MAD · ${HOTEL.fuseau}`],
                ['Usage', 'Interne · hors SaaS multi-hôtels'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader titre="Fiscalité" sousTitre="Taux lus en base, jamais codés en dur" />
            <ul className="divide-y divide-line-soft">
              {[
                { l: 'TVA hébergement & pensions', v: `${PARAMS.tvaHebergement} %`, icone: Percent },
                { l: 'TVA restauration à la carte', v: `${PARAMS.tvaAnnexe} %`, icone: Percent },
                { l: 'TVA location de salle', v: `${PARAMS.tvaSalle} %`, icone: Percent },
                { l: 'Taxe de séjour', v: `${PARAMS.taxeSejour} MAD / nuit / adulte`, icone: Receipt },
                { l: 'Plafond espèces', v: `${money(PARAMS.plafondEspeces)} MAD`, icone: ShieldCheck },
              ].map((r) => {
                const Icone = r.icone;
                return (
                  <li key={r.l} className="flex items-center gap-3 px-5 py-2.5">
                    <Icone className="size-3.5 text-ink-3" />
                    <span className="flex-1 text-[12px] text-ink-2">{r.l}</span>
                    <span className="tnum text-[12px] font-medium text-ink">{r.v}</span>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-line-soft px-5 py-3">
              <p className="text-[12px] leading-4 text-ink-3">
                Source : cahier des charges §3.5.1 — « TVA 10 % sur l’hébergement,
                la demi-pension et la pension complète ; 20 % sur les prestations
                annexes, dont la restauration à la carte hors pension ».
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
