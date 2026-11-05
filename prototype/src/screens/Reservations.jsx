// Réservations — planning 14 jours × 30 chambres, filtres par canal, création
// avec contrôle de disponibilité et prix calculés en direct, détail et
// annulation.
//
// Règles métier : BR-RES-001 (anti double-booking), BR-RES-002/003 (cycle de vie
// et canal obligatoire), BR-SEJ-002 (check-in depuis le planning).

import { useMemo, useState } from 'react';
import { CalendarPlus, Check, Filter, MousePointerClick, Users, X } from 'lucide-react';
import { CANAUX, FORMULES, TYPES_CHAMBRE } from '../data';
import { chambresDisponibles, useApp } from '../store';
import { fmtCourt, isoAdd, isoDiff, money, nuits } from '../lib/date';
import { montantHebergement } from '../lib/pricing';
import { Button, Card, Modal, Pill, cx, useToast } from '../components/ui';

const JOURS_AFFICHES = 14;

function NouvelleReservation({ open, onClose }) {
  const { state, actions } = useApp();
  const { push } = useToast();
  const [client, setClient] = useState('');
  const [canal, setCanal] = useState('direct');
  const [arrivee, setArrivee] = useState(state.date);
  const [nbNuits, setNbNuits] = useState(2);
  const [occupants, setOccupants] = useState(2);
  const [formule, setFormule] = useState('BB');
  const [chambreChoisie, setChambreChoisie] = useState(null);

  const depart = isoAdd(arrivee, nbNuits);
  const dispo = useMemo(() => chambresDisponibles(state, arrivee, depart), [state, arrivee, depart]);
  const chambre = dispo.find((c) => c.numero === chambreChoisie) ?? null;
  const prix = chambre ? montantHebergement(chambre.type, formule, occupants, nbNuits) : 0;
  const valide = client.trim().length > 1 && Boolean(chambre);

  function soumettre() {
    if (!valide) return;
    actions.createReservation({
      client: client.trim(),
      chambre: chambre.numero,
      arrivee,
      depart,
      canal,
      formule,
      occupants,
    });
    push(`Réservation créée — ${client.trim()}, chambre ${chambre.numero}, ${money(prix)} MAD.`);
    setClient('');
    setChambreChoisie(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvelle réservation"
      subtitle="Disponibilité et prix calculés en direct"
      width="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px]">
            <span className="text-ink-3">Total séjour </span>
            <span className="tnum text-[15px] font-semibold text-ink">{money(prix)} MAD</span>
            <span className="text-ink-3"> · {nbNuits} nuit(s)</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={soumettre} disabled={!valide}>
              <Check className="size-3.5" /> Confirmer la réservation
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-[10px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Client</label>
          <input
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Nom du client ou de l’entreprise"
            className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[13px] outline-none focus:border-maj"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-[10px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Canal</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {Object.entries(CANAUX).map(([cle, c]) => (
              <button
                key={cle}
                type="button"
                onClick={() => setCanal(cle)}
                className={cx(
                  'rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-colors',
                  canal === cle ? c.classe : 'border-line bg-white text-ink-2 hover:bg-sand-50',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Arrivée</label>
          <input
            type="date"
            value={arrivee}
            min={state.date}
            onChange={(e) => setArrivee(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-maj"
          />
        </div>

        <div>
          <label className="text-[10px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Nuitées</label>
          <div className="mt-1.5 flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setNbNuits((n) => Math.max(1, n - 1))} aria-label="Retirer une nuit">−</Button>
            <span className="tnum w-10 text-center text-[15px] font-semibold">{nbNuits}</span>
            <Button variant="outline" size="sm" onClick={() => setNbNuits((n) => Math.min(30, n + 1))} aria-label="Ajouter une nuit">+</Button>
            <span className="ml-1 text-[11px] text-ink-3">→ départ {fmtCourt(depart)}</span>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Occupants</label>
          <div className="mt-1.5 flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setOccupants((n) => Math.max(1, n - 1))} aria-label="Retirer une personne">−</Button>
            <span className="tnum w-8 text-center text-[15px] font-semibold">{occupants}</span>
            <Button variant="outline" size="sm" onClick={() => setOccupants((n) => Math.min(3, n + 1))} aria-label="Ajouter une personne">+</Button>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Formule</label>
          <select
            value={formule}
            onChange={(e) => setFormule(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-maj"
          >
            {FORMULES.map((f) => (
              <option key={f.code} value={f.code}>
                {f.label}{f.supplement ? ` (+${f.supplement} MAD/pers.)` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
              Chambres disponibles ({dispo.length})
            </label>
            <span className="text-[11px] text-ink-3">{fmtCourt(arrivee)} → {fmtCourt(depart)}</span>
          </div>
          <div className="mt-1.5 grid max-h-44 grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5 overflow-y-auto rounded-xl border border-line bg-sand-50 p-2">
            {dispo.length === 0 && <p className="col-span-full px-2 py-4 text-center text-[12px] text-ink-3">Aucune chambre disponible sur ces dates.</p>}
            {dispo.map((c) => (
              <button
                key={c.numero}
                type="button"
                onClick={() => {
                  setChambreChoisie(c.numero);
                  setOccupants((o) => Math.min(o, TYPES_CHAMBRE[c.type].capacite));
                }}
                className={cx(
                  'rounded-lg border px-1 py-2 text-center transition-colors',
                  chambreChoisie === c.numero
                    ? 'border-maj bg-maj text-white'
                    : 'border-line bg-white text-ink-2 hover:border-maj/40',
                )}
              >
                <span className="tnum block text-[12px] font-semibold">{c.numero}</span>
                <span className="block text-[9.5px] opacity-80">{TYPES_CHAMBRE[c.type].court}</span>
              </button>
            ))}
          </div>
          {chambre && occupants > TYPES_CHAMBRE[chambre.type].capacite && (
            <p className="mt-1 text-[11px] text-crimson">Cette chambre accueille {TYPES_CHAMBRE[chambre.type].capacite} personnes maximum.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function Reservations() {
  const { state, actions } = useApp();
  const { push } = useToast();
  const [filtre, setFiltre] = useState('tous');
  const [detail, setDetail] = useState(null);
  const [creation, setCreation] = useState(false);

  const jours = Array.from({ length: JOURS_AFFICHES }, (_, i) => isoAdd(state.date, i));

  const blocs = useMemo(
    () => [
      // Les séjours déjà en cours sont rendus via `state.sejours` : ne garder
      // ici que les réservations pas encore arrivées, sinon le bloc
      // apparaîtrait deux fois sur le planning.
      ...state.reservations
        .filter((r) => r.statut === 'confirmee')
        .map((r) => ({ ...r, origine: 'resa' })),
      ...state.sejours.map((s) => ({ ...s, statut: 'en_sejour', canal: 'direct', origine: 'sejour' })),
    ],
    [state],
  );

  const filtres = blocs.filter((b) => filtre === 'tous' || b.canal === filtre);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.1em] text-ink-3 uppercase">Pilotage · Planning</p>
          <h2 className="font-display mt-1 text-[26px] leading-tight">Réservations</h2>
          <p className="mt-1 text-[13px] text-ink-2">
            {fmtCourt(state.date)} → {fmtCourt(isoAdd(state.date, 13))} · {blocs.length} séjours au planning
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => push('Filtres avancés — second rideau', 'info')}>
            <Filter className="size-3.5" /> Filtres
          </Button>
          <Button onClick={() => setCreation(true)}>
            <CalendarPlus className="size-3.5" /> Nouvelle réservation
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Nuitées fermes', `${blocs.reduce((s, b) => s + isoDiff(b.depart, b.arrivee), 0)}`, 'sur 14 jours'],
          ['Réservations directes', `${Math.round((blocs.filter((b) => b.canal === 'direct').length / Math.max(1, blocs.length)) * 100)} %`, 'objectif 45 %'],
          ['Arrivées du jour', `${state.reservations.filter((r) => r.arrivee === state.date && r.statut === 'confirmee').length}`, 'à enregistrer'],
          ['Séjours en cours', `${state.sejours.length}`, 'chambres occupées'],
        ].map(([l, v, h]) => (
          <Card key={l} className="p-4">
            <p className="text-[10px] font-medium tracking-[0.06em] text-ink-3 uppercase">{l}</p>
            <p className="tnum mt-1.5 text-xl font-semibold text-ink">{v}</p>
            <p className="mt-0.5 text-[11px] text-ink-3">{h}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltre('tous')}
              className={cx('rounded-full px-2.5 py-1 text-[11px] font-medium', filtre === 'tous' ? 'bg-ink text-white' : 'bg-sand-100 text-ink-2')}
            >
              Tous les canaux
            </button>
            {Object.entries(CANAUX).map(([cle, c]) => (
              <button
                key={cle}
                type="button"
                onClick={() => setFiltre(cle)}
                className={cx(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  filtre === cle ? c.classe : 'border-line bg-white text-ink-2 hover:bg-sand-50',
                )}
              >
                <span className={cx('size-1.5 rounded-full', c.dot)} />
                {c.label}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
            <MousePointerClick className="size-3.5" /> Cliquez sur un séjour pour le détail
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1020px]">
            <div className="grid border-b border-line bg-sand-50" style={{ gridTemplateColumns: `116px repeat(${JOURS_AFFICHES}, minmax(62px, 1fr))` }}>
              <div className="px-3 py-2 text-[10px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Chambre</div>
              {jours.map((j, i) => (
                <div key={j} className={cx('border-l border-line-soft px-2 py-2 text-center text-[10.5px] font-medium', i === 0 ? 'bg-maj-50 text-maj' : 'text-ink-2')}>
                  {fmtCourt(j).slice(0, 7)}
                </div>
              ))}
            </div>

            {[1, 2, 3].map((etage) => (
              <div key={etage}>
                <div className="border-b border-line-soft bg-sand-50/60 px-3 py-1.5">
                  <span className="text-[10px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{etage}ᵉ étage</span>
                </div>
                {state.chambres.filter((c) => c.etage === etage).map((chambre) => {
                  const sejours = filtres.filter((b) => b.chambre === chambre.numero);
                  return (
                    <div key={chambre.numero} className="grid border-b border-line-soft last:border-b-0 hover:bg-sand-50/40" style={{ gridTemplateColumns: `116px repeat(${JOURS_AFFICHES}, minmax(62px, 1fr))` }}>
                      <div className="flex items-center gap-2 px-3 py-1.5">
                        <span className="tnum text-[12px] font-semibold text-ink">{chambre.numero}</span>
                        <span className="text-[10px] text-ink-3">{TYPES_CHAMBRE[chambre.type].court}</span>
                      </div>
                      <div className="relative" style={{ gridColumn: `2 / span ${JOURS_AFFICHES}` }}>
                        <div className="grid h-8" style={{ gridTemplateColumns: `repeat(${JOURS_AFFICHES}, minmax(62px, 1fr))` }}>
                          {jours.map((j, i) => (
                            <div key={j} className={cx('border-l border-line-soft', i === 0 && 'bg-maj-50/40')} />
                          ))}
                        </div>
                        <div className="pointer-events-none absolute inset-0 grid px-0.5" style={{ gridTemplateColumns: `repeat(${JOURS_AFFICHES}, minmax(62px, 1fr))` }}>
                          {sejours.map((b) => {
                            const debut = Math.max(0, isoDiff(b.arrivee, state.date));
                            const span = Math.min(JOURS_AFFICHES - debut, isoDiff(b.depart, b.arrivee));
                            if (debut >= JOURS_AFFICHES || span <= 0) return null;
                            const canal = CANAUX[b.canal] ?? CANAUX.direct;
                            return (
                              <button
                                key={`${b.id}-${b.origine}`}
                                type="button"
                                onClick={() => setDetail(b)}
                                className={cx(
                                  'pointer-events-auto mx-0.5 flex h-6 items-center gap-1 self-center overflow-hidden rounded-md border px-1.5 text-left text-[10px] font-medium transition-transform hover:z-10 hover:scale-[1.02]',
                                  canal.classe,
                                )}
                                style={{ gridColumn: `${debut + 1} / span ${span}`, gridRow: 1 }}
                                title={`${b.client} · ${isoDiff(b.depart, b.arrivee)} nuits`}
                              >
                                <span className="truncate">{b.client}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <NouvelleReservation
        open={creation}
        onClose={() => setCreation(false)}
      />

      {detail && (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={detail.client}
          subtitle={`Chambre ${detail.chambre} · ${isoDiff(detail.depart, detail.arrivee)} nuits · ${CANAUX[detail.canal]?.label ?? 'Direct'}`}
          width="max-w-md"
          footer={
            <div className="flex justify-between gap-2">
              {detail.origine === 'resa' && detail.arrivee === state.date && detail.statut === 'confirmee' ? (
                <Button
                  onClick={() => {
                    actions.checkIn(detail.id);
                    push(`Check-in effectué — chambre ${detail.chambre}.`);
                    setDetail(null);
                  }}
                >
                  <Check className="size-3.5" /> Enregistrer l’arrivée
                </Button>
              ) : detail.origine === 'resa' && detail.statut === 'confirmee' ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    actions.cancelReservation(detail.id, detail.client);
                    push(`Réservation annulée — ${detail.client}`, 'info');
                    setDetail(null);
                  }}
                >
                  <X className="size-3.5" /> Annuler
                </Button>
              ) : (
                <span className="text-[11px] text-ink-3">Séjour en cours — actions disponibles en caisse.</span>
              )}
              <Button variant="outline" onClick={() => setDetail(null)}>Fermer</Button>
            </div>
          }
        >
          <dl className="space-y-2 text-[12px]">
            {[
              ['Arrivée', fmtCourt(detail.arrivee)],
              ['Départ', fmtCourt(detail.depart)],
              ['Formule', FORMULES.find((f) => f.code === detail.formule)?.label ?? detail.formule],
              ['Occupants', `${detail.occupants ?? 2} personne(s)`],
              ['Prix de la nuit', `${money(TYPES_CHAMBRE[state.chambres.find((c) => c.numero === detail.chambre)?.type]?.prix ?? 0)} MAD`],
              ['Statut', detail.statut === 'en_sejour' ? 'En séjour' : 'Confirmée'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-ink-3">{k}</dt>
                <dd className="font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-sand-100 px-3 py-2 text-[11px] text-ink-2">
            <Users className="size-3.5 text-ink-3" /> {nuits(detail.arrivee, detail.depart)} nuit(s) · total estimé{' '}
            {money(montantHebergement(state.chambres.find((c) => c.numero === detail.chambre)?.type, detail.formule, detail.occupants ?? 2, nuits(detail.arrivee, detail.depart)))} MAD
          </div>
        </Modal>
      )}
    </div>
  );
}
