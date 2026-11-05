// Salle de conférence — planning 7 jours × 3 créneaux, événements dépliables et
// constructeur de devis (participants, format, prestations, HT / TVA 20 % / TTC
// / acompte 30 %).
//
// Règles métier : BR-EVT-001 (exclusivité de la salle), BR-EVT-002 (devis),
// BR-EVT-003 (acompte 30 %), BR-EVT-006 (capacité maximale).

import { useMemo, useState } from 'react';
import {
  CalendarCheck2,
  Check,
  ChevronDown,
  Coffee,
  FileText,
  Monitor,
  Plus,
  Presentation,
  Users,
  Wifi,
} from 'lucide-react';
import { CRENEAUX, PARAMS, PRESTATIONS_EVENEMENT, SALLE } from '../data';

// Capacité de sécurité de la salle, lue dans le référentiel (BR-EVT-006).
// Constante de module : partagée par l'écran et par le constructeur de devis.
const CAPACITE_SALLE = SALLE.capacites[0].places;
import { useApp } from '../store';
import { fmtCourt, isoAdd, money } from '../lib/date';
import { Button, Card, CardHeader, Pill, cx, useToast } from '../components/ui';

const STATUT_EVT = {
  confirme: { label: 'Confirmé', tone: 'jade' },
  option: { label: 'Option 48 h', tone: 'saffron' },
  devis: { label: 'Devis envoyé', tone: 'maj' },
};

function ConstructeurDevis({ dateParDefaut }) {
  const { state, actions } = useApp();
  const { push } = useToast();
  const [entreprise, setEntreprise] = useState('');
  const [titre, setTitre] = useState('Séminaire');
  const [date, setDate] = useState(dateParDefaut);
  const [creneau, setCreneau] = useState('matin');
  const [participants, setParticipants] = useState(22);
  const [formule, setFormule] = useState('journee');
  const [options, setOptions] = useState({ pauseCafe: true, dejeuner: true, projecteur: true });

  const location = formule === 'journee' ? SALLE.tarifs.locationJour : SALLE.tarifs.demiJournee;

  const lignes = useMemo(() => {
    const l = [{ label: formule === 'journee' ? 'Location journée' : 'Location demi-journée', montant: location }];
    for (const o of PRESTATIONS_EVENEMENT) {
      if (!options[o.cle]) continue;
      l.push({ label: o.label, montant: o.type === 'pers' ? o.prix * participants : o.prix });
    }
    return l;
  }, [options, participants, location, formule]);

  const ht = lignes.reduce((s, l) => s + l.montant, 0);
  const tva = Math.round(ht * (PARAMS.tvaSalle / 100));
  const ttc = ht + tva;
  const acompte = Math.round(ttc * (PARAMS.acompteEvenement / 100));
  // Capacité de sécurité = configuration théâtre de la salle (référentiel SALLE).
  const capaciteMax = CAPACITE_SALLE;
  const capaciteOk = participants <= capaciteMax;

  function confirmer() {
    if (!entreprise.trim() || !capaciteOk) return;
    actions.confirmEvent({
      titre: `${titre} — ${entreprise.trim()}`,
      entreprise: entreprise.trim(),
      date,
      creneau,
      participants,
      montant: ttc,
    });
    push(`Événement confirmé — ${entreprise.trim()} · acompte de ${money(acompte)} MAD facturé.`);
    setEntreprise('');
  }

  return (
    <Card>
      <CardHeader titre="Construire un devis séminaire" sousTitre="Location + prestations traiteur · TVA 20 %" action={<Pill tone="maj">Devis instantané</Pill>} />
      <div className="space-y-4 p-5">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor="evt-entreprise" className="text-[12px] font-semibold text-ink-2">
              Entreprise
            </label>
            <input
              id="evt-entreprise"
              value={entreprise}
              onChange={(e) => setEntreprise(e.target.value)}
              placeholder="Nom du client"
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
            />
          </div>
          <div>
            <label htmlFor="evt-date" className="text-[12px] font-semibold text-ink-2">
              Date
            </label>
            <input
              id="evt-date"
              type="date"
              value={date}
              min={state.date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
            />
          </div>
        </div>

        <div>
          <span id="evt-creneau" className="text-[12px] font-semibold text-ink-2">
            Créneau
          </span>
          <div role="group" aria-labelledby="evt-creneau" className="mt-1.5 grid grid-cols-3 gap-1.5">
            {Object.keys(CRENEAUX).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCreneau(c)}
                className={cx(
                  'rounded-lg border px-2 py-1.5 text-[11px] font-medium capitalize transition-colors',
                  creneau === c ? 'border-maj bg-maj-50 text-maj' : 'border-line bg-surface text-ink-2 hover:bg-sand-50',
                )}
              >
                {c.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span id="evt-participants" className="text-[12px] font-semibold text-ink-2">
            Participants
          </span>
          <div role="group" aria-labelledby="evt-participants" className="mt-1.5 flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setParticipants((p) => Math.max(5, p - 1))} aria-label="Retirer un participant">−</Button>
            <span aria-live="polite" className="tnum w-12 text-center text-lg font-semibold text-ink">
              {participants}
            </span>
            <Button variant="outline" size="sm" onClick={() => setParticipants((p) => Math.min(capaciteMax, p + 1))} aria-label="Ajouter un participant">+</Button>
            <span className={cx('text-[11px]', capaciteOk ? 'text-ink-2' : 'text-crimson')}>
              {capaciteOk
                ? `capacité max. ${capaciteMax} places (théâtre)`
                : `au-delà de ${capaciteMax} places en théâtre`}
            </span>
          </div>
        </div>

        <div>
          <span id="evt-format" className="text-[12px] font-semibold text-ink-2">
            Format
          </span>
          <div role="group" aria-labelledby="evt-format" className="mt-1.5 grid grid-cols-2 gap-1.5">
            {[
              { cle: 'journee', label: 'Journée' },
              { cle: 'demi', label: 'Demi-journée' },
            ].map((f) => (
              <button
                key={f.cle}
                type="button"
                onClick={() => setFormule(f.cle)}
                className={cx(
                  'rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors',
                  formule === f.cle ? 'border-maj bg-maj-50 text-maj' : 'border-line bg-surface text-ink-2 hover:bg-sand-50',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span id="evt-prestations" className="text-[12px] font-semibold text-ink-2">
            Prestations
          </span>
          <ul role="group" aria-labelledby="evt-prestations" className="mt-1.5 space-y-0.5">
            {PRESTATIONS_EVENEMENT.map((o) => (
              <li key={o.cle}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-sand-50">
                  <span className={cx('grid size-4 place-items-center rounded border transition-colors', options[o.cle] ? 'border-maj bg-maj text-white' : 'border-line bg-surface')}>
                    {options[o.cle] && <Check className="size-3" />}
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(options[o.cle])}
                    onChange={(e) => setOptions((prev) => ({ ...prev, [o.cle]: e.target.checked }))}
                    className="sr-only"
                  />
                  <span className="flex-1 text-[12px] text-ink-2">{o.label}</span>
                  <span className="tnum text-[11px] text-ink-3">{o.prix} MAD{o.type === 'pers' ? ' / pers.' : ''}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-line bg-sand-50 p-3">
          <ul className="space-y-1 text-[11px]">
            {lignes.map((l) => (
              <li key={l.label} className="flex justify-between">
                <span className="text-ink-2">{l.label}</span>
                <span className="tnum text-ink">{money(l.montant)} MAD</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 space-y-1 border-t border-line pt-2 text-[11px]">
            <div className="flex justify-between text-ink-2"><span>Total HT</span><span className="tnum">{money(ht)} MAD</span></div>
            <div className="flex justify-between text-ink-2"><span>TVA 20 %</span><span className="tnum">{money(tva)} MAD</span></div>
            <div className="flex justify-between text-[14px] font-semibold text-ink"><span>Total TTC</span><span className="tnum">{money(ttc)} MAD</span></div>
          </div>
          <p className="mt-2 text-[10px] text-ink-3">Acompte de 30 % à la confirmation : {money(acompte)} MAD</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => push('Devis enregistré en option 48 h', 'info')}>
            <FileText className="size-3.5" /> En option
          </Button>
          <Button className="flex-1" disabled={!entreprise.trim() || !capaciteOk} onClick={confirmer}>
            <CalendarCheck2 className="size-3.5" /> Confirmer
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function Conference() {
  const { state, actions } = useApp();
  const { push } = useToast();
  const [ouvert, setOuvert] = useState(null);

  const jours = Array.from({ length: 7 }, (_, i) => isoAdd(state.date, i));
  const evt = (jour, creneau) => state.evenements.find((e) => e.date === jour && e.creneau === creneau && e.statut !== 'annule');

  const caMois = state.evenements.filter((e) => e.statut === 'confirme').reduce((s, e) => s + e.montant, 0);
  const acomptes = state.evenements.filter((e) => e.statut === 'confirme').reduce((s, e) => s + (e.acompte ?? 0), 0);
  const aVenir = [...state.evenements].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.1em] text-ink-3 uppercase">Exploitation · Événementiel</p>
          <h2 className="font-display mt-1 text-[26px] leading-tight">{SALLE.nom}</h2>
          <p className="mt-1 text-[13px] text-ink-2">{SALLE.superficie} m² modulables · {CAPACITE_SALLE} places théâtre · devis en 2 minutes</p>
        </div>
        <Button onClick={() => push('Formulaire de devis disponible dans le panneau de droite', 'info')}>
          <Plus className="size-3.5" /> Nouvel événement
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Événements', `${state.evenements.length}`, `${state.evenements.filter((e) => e.statut === 'confirme').length} confirmés`],
              ['CA séminaires', `${money(caMois)} MAD`, 'contrats fermes'],
              ['Acomptes facturés', `${money(acomptes)} MAD`, `30 % du TTC`],
              ['Devis en attente', `${state.evenements.filter((e) => e.statut !== 'confirme').length}`, 'relance à faire'],
            ].map(([l, v, h]) => (
              <Card key={l} className="p-4">
                <p className="text-[10px] font-medium tracking-[0.06em] text-ink-3 uppercase">{l}</p>
                <p className="tnum mt-1 text-lg font-semibold text-ink">{v}</p>
                <p className="mt-0.5 text-[11px] text-ink-3">{h}</p>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader
              titre="Planning de la salle — 7 jours"
              sousTitre="3 créneaux par jour · option bloquante 48 h"
              action={
                <div className="flex gap-1.5">
                  <Pill tone="jade">Confirmé</Pill>
                  <Pill tone="saffron">Option</Pill>
                  <Pill tone="neutral">Libre</Pill>
                </div>
              }
            />
            <div className="overflow-x-auto p-4">
              <div className="min-w-[620px]">
                <div className="grid grid-cols-[92px_repeat(7,1fr)] gap-1">
                  <div />
                  {jours.map((j) => (
                    <div key={j} className="pb-1 text-center text-[10px] font-medium text-ink-3">{fmtCourt(j).slice(0, 7)}</div>
                  ))}
                  {Object.keys(CRENEAUX).map((creneau) => (
                    <div key={creneau} className="contents">
                      <div className="flex items-center pr-2 text-[10px] leading-3 text-ink-3">{CRENEAUX[creneau]}</div>
                      {jours.map((jour) => {
                        const e = evt(jour, creneau);
                        const statut = e?.statut ?? 'libre';
                        return (
                          <button
                            key={jour + creneau}
                            type="button"
                            onClick={() => e && push(`${e.titre} — ${e.participants} participants (${fmtCourt(jour)})`, 'info')}
                            className={cx(
                              'min-h-[46px] rounded-lg border px-1.5 py-1 text-left text-[10px] leading-3 transition-colors',
                              statut === 'confirme' && 'border-jade/30 bg-jade-100 text-jade hover:brightness-95',
                              statut === 'option' && 'border-saffron/30 bg-saffron-100 text-saffron hover:brightness-95',
                              statut === 'devis' && 'border-maj/30 bg-maj-50 text-maj hover:brightness-95',
                              statut === 'libre' && 'border-dashed border-line bg-surface text-ink-3',
                            )}
                          >
                            {e ? (
                              <>
                                <span className="block truncate font-semibold">{e.entreprise}</span>
                                <span className="mt-0.5 block opacity-80">{e.participants} pers.</span>
                              </>
                            ) : (
                              <span className="grid h-full place-items-center opacity-60">+</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader titre="Événements" sousTitre="Confirmés, options et devis en cours" />
            <ul className="divide-y divide-line-soft">
              {aVenir.map((e) => {
                const s = STATUT_EVT[e.statut] ?? STATUT_EVT.devis;
                const open = ouvert === e.id;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setOuvert(open ? null : e.id)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-sand-50/60"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sand-100 text-ink-2">
                        <Presentation className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{e.titre}</p>
                        <p className="truncate text-[11px] text-ink-3">
                          {e.entreprise} · {fmtCourt(e.date)} · {CRENEAUX[e.creneau]?.split(' ')[0]} · {e.participants} pers.
                        </p>
                      </div>
                      <span className="tnum hidden text-[12px] font-medium text-ink sm:block">{money(e.montant)} MAD</span>
                      <Pill tone={s.tone}>{s.label}</Pill>
                      <ChevronDown className={cx('size-4 text-ink-3 transition-transform', open && 'rotate-180')} />
                    </button>
                    {open && (
                      <div className="animate-fade-up border-t border-line-soft bg-sand-50/60 px-5 py-3">
                        <div className="grid gap-2 text-[11px] sm:grid-cols-3">
                          {[
                            ['Créneau', CRENEAUX[e.creneau]],
                            ['Participants', `${e.participants} personnes`],
                            ['Montant TTC', `${money(e.montant)} MAD`],
                            ['Salle', `${SALLE.nom} — ${SALLE.superficie} m²`],
                            ['Acompte', e.acompte ? `${money(e.acompte)} MAD reçus` : 'en attente'],
                            ['Facturation', 'Entreprise · ICE renseigné'],
                          ].map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-3 sm:block">
                              <span className="text-ink-3">{k}</span>
                              <span className="block font-medium text-ink">{v}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => push('Feuille de salle imprimée', 'info')}>Feuille de salle</Button>
                          <Button size="sm" variant="outline" onClick={() => push('Devis PDF généré', 'info')}>
                            <FileText className="size-3.5" /> Devis PDF
                          </Button>
                          {e.statut !== 'confirme' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                actions.confirmEvent({
                                  titre: e.titre,
                                  entreprise: e.entreprise,
                                  date: e.date,
                                  creneau: e.creneau,
                                  participants: e.participants,
                                  montant: e.montant,
                                });
                                push(`${e.titre} confirmé — acompte facturé`);
                              }}
                            >
                              <Check className="size-3.5" /> Confirmer
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <ConstructeurDevis dateParDefaut={isoAdd(state.date, 1)} />

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-ink-3" />
              <p className="text-[12px] font-semibold text-ink">Capacités</p>
            </div>
            <ul className="mt-2 space-y-1.5 text-[11px]">
              {SALLE.capacites.map((c) => (
                <li key={c.format} className="flex justify-between">
                  <span className="text-ink-2">{c.format}</span>
                  <span className="tnum font-medium text-ink">{c.places} places</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-2 border-t border-line-soft pt-3">
              <Monitor className="size-4 text-ink-3" />
              <p className="text-[12px] font-semibold text-ink">Équipements inclus</p>
            </div>
            <ul className="mt-2 space-y-1.5">
              {SALLE.equipements.map((e) => (
                <li key={e} className="flex items-center gap-2 text-[11px] text-ink-2">
                  {e.includes('Wi-Fi') ? <Wifi className="size-3 text-jade" /> : e.includes('pause') ? <Coffee className="size-3 text-terra" /> : <Check className="size-3 text-jade" />}
                  {e}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
