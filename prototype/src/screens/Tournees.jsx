// ------------------------------------------------------------------
// Tours de quart · cahier de transmission entre trois agents.
//
// Trois agents se relèvent toutes les 8 heures (06→14, 14→22, 22→06). Ce que
// l'agent sortant constate doit être lu par l'agent entrant : ce n'est pas un
// journal intime, c'est une passation signée. L'écran produit donc un rapport
// imprimable, dans l'ordre : contrôles, main courante, remarques, consignes.
//
// Règles matérialisées : BR-RH-003 (horodatage serveur des présences · ici
// l'heure de clôture), BR-RH-004 (pas de sortie de shift sans clôture),
// BR-RH-005 (pas de pointage concurrent), BR-AUD-002 (journalisation des
// opérations sensibles), BR-TR-005 (contrôle de fin de journée).
// ------------------------------------------------------------------

import { useMemo, useState } from 'react';
import {
  CheckCircle2, ClipboardCheck, Plus, Printer, Signature, TriangleAlert,
} from 'lucide-react';
import { SHIFTS } from '../data';
import { useApp } from '../store';
import { fmtLong, money } from '../lib/date';
import { ApercuDocument, RapportTourneeDoc } from '../components/Document';
import { DureeShift } from '../components/Chrono';
import { Exports } from '../components/Exports';
import { Button, Card, CardHeader, Pill, cx, useToast } from '../components/ui';

// Libellé lisible d'un shift à partir de sa clé (`matin`, `apres-midi`, `nuit`).
// Les tournées ne portent pas le libellé : il vient de la table SHIFTS.
function labelShift(cle) {
  return SHIFTS.find((s) => s.cle === cle)?.label.toLowerCase() ?? cle;
}

const ETIQUETTES = {
  clos: { label: 'Clôturé', tone: 'jade' },
  en_cours: { label: 'En cours', tone: 'maj' },
  a_venir: { label: 'À venir', tone: 'neutral' },
};

function suivanteDe(shift) {
  const i = SHIFTS.findIndex((s) => s.cle === shift);
  return SHIFTS[(i + 1) % SHIFTS.length];
}

export function Tournees() {
  const { state, actions } = useApp();
  const { push } = useToast();

  const [selection, setSelection] = useState(
    () => state.tournees.find((t) => t.statut === 'en_cours')?.id ?? state.tournees[0]?.id,
  );
  const [texte, setTexte] = useState('');
  const [remarques, setRemarques] = useState('');
  const [consignes, setConsignes] = useState('');
  const [comptage, setComptage] = useState('');
  const [apercu, setApercu] = useState(null);

  const tournee = state.tournees.find((t) => t.id === selection) ?? state.tournees[0];
  const suivante = tournee ? suivanteDe(tournee.shift) : null;
  const precedente = useMemo(() => {
    if (!tournee) return null;
    const i = SHIFTS.findIndex((s) => s.cle === tournee.shift);
    const cle = SHIFTS[(i + SHIFTS.length - 1) % SHIFTS.length].cle;
    return state.tournees.find((t) => t.shift === cle && t.statut === 'clos') ?? null;
  }, [state.tournees, tournee]);

  const faites = tournee ? tournee.taches.filter((t) => t.fait).length : 0;
  const total = tournee?.taches.length ?? 0;
  const toutFait = faites === total && total > 0;

  const ajouterEvenement = () => {
    if (!texte.trim()) return;
    actions.ajouterEvenementTournee(tournee.id, texte);
    setTexte('');
    push('Événement ajouté à la main courante.', 'success');
  };

  const cloturer = () => {
    actions.cloturerTournee(tournee.id, {
      remarques: remarques || tournee.remarques,
      consignes: consignes || tournee.consignes,
      comptage: comptage === '' ? tournee.caisse.comptage : Number(comptage),
    });
    setComptage('');
    push(`Shift ${tournee.shift} clôturé · rapport disponible pour ${suivante.label}.`, 'success');
  };

  return (
    <div className="space-y-4 px-4 py-5 sm:px-6">
      {/* Trois shifts du jour ------------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-3">
        {state.tournees.map((t) => {
          const etat = ETIQUETTES[t.statut] ?? ETIQUETTES.a_venir;
          const shift = SHIFTS.find((s) => s.cle === t.shift);
          const faits = t.taches.filter((x) => x.fait).length;
          const actif = t.id === tournee?.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelection(t.id)}
              className={cx(
                'rounded-lg border p-4 text-left transition-colors',
                actif ? 'border-maj bg-maj-50/60' : 'border-line bg-surface hover:bg-mist-50',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold text-ink">Shift {labelShift(t.shift)}</p>
                  <p className="text-[11px] text-ink-3">{t.plage}</p>
                </div>
                <Pill tone={etat.tone}>{etat.label}</Pill>
              </div>
              <p className="mt-2 text-[12px] text-ink-2">{t.agent}</p>
              <p className="mt-1 tnum text-[11px] text-ink-3">
                {faits}/{t.taches.length} contrôles · {t.evenements.length} événement(s)
              </p>
            </button>
          );
        })}
      </div>

      {tournee && (
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {/* Consignes reçues du shift précédent --------------------------- */}
            {precedente && (
              <Card className="border-saffron/40 bg-saffron-100/30">
                <div className="px-5 py-4">
                  <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
                    Consignes reçues de {precedente.agent} · shift {labelShift(precedente.shift)}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-5 text-ink">
                    {precedente.consignes || 'Aucune consigne particulière.'}
                  </p>
                  {precedente.remarques && (
                    <p className="mt-1 text-[12px] leading-5 text-ink-2">
                      Remarques : {precedente.remarques}
                    </p>
                  )}
                </div>
              </Card>
            )}

            {/* Checklist ---------------------------------------------------- */}
            <Card>
              <CardHeader
                titre={`Contrôles du shift ${labelShift(tournee.shift)}`}
                sousTitre={`${faites} sur ${total} effectués · ${tournee.agent}`}
                action={
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setApercu(tournee)}>
                      <Printer className="size-3.5" />
                      <span className="sr-only sm:not-sr-only">Rapport</span>
                    </Button>
                  </div>
                }
              />
              <ul className="divide-y divide-line-soft">
                {tournee.taches.map((t) => (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-mist-50/60">
                      <span
                        className={cx(
                          'grid size-4 shrink-0 place-items-center rounded border transition-colors',
                          t.fait ? 'border-maj bg-maj text-white' : 'border-line-strong bg-surface',
                        )}
                      >
                        {t.fait && <CheckCircle2 className="size-3" />}
                      </span>
                      <input
                        type="checkbox"
                        checked={t.fait}
                        onChange={() => actions.toggleTacheTournee(tournee.id, t.id)}
                        className="sr-only"
                      />
                      <span className={cx('text-[12px]', t.fait ? 'text-ink line-through decoration-line' : 'text-ink-2')}>
                        {t.label}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Main courante ------------------------------------------------ */}
            <Card>
              <CardHeader
                titre="Main courante"
                sousTitre="Ce que l’agent entrant doit savoir, horodaté automatiquement"
              />
              <div className="space-y-2 px-5 py-4">
                {tournee.evenements.length === 0 && (
                  <p className="text-[12px] text-ink-3">Aucun événement consigné pour l’instant.</p>
                )}
                <ul className="space-y-2">
                  {tournee.evenements.map((e, i) => (
                    <li key={`${e.heure}-${i}`} className="flex gap-3 rounded-lg bg-mist-50 px-3 py-2">
                      <span className="tnum shrink-0 text-[11px] text-ink-3">{e.heure}</span>
                      <span className="text-[12px] leading-5 text-ink-2">{e.texte}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 pt-1">
                  <input
                    aria-label="Ajouter un événement à la main courante"
                    value={texte}
                    onChange={(e) => setTexte(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && ajouterEvenement()}
                    placeholder="Ex. : chambre 110 prête, relancée auprès de la gouvernante"
                    className="w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
                  />
                  <Button variant="outline" onClick={ajouterEvenement}>
                    <Plus className="size-3.5" /> Ajouter
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Colonne de clôture ------------------------------------------- */}
          <div className="space-y-4">
            <Card>
              <CardHeader
                titre="Chronomètre du shift"
                sousTitre={`${tournee.agent} · ${SHIFTS.find((s) => s.cle === tournee.shift)?.plage ?? ''}`}
              />
              <div className="px-5 py-4">
                <DureeShift tournee={tournee} />
              </div>
            </Card>

            <Card>
              <CardHeader titre="Clôture du shift" sousTitre={`Rapport signé par ${tournee.agent}`} />
              <div className="space-y-3 px-5 py-4">
                <div>
                  <label htmlFor="tq-caisse" className="text-[12px] font-semibold text-ink-2">
                    Comptage de caisse (MAD)
                  </label>
                  <input
                    id="tq-caisse"
                    type="number"
                    value={comptage}
                    onChange={(e) => setComptage(e.target.value)}
                    placeholder={String(tournee.caisse.comptage || tournee.caisse.fond)}
                    className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
                  />
                  <p className="mt-1 text-[11px] text-ink-3">
                    Fond de caisse : {money(tournee.caisse.fond)} MAD
                  </p>
                </div>
                <div>
                  <label htmlFor="tq-remarques" className="text-[12px] font-semibold text-ink-2">
                    Remarques de l’agent sortant
                  </label>
                  <textarea
                    id="tq-remarques"
                    rows={3}
                    value={remarques}
                    onChange={(e) => setRemarques(e.target.value)}
                    placeholder={tournee.remarques || 'Incidents, départs en retard, demandes en attente…'}
                    className="mt-1.5 w-full resize-none rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
                  />
                </div>
                <div>
                  <label htmlFor="tq-consignes" className="text-[12px] font-semibold text-ink-2">
                    Consignes pour {suivante.label} ({suivante.agent})
                  </label>
                  <textarea
                    id="tq-consignes"
                    rows={3}
                    value={consignes}
                    onChange={(e) => setConsignes(e.target.value)}
                    placeholder={tournee.consignes || 'Ce que le shift suivant doit faire en priorité.'}
                    className="mt-1.5 w-full resize-none rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
                  />
                </div>

                {!toutFait && tournee.statut !== 'clos' && (
                  <p className="flex items-start gap-2 rounded-lg bg-saffron-100/50 px-2.5 py-2 text-[11px] leading-4 text-ink-2">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-saffron" />
                    {total - faites} contrôle(s) non effectué(s) : la clôture reste possible, mais le
                    rapport l’indiquera explicitement.
                  </p>
                )}

                <Button className="w-full" onClick={cloturer} disabled={tournee.statut === 'clos'}>
                  <Signature className="size-3.5" />
                  {tournee.statut === 'clos' ? 'Shift déjà clôturé' : 'Clôturer et signer le shift'}
                </Button>
                {tournee.statut === 'clos' && (
                  <p className="text-center text-[11px] text-ink-3">
                    Clôturé à {tournee.closLe} · consignes transmises à {suivante.agent}
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                titre="Relève"
                sousTitre={fmtLong(state.date)}
                action={
                  <Exports
                    nom={`tournees-${state.date}`}
                    titre="Tours de quart"
                    compact
                    colonnes={[
                      { cle: 'agent', label: 'Agent' },
                      { cle: 'shift', label: 'Shift' },
                      { cle: 'plage', label: 'Plage' },
                      { cle: 'statut', label: 'Statut' },
                      { cle: 'taches', label: 'Tâches faites' },
                      { cle: 'total', label: 'Tâches' },
                    ]}
                    lignes={state.tournees.map((t) => ({
                      agent: t.agent,
                      shift: labelShift(t.shift),
                      plage: t.plage,
                      statut: t.statut === 'clos' ? 'Clôturé' : t.statut === 'en_cours' ? 'En cours' : 'À venir',
                      taches: (t.taches ?? []).filter((x) => x.fait).length,
                      total: (t.taches ?? []).length,
                    }))}
                    onPdf={() => setApercu(state.tournees.find((t) => t.statut === 'en_cours') ?? state.tournees[0])}
                    pdfLibelle="Rapport imprimable"
                  />
                }
              />
              <div className="space-y-2 px-5 py-4">
                {state.tournees.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck
                        className={cx('size-3.5', t.statut === 'clos' ? 'text-jade' : 'text-ink-3')}
                      />
                      <span className="text-[12px] text-ink-2">{t.agent}</span>
                    </div>
                    <span className="text-[11px] text-ink-3">{t.plage}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {apercu && (
        <ApercuDocument
          titre={`Rapport de tournée · shift ${apercu.shift}`}
          onClose={() => setApercu(null)}
        >
          <RapportTourneeDoc tournee={apercu} suivante={suivanteDe(apercu.shift)} />
        </ApercuDocument>
      )}
    </div>
  );
}
