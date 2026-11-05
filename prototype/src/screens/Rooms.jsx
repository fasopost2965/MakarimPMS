// Plan des chambres — vue par étage, filtres d'état, recherche et panneau de
// chambre (séjour en cours, arrivée attendue, actions housekeeping).
//
// Règles métier : BR-CHA-002/003 (états et vendabilité), BR-HK-001/003
// (ménage et contrôle), BR-MNT-001 (hors service), BR-HK-004 (aucun montant
// visible pour les profils non financiers).

import { useMemo, useState } from 'react';
import {
  BedDouble,
  CheckCircle2,
  DoorOpen,
  Search,
  Sparkles,
  TriangleAlert,
  Users,
  Wrench,
} from 'lucide-react';
import { PROFILS, STATUTS_CHAMBRE, TYPES_CHAMBRE } from '../data';
import { soldeDuFolio, useApp } from '../store';
import { fmtCourt, money } from '../lib/date';
import { Button, Card, Drawer, Pill, cx, useToast } from '../components/ui';

const FILTRES = [
  { cle: 'toutes', label: 'Toutes' },
  { cle: 'occupee', label: 'Occupées' },
  { cle: 'propre', label: 'Libres propres' },
  { cle: 'a_nettoyer', label: 'À nettoyer' },
  { cle: 'hors_service', label: 'Hors service' },
];

const TONE = { occupee: 'maj', propre: 'jade', a_nettoyer: 'saffron', hors_service: 'crimson' };

export function Rooms() {
  const { state, actions } = useApp();
  // BR-HK-004 : le rôle Gouvernante (et la Maintenance) n'a accès à aucune
  // donnée de facturation — les montants sont masqués, pas seulement cachés.
  const montants = (PROFILS[state.profil] ?? PROFILS.direction).montants !== false;
  const { push } = useToast();
  const [filtre, setFiltre] = useState('toutes');
  const [recherche, setRecherche] = useState('');
  const [selection, setSelection] = useState(null);
  const [etageActif, setEtageActif] = useState('tous');

  const chambre = selection ? state.chambres.find((c) => c.numero === selection) : null;
  const sejour = chambre ? state.sejours.find((s) => s.id === chambre.sejourId) : null;
  const folio = sejour ? state.folios.find((f) => f.id === sejour.folioId) : null;
  const resaAttendue = chambre
    ? state.reservations.find((r) => r.chambre === chambre.numero && r.statut === 'confirmee' && r.arrivee === state.date)
    : null;

  const liste = useMemo(
    () =>
      state.chambres.filter((c) => {
        const okFiltre = filtre === 'toutes' || c.statut === filtre;
        const okEtage = etageActif === 'tous' || String(c.etage) === etageActif;
        const q = recherche.trim().toLowerCase();
        const client = state.sejours.find((s) => s.id === c.sejourId)?.client ?? '';
        const okQ = !q || c.numero.includes(q) || TYPES_CHAMBRE[c.type].label.toLowerCase().includes(q) || client.toLowerCase().includes(q);
        return okFiltre && okEtage && okQ;
      }),
    [state, filtre, etageActif, recherche],
  );

  const compteur = (cle) => (cle === 'toutes' ? state.chambres.length : state.chambres.filter((c) => c.statut === cle).length);

  function changer(statut, message) {
    actions.setRoomStatus(chambre.numero, statut);
    push(message);
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.1em] text-ink-3 uppercase">Exploitation · Housekeeping</p>
          <h2 className="font-display mt-1 text-[26px] leading-tight">Plan des chambres</h2>
          <p className="mt-1 text-[13px] text-ink-2">
            30 chambres sur 3 étages · 12 doubles, 7 twins, 7 triples familiales, 4 suites junior.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 py-2">
            <Search className="size-3.5 text-ink-3" />
            <input
              aria-label="Rechercher une chambre par numéro, type ou client"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="N° chambre, client…"
              className="w-40 bg-transparent text-xs text-ink outline-none placeholder:text-ink-3"
            />
          </div>
          <Button variant="outline" onClick={() => push('Rapport de gouvernante exporté (PDF)', 'info')}>
            <Sparkles className="size-3.5" /> Rapport gouvernante
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTRES.map((f) => (
          <button
            key={f.cle}
            type="button"
            onClick={() => setFiltre(f.cle)}
            className={cx(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors',
              filtre === f.cle ? 'border-maj/30 bg-maj-100 text-maj' : 'border-line bg-surface text-ink-2 hover:bg-sand-50',
            )}
          >
            {f.cle !== 'toutes' && <span className={cx('size-2 rounded-full', STATUTS_CHAMBRE[f.cle].dot)} />}
            {f.label}
            <span className="tnum text-[11px] text-ink-3">{compteur(f.cle)}</span>
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        {['tous', '1', '2', '3'].map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEtageActif(e)}
            className={cx(
              'rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors',
              etageActif === e ? 'bg-ink text-white' : 'border border-line bg-surface text-ink-2 hover:bg-sand-50',
            )}
          >
            {e === 'tous' ? 'Tous les étages' : `Étage ${e}`}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {[1, 2, 3]
          .filter((e) => etageActif === 'tous' || String(e) === etageActif)
          .map((etage) => {
            const duRdc = liste.filter((c) => c.etage === etage);
            if (!duRdc.length) return null;
            return (
              <Card key={etage} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-line-soft px-5 py-3">
                  <h3 className="text-[13px] font-semibold text-ink">
                    {etage}ᵉ étage <span className="ml-2 text-[11px] font-normal text-ink-3">{duRdc.length} chambres</span>
                  </h3>
                  <div className="tnum flex gap-3 text-[11px] text-ink-3">
                    <span>{duRdc.filter((c) => c.statut === 'occupee').length} occupées</span>
                    <span>{duRdc.filter((c) => c.statut === 'propre').length} propres</span>
                  </div>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {duRdc.map((c) => {
                    const s = STATUTS_CHAMBRE[c.statut];
                    const sj = state.sejours.find((x) => x.id === c.sejourId);
                    return (
                      <button
                        key={c.numero}
                        type="button"
                        onClick={() => setSelection(c.numero)}
                        className="group rounded-xl border border-line bg-surface p-3 text-left transition-all hover:-translate-y-0.5 hover:border-maj/30 hover:shadow-card"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className={cx('tnum grid size-9 place-items-center rounded-lg text-[13px] font-semibold', s.chip)}>
                              {c.numero}
                            </span>
                            <div>
                              <p className="text-[12px] font-medium text-ink">{TYPES_CHAMBRE[c.type].court}</p>
                              <p className="text-[10px] text-ink-3">{TYPES_CHAMBRE[c.type].label}</p>
                            </div>
                          </div>
                          <span className={cx('mt-1 size-2 rounded-full', s.dot)} title={s.label} />
                        </div>

                        <div className="mt-2.5 min-h-[30px]">
                          {sj ? (
                            <>
                              <p className="truncate text-[12px] font-medium text-ink">{sj.client}</p>
                              <p className="mt-0.5 text-[10px] text-ink-3">
                                Départ {fmtCourt(sj.depart)} · {sj.formule} · {sj.occupants} pers.
                              </p>
                            </>
                          ) : c.note ? (
                            <p className="text-[10px] leading-4 text-crimson">{c.note}</p>
                          ) : c.statut === 'propre' ? (
                            <p className="text-[10px] text-ink-3">
                              {montants ? `Prête à la vente · ${TYPES_CHAMBRE[c.type].prix} MAD` : 'Prête à la vente'}
                            </p>
                          ) : (
                            <p className="text-[10px] text-ink-3">En attente de validation gouvernante</p>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between border-t border-line-soft pt-2">
                          <Pill tone={TONE[c.statut]}>{s.label}</Pill>
                          <span className="tnum text-[11px] font-medium text-ink-2">
                            {montants ? `${TYPES_CHAMBRE[c.type].prix} MAD` : TYPES_CHAMBRE[c.type].court}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        {!liste.length && <Card className="p-10 text-center text-[13px] text-ink-3">Aucune chambre ne correspond à ce filtre.</Card>}
      </div>

      <Drawer
        open={Boolean(chambre)}
        onClose={() => setSelection(null)}
        title={`Chambre ${chambre?.numero ?? ''}`}
        subtitle={
          chambre
            ? `${TYPES_CHAMBRE[chambre.type].label} · ${chambre.etage}ᵉ étage${montants ? ` · ${TYPES_CHAMBRE[chambre.type].prix} MAD / nuit` : ''}`
            : ''
        }
        footer={
          chambre && (
            <div className="flex gap-2">
              {chambre.statut === 'hors_service' ? (
                <Button className="flex-1" onClick={() => changer('a_nettoyer', `Chambre ${chambre.numero} remise en service — à nettoyer`)}>
                  <CheckCircle2 className="size-3.5" /> Remettre en service
                </Button>
              ) : (
                <>
                  <Button variant="outline" className="flex-1" onClick={() => changer('hors_service', `Chambre ${chambre.numero} déclarée hors service`)}>
                    <Wrench className="size-3.5" /> Hors service
                  </Button>
                  {chambre.statut === 'a_nettoyer' ? (
                    <Button className="flex-1" onClick={() => changer('propre', `Chambre ${chambre.numero} validée propre`)}>
                      <CheckCircle2 className="size-3.5" /> Valider propre
                    </Button>
                  ) : (
                    <Button variant="soft" className="flex-1" onClick={() => changer('propre', `Chambre ${chambre.numero} marquée propre`)}>
                      <Sparkles className="size-3.5" /> Marquer propre
                    </Button>
                  )}
                </>
              )}
            </div>
          )
        }
      >
        {chambre && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <Pill tone={TONE[chambre.statut]}>{STATUTS_CHAMBRE[chambre.statut].label}</Pill>
                  {montants ? (
                    <>
                      <p className="mt-2 font-display text-2xl">{TYPES_CHAMBRE[chambre.type].prix} MAD</p>
                      <p className="text-[11px] text-ink-3">Tarif de base TTC · TVA 10 % incluse</p>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 font-display text-2xl">{TYPES_CHAMBRE[chambre.type].label}</p>
                      <p className="text-[11px] text-ink-3">Vue housekeeping — données de facturation masquées</p>
                    </>
                  )}
                </div>
                <div className="grid size-12 place-items-center rounded-xl bg-maj-50 text-maj">
                  <BedDouble className="size-6" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line-soft pt-3 text-[12px]">
                <span className="flex items-center gap-1.5 text-ink-2">
                  <Users className="size-3.5 text-ink-3" /> {TYPES_CHAMBRE[chambre.type].capacite} pers.
                </span>
                <span className="flex items-center gap-1.5 text-ink-2">
                  <DoorOpen className="size-3.5 text-ink-3" /> Étage {chambre.etage}
                </span>
              </div>
            </Card>

            {sejour ? (
              <Card className="p-4">
                <p className="text-[10px] font-semibold tracking-[0.09em] text-ink-3 uppercase">Séjour en cours</p>
                <p className="mt-2 text-[14px] font-semibold text-ink">{sejour.client}</p>
                <dl className="mt-3 space-y-2 text-[12px]">
                  {[
                    ['Formule', sejour.formule],
                    ['Occupants', `${sejour.occupants} personne(s)`],
                    ['Arrivée', fmtCourt(sejour.arrivee)],
                    ['Départ prévu', fmtCourt(sejour.depart)],
                    ...(montants ? [['Folio', folio ? `Solde ${money(soldeDuFolio(folio))} MAD` : '—']] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <dt className="text-ink-3">{k}</dt>
                      <dd className="font-medium text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 rounded-lg bg-sand-100 px-3 py-2 text-[11px] leading-4 text-ink-2">
                  Le check-out se fait depuis la caisse : il exige un solde nul et génère
                  automatiquement la facture.
                </p>
              </Card>
            ) : resaAttendue ? (
              <Card className="border-maj/30 bg-maj-50/50 p-4">
                <div className="flex gap-2">
                  <DoorOpen className="mt-0.5 size-4 shrink-0 text-maj" />
                  <div>
                    <p className="text-[12px] font-medium text-ink">Arrivée attendue — {resaAttendue.client}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-ink-2">
                      {resaAttendue.occupants} personne(s) · {fmtCourt(resaAttendue.arrivee)} → {fmtCourt(resaAttendue.depart)}
                      {chambre.statut !== 'propre' && ' · chambre à valider avant check-in'}
                    </p>
                    <Button
                      size="sm"
                      className="mt-2"
                      disabled={chambre.statut !== 'propre'}
                      onClick={() => {
                        actions.checkIn(resaAttendue.id);
                        push(`Check-in effectué — chambre ${chambre.numero}.`);
                        setSelection(null);
                      }}
                    >
                      Enregistrer l’arrivée
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="border-saffron/40 bg-saffron-100/40 p-4">
                <div className="flex gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-saffron" />
                  <p className="text-[12px] leading-5 text-ink-2">
                    {chambre.note ?? 'Chambre libre : vendable dès que l’état « propre » est validé par la gouvernante.'}
                  </p>
                </div>
              </Card>
            )}

            <Card className="p-4">
              <p className="text-[10px] font-semibold tracking-[0.09em] text-ink-3 uppercase">Housekeeping</p>
              <ul className="mt-2 space-y-2 text-[12px] text-ink-2">
                <li className="flex justify-between">
                  <span>Type de service</span>
                  <span className="font-medium text-ink">{sejour ? 'Recouche' : 'Départ'}</span>
                </li>
                <li className="flex justify-between">
                  <span>Assignée à</span>
                  <span className="font-medium text-ink">Fatima Z. (étage {chambre.etage})</span>
                </li>
                <li className="flex justify-between">
                  <span>Dernière transition</span>
                  <span className="font-medium text-ink">Aujourd’hui</span>
                </li>
              </ul>
            </Card>
          </div>
        )}
      </Drawer>
    </div>
  );
}
