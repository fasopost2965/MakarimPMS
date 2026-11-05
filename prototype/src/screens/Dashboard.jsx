// Tableau de bord d'exploitation — écran de pilotage du directeur et de la
// réception. Tous les indicateurs sont calculés à partir de l'état réel
// (séjours, réservations, commandes, événements), aucun chiffre n'est figé.
//
// Règles métier : BR-REP-002 (occupation, ADR, RevPAR, mix par canal, prévision
// 14 jours), BR-SEJ-004 (check-out bloqué si solde), BR-TR-005 (arrivées non
// enregistrées signalées avant la clôture).

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BedDouble,
  CalendarPlus,
  ChefHat,
  Coffee,
  LogIn,
  LogOut,
  Sparkles,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { CANAUX, STATUTS_CHAMBRE, TYPES_CHAMBRE } from '../data';
import {
  arriveesDuJour,
  departsDuJour,
  kpiDuJour,
  soldeDuFolio,
  useApp,
} from '../store';
import { fmtCourt, fmtLong, isoAdd, money } from '../lib/date';
import {
  Bar,
  Button,
  Card,
  CardHeader,
  Pill,
  Ring,
  Sparkline,
  Stat,
  cx,
  useToast,
} from '../components/ui';

function AlerteIcone({ niveau }) {
  const map = {
    danger: { Icone: TriangleAlert, classe: 'bg-crimson-100 text-crimson' },
    warning: { Icone: ChefHat, classe: 'bg-saffron-100 text-saffron' },
    info: { Icone: Coffee, classe: 'bg-maj-100 text-maj' },
  };
  const { Icone, classe } = map[niveau] ?? map.info;
  return (
    <span className={cx('mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg', classe)}>
      <Icone className="size-3.5" />
    </span>
  );
}

export function Dashboard({ onNavigate }) {
  const { state, actions } = useApp();
  const { push } = useToast();
  const [onglet, setOnglet] = useState('arrivees');
  const kpi = kpiDuJour(state);

  const arrivees = arriveesDuJour(state);
  const departs = departsDuJour(state);

  // Mix par canal — attendu par le cahier des charges (walk-in 70 / direct 20 /
  // Booking 10) et par la règle BR-REP-002. Calculé sur les réservations fermes.
  const parCanal = useMemo(() => {
    const base = { walkin: 0, direct: 0, booking: 0 };
    state.reservations
      .filter((r) => ['confirmee', 'en_sejour'].includes(r.statut))
      .forEach((r) => {
        const ch = state.chambres.find((c) => c.numero === r.chambre);
        const prix = TYPES_CHAMBRE[ch?.type]?.prix ?? 0;
        base[r.canal] = (base[r.canal] ?? 0) + prix * (r.nbNuits ?? 0);
      });
    const total = Object.values(base).reduce((a, b) => a + b, 0);
    return {
      total,
      lignes: Object.entries(base).map(([cle, valeur]) => ({
        cle,
        valeur,
        part: Math.round((valeur / Math.max(1, total)) * 100),
        ...CANAUX[cle],
      })),
    };
  }, [state]);

  // Prévision réelle : occupation jour par jour sur 14 jours, calculée sur les
  // séjours en cours et les réservations fermes.
  const prevision = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const jour = isoAdd(state.date, i);
        const vendues = new Set([
          ...state.sejours.filter((s) => s.arrivee <= jour && s.depart > jour).map((s) => s.chambre),
          ...state.reservations
            .filter((r) => ['confirmee', 'en_sejour'].includes(r.statut) && r.arrivee <= jour && r.depart > jour)
            .map((r) => r.chambre),
        ]);
        return { jour, valeur: Math.round((vendues.size / state.chambres.length) * 100) };
      }),
    [state],
  );

  const pointe = prevision.reduce((max, p) => (p.valeur > max.valeur ? p : max), prevision[0]);

  const parStatut = state.chambres.reduce((acc, c) => {
    acc[c.statut] = (acc[c.statut] ?? 0) + 1;
    return acc;
  }, {});

  const couvertsDemain = state.sejours
    .filter((s) => s.depart > state.date && s.formule !== 'RO')
    .reduce((n, s) => n + s.occupants, 0);

  const sejoursNonSoldes = departs
    .map((s) => ({ sejour: s, folio: state.folios.find((f) => f.id === s.folioId) }))
    .filter((x) => x.folio && soldeDuFolio(x.folio) > 0);

  const hs = state.chambres.filter((c) => c.statut === 'hors_service');
  const evenementDemain = state.evenements.find((e) => e.date === isoAdd(state.date, 1) && e.statut === 'confirme');

  const alertes = [
    hs.length > 0 && {
      niveau: 'danger',
      titre: `${hs.length} chambre(s) hors service`,
      detail: `${hs.map((c) => c.numero).join(', ')} — ${hs[0]?.note ?? 'maintenance en cours'}.`,
    },
    sejoursNonSoldes.length > 0 && {
      niveau: 'warning',
      titre: `${sejoursNonSoldes.length} départ(s) non soldé(s)`,
      detail: `${sejoursNonSoldes
        .map((x) => `ch. ${x.sejour.chambre} (${money(soldeDuFolio(x.folio))} MAD)`)
        .join(' · ')}.`,
    },
    evenementDemain && {
      niveau: 'info',
      titre: `${evenementDemain.titre} demain`,
      detail: `${evenementDemain.participants} participants · ${evenementDemain.entreprise}.`,
    },
    {
      niveau: 'info',
      titre: `${couvertsDemain} petits-déjeuners prévus demain`,
      detail: 'Commande boulangerie à confirmer avant 18:00.',
    },
  ].filter(Boolean);

  const parts = [
    { label: 'Hébergement', valeur: kpi.caHebergement, tone: 'bg-maj' },
    { label: 'Restauration', valeur: kpi.caRestauration, tone: 'bg-terra' },
    { label: 'Séminaire', valeur: kpi.caConference, tone: 'bg-saffron' },
  ];

  function checkIn(resa) {
    const chambre = state.chambres.find((c) => c.numero === resa.chambre);
    if (chambre?.statut !== 'propre') {
      push(`Chambre ${resa.chambre} non prête — validez d’abord son nettoyage.`, 'info');
      return;
    }
    actions.checkIn(resa.id);
    push(`Check-in effectué — ${resa.client}, chambre ${resa.chambre}.`);
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.1em] text-ink-3 uppercase">
            {fmtLong(state.date)} · Shift 14:00 → 22:00
          </p>
          <h2 className="font-display mt-1 text-[26px] leading-tight">Bonsoir, Youssef.</h2>
          <p className="mt-1 max-w-xl text-[13px] text-ink-2">
            {kpi.arrivees} arrivées attendues, {kpi.departs} départs à solder,{' '}
            {parStatut.a_nettoyer ?? 0} chambres à remettre en vente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onNavigate('chambres')}>
            <BedDouble className="size-3.5" /> Plan des chambres
          </Button>
          <Button variant="outline" onClick={() => onNavigate('restaurant')}>
            <ChefHat className="size-3.5" /> Prendre une commande
          </Button>
          <Button onClick={() => onNavigate('reservations')}>
            <CalendarPlus className="size-3.5" /> Nouvelle réservation
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Stat label="Occupation ce soir" value={`${kpi.occupation}%`} hint={`${kpi.vendues} / ${state.chambres.length} chambres`} />
        <Stat label="ADR" value={kpi.adr} unit="MAD" hint="prix moyen nuitée" />
        <Stat label="RevPAR" value={kpi.revpar} unit="MAD" hint="revenu par chambre" />
        <Stat label="Arrivées / départs" value={`${kpi.arrivees} · ${kpi.departs}`} hint={`${kpi.enChambre} séjours en cours`} />
        <Stat label="CA en cours" value={money(kpi.caTotal)} unit="MAD" hint="hébergement + resto + séminaire" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader
              titre="Prévision d'occupation — 14 jours"
              sousTitre="Calculée sur les séjours en cours et les réservations fermes"
              action={
                <Pill tone="maj">
                  <Sparkles className="size-3" /> Pointe à {pointe.valeur} % le {fmtCourt(pointe.jour)}
                </Pill>
              }
            />
            <div className="px-3 pt-4 pb-2">
              <Sparkline points={prevision.map((p) => ({ jour: fmtCourt(p.jour).slice(0, 3), valeur: p.valeur }))} />
              <div className="mt-1 flex justify-between px-2">
                {prevision.filter((_, i) => i % 2 === 0).map((p) => (
                  <span key={p.jour} className="text-[10px] text-ink-3">
                    {fmtCourt(p.jour).slice(0, 6)}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-line-soft border-t border-line-soft">
              {[
                { l: 'Occupation prévue (7 j)', v: `${Math.round(prevision.slice(0, 7).reduce((s, p) => s + p.valeur, 0) / 7)} %` },
                { l: 'Nuitées fermes', v: prevision.reduce((s, p) => s + Math.round((p.valeur / 100) * state.chambres.length), 0) },
                { l: 'Chambres à vendre ce soir', v: state.chambres.length - kpi.vendues },
              ].map((s) => (
                <div key={s.l} className="px-4 py-3">
                  <p className="text-[12px] font-medium text-ink-2">{s.l}</p>
                  <p className="tnum mt-1 text-sm font-semibold text-ink">{s.v}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              titre="Mouvements du jour"
              sousTitre="Check-in et check-out traités directement depuis cette liste"
              action={
                <div className="flex rounded-lg bg-sand-100 p-0.5">
                  {[
                    { cle: 'arrivees', label: `Arrivées ${arrivees.length}` },
                    { cle: 'departs', label: `Départs ${departs.length}` },
                  ].map((t) => (
                    <button
                      key={t.cle}
                      type="button"
                      onClick={() => setOnglet(t.cle)}
                      className={cx(
                        'rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors',
                        onglet === t.cle ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              }
            />
            <div className="divide-y divide-line-soft">
              {onglet === 'arrivees' &&
                (arrivees.length === 0 ? (
                  <p className="px-5 py-8 text-center text-[12px] text-ink-3">
                    Toutes les arrivées du jour sont enregistrées.
                  </p>
                ) : (
                  arrivees.map((a) => {
                    const chambre = state.chambres.find((c) => c.numero === a.chambre);
                    const prete = chambre?.statut === 'propre';
                    return (
                      <div key={a.id} className="flex items-center gap-3 px-5 py-2.5">
                        <span className="tnum w-11 shrink-0 text-xs font-medium text-ink-3">{a.heure || '—'}</span>
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-maj-50 text-maj">
                          <LogIn className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-ink">{a.client}</p>
                          <p className="truncate text-[11px] text-ink-3">
                            {TYPES_CHAMBRE[chambre?.type]?.court} · {a.occupants} pers. · formule {a.formule}
                            {!prete && ' · chambre non prête'}
                          </p>
                        </div>
                        <Pill tone={a.canal === 'direct' ? 'jade' : a.canal === 'walkin' ? 'terra' : 'maj'}>
                          {CANAUX[a.canal]?.label}
                        </Pill>
                        <span className="tnum w-9 shrink-0 text-right text-[13px] font-semibold text-ink">{a.chambre}</span>
                        <Button size="sm" variant={prete ? 'primary' : 'outline'} onClick={() => checkIn(a)}>
                          Check-in
                        </Button>
                      </div>
                    );
                  })
                ))}

              {onglet === 'departs' &&
                (departs.length === 0 ? (
                  <p className="px-5 py-8 text-center text-[12px] text-ink-3">Aucun départ prévu aujourd’hui.</p>
                ) : (
                  departs.map((d) => {
                    const folio = state.folios.find((f) => f.id === d.folioId);
                    const solde = folio ? soldeDuFolio(folio) : 0;
                    return (
                      <div key={d.id} className="flex items-center gap-3 px-5 py-2.5">
                        <span className="tnum w-11 shrink-0 text-xs font-medium text-ink-3">12:00</span>
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sand-200 text-ink-2">
                          <LogOut className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-ink">{d.client}</p>
                          <p className="truncate text-[11px] text-ink-3">Chambre {d.chambre}</p>
                        </div>
                        {solde > 0 ? (
                          <Pill tone="crimson">Solde {money(solde)} MAD</Pill>
                        ) : (
                          <Pill tone="jade">Soldé</Pill>
                        )}
                        {solde > 0 ? (
                          <Button size="sm" variant="outline" onClick={() => onNavigate('caisse')}>
                            Encaisser
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => {
                              actions.checkOut(d.id);
                              push(`Check-out effectué — chambre ${d.chambre}, facture émise.`);
                            }}
                          >
                            Check-out
                          </Button>
                        )}
                      </div>
                    );
                  })
                ))}
            </div>
            <button
              type="button"
              onClick={() => onNavigate(onglet === 'arrivees' ? 'reservations' : 'caisse')}
              className="flex w-full items-center justify-center gap-1.5 border-t border-line-soft py-2.5 text-[12px] font-medium text-maj hover:bg-maj-50"
            >
              Ouvrir {onglet === 'arrivees' ? 'le planning' : 'la caisse'} <ArrowRight className="size-3.5" />
            </button>
          </Card>

          <Card>
            <CardHeader
              titre="Plan des 30 chambres"
              sousTitre="États temps réel — synchronisés avec le housekeeping"
              action={
                <Button size="sm" variant="outline" onClick={() => onNavigate('chambres')}>
                  Gérer
                </Button>
              }
            />
            <div className="px-5 py-4">
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {Object.entries(STATUTS_CHAMBRE).map(([cle, s]) => (
                  <span key={cle} className="flex items-center gap-1.5 text-[11px] text-ink-2">
                    <span className={cx('size-2 rounded-full', s.dot)} />
                    {s.label}
                    <span className="tnum font-semibold text-ink">{parStatut[cle] ?? 0}</span>
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-10 gap-1.5">
                {state.chambres.map((c) => {
                  const s = STATUTS_CHAMBRE[c.statut];
                  return (
                    <button
                      key={c.numero}
                      type="button"
                      onClick={() => onNavigate('chambres')}
                      title={`${c.numero} · ${TYPES_CHAMBRE[c.type].label} · ${s.label}`}
                      className={cx(
                        'tnum group relative grid h-11 place-items-center rounded-lg border text-[12px] font-semibold transition-transform hover:-translate-y-0.5',
                        c.statut === 'occupee' && 'border-maj/25 bg-maj-50 text-maj',
                        c.statut === 'propre' && 'border-jade/25 bg-jade-100 text-jade',
                        c.statut === 'a_nettoyer' && 'border-saffron/25 bg-saffron-100 text-saffron',
                        c.statut === 'hors_service' && 'border-crimson/25 bg-crimson-100 text-crimson',
                      )}
                    >
                      {c.numero}
                      {c.note && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-crimson" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader titre="À traiter" sousTitre={`${alertes.length} points d’attention`} />
            <ul className="divide-y divide-line-soft">
              {alertes.map((a) => (
                <li key={a.titre} className="flex gap-2.5 px-5 py-3">
                  <AlerteIcone niveau={a.niveau} />
                  <div className="min-w-0">
                    <p className="text-[12px] leading-4 font-medium text-ink">{a.titre}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-ink-3">{a.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader titre="Répartition du CA" sousTitre={`En cours · ${money(kpi.caTotal)} MAD`} />
            <div className="px-5 py-4">
              <div className="flex h-2 overflow-hidden rounded-full bg-sand-200">
                {parts.map((p) => (
                  <div key={p.label} className={p.tone} style={{ width: `${(p.valeur / Math.max(1, kpi.caTotal)) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-3 space-y-2">
                {parts.map((p) => (
                  <li key={p.label} className="flex items-center gap-2 text-[12px]">
                    <span className={cx('size-2 rounded-full', p.tone)} />
                    <span className="flex-1 text-ink-2">{p.label}</span>
                    <span className="tnum font-medium text-ink">{money(p.valeur)}</span>
                    <span className="tnum w-9 text-right text-[11px] text-ink-3">
                      {Math.round((p.valeur / Math.max(1, kpi.caTotal)) * 100)} %
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <CardHeader
              titre="Mix par canal"
              sousTitre={`${money(parCanal.total)} MAD de séjours fermes`}
            />
            <ul className="space-y-2.5 px-5 py-4">
              {parCanal.lignes.map((l) => (
                <li key={l.cle}>
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className={cx('size-2 rounded-full', l.dot)} />
                    <span className="flex-1 text-ink-2">{l.label}</span>
                    <span className="tnum font-medium text-ink">{money(l.valeur)}</span>
                    <span className="tnum w-9 text-right text-[11px] text-ink-3">{l.part} %</span>
                  </div>
                  <Bar value={l.part} tone={l.dot} className="mt-1.5" />
                </li>
              ))}
            </ul>
            <div className="border-t border-line-soft px-5 py-2.5">
              <p className="text-[10px] leading-4 text-ink-3">
                Cible cahier des charges §1.1 : walk-in 70 %, direct 20 %, Booking 10 %.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader titre="Demain" sousTitre="Préparatifs cuisine & salle" />
            <div className="space-y-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-terra-100 text-terra">
                  <Coffee className="size-4" />
                </span>
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-ink">{couvertsDemain} petits-déjeuners</p>
                  <Bar value={couvertsDemain} max={45} tone="bg-terra" className="mt-1.5" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-saffron-100 text-saffron">
                  <Users className="size-4" />
                </span>
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-ink">
                    {evenementDemain ? `${evenementDemain.entreprise} — ${evenementDemain.participants} pers.` : 'Salle libre demain'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    {evenementDemain ? 'Mise en place à partir de 8:00' : 'Aucun événement confirmé'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-maj-100 text-maj">
                  <BedDouble className="size-4" />
                </span>
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-ink">
                    {state.chambres.length - kpi.vendues} chambres à vendre ce soir
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-3">Dont {parStatut.propre ?? 0} prêtes immédiatement</p>
                </div>
              </div>
            </div>
            <div className="border-t border-line-soft px-5 py-3">
              <Button variant="soft" size="sm" className="w-full" onClick={() => onNavigate('conference')}>
                Préparer la salle <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader titre="Activité récente" sousTitre="Journal d’audit de la démonstration" />
            <ul className="divide-y divide-line-soft">
              {state.journal.slice(0, 5).map((j) => (
                <li key={j.id} className="flex gap-2.5 px-5 py-2.5">
                  <span className="tnum text-[10px] text-ink-3">{j.heure}</span>
                  <p className="flex-1 text-[11px] leading-4 text-ink-2">{j.texte}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
