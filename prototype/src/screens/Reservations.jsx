// Réservations · planning 14 jours × 30 chambres, filtres par canal, création
// avec contrôle de disponibilité et prix calculés en direct, détail et
// annulation.
//
// Règles métier : BR-RES-001 (anti double-booking), BR-RES-002/003 (cycle de vie
// et canal obligatoire), BR-SEJ-002 (check-in depuis le planning).

import { useMemo, useState } from 'react';
import {
  ArrowRightLeft, CalendarPlus, Check, DoorOpen, Filter, History, LogOut,
  MousePointerClick, UserCheck, Users, X,
} from 'lucide-react';
import {
  CANAUX, FORMULES, MOTIFS_CHANGEMENT, RANG_STANDING, SUIVI_NO_SHOW, TYPES_CHAMBRE,
  TYPES_SEJOUR,
} from '../data';
import { InfoBulle } from '../components/InfoBulle';
import {
  chambresDisponibles, historiqueClient, noShowsASuivre, prixDuJour, soldeDuFolio, useApp,
} from '../store';
import { fmtCourt, isoAdd, isoDiff, money, nuits } from '../lib/date';
import { montantHebergement } from '../lib/pricing';
import { Exports } from '../components/Exports';
import { Button, Card, CardHeader, Modal, Pill, cx, useToast } from '../components/ui';

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
  const [typeSejour, setTypeSejour] = useState('nuit');

  const demiJournee = state.parametres?.demiJournee ?? 200;
  const depart = typeSejour === 'nuit' ? isoAdd(arrivee, nbNuits) : arrivee;
  // Demi-journée : pas de nuit à réserver, on propose les chambres propres
  // non occupées (la disponibilité « par nuit » ne s'applique pas).
  const dispo = useMemo(
    () =>
      typeSejour === 'nuit'
        ? chambresDisponibles(state, arrivee, depart)
        : state.chambres.filter((c) => c.statut === 'propre' && c.active !== false),
    [state, arrivee, depart, typeSejour],
  );
  const chambre = dispo.find((c) => c.numero === chambreChoisie) ?? null;
  const prix = !chambre
    ? 0
    : typeSejour === 'nuit'
      ? montantHebergement(chambre.type, formule, occupants, nbNuits, state.parametres?.grille)
      : demiJournee;
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
      typeSejour,
    });
    push(
      `Réservation créée · ${client.trim()}, chambre ${chambre.numero}, ${money(prix)} MAD${typeSejour !== 'nuit' ? ' (demi-journée)' : ''}.`,
    );
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
            <span className="text-ink-3">
              {' '}· {typeSejour === 'nuit' ? `${nbNuits} nuit(s)` : TYPES_SEJOUR[typeSejour].label}
            </span>
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
      <div className="mb-4">
        <span id="resa-type" className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2">
          Type de séjour
          <InfoBulle titre="Séjour à la demi-journée">
            Une matinée ou un après-midi se facture au forfait ({demiJournee} MAD) : pas de nuitée,
            donc pas de taxe de séjour, et la chambre redevient vendable le soir. Le forfait se règle
            dans « Tarifs & paramètres ».
          </InfoBulle>
        </span>
        <div role="group" aria-labelledby="resa-type" className="mt-1.5 flex flex-wrap gap-1.5">
          {Object.entries(TYPES_SEJOUR).map(([cle, t]) => (
            <button
              key={cle}
              type="button"
              onClick={() => {
                setTypeSejour(cle);
                setChambreChoisie(null);
              }}
              className={cx(
                'rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors',
                typeSejour === cle
                  ? 'border-maj bg-maj-50 text-maj'
                  : 'border-line bg-surface text-ink-2 hover:bg-mist-50',
              )}
            >
              {t.label}
              {t.forfait ? ` · ${t.forfait} MAD` : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="resa-client" className="text-[12px] font-semibold text-ink-2">
            Client
          </label>
          <input
            id="resa-client"
            autoFocus
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Nom du client ou de l’entreprise"
            className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-[13px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
          />
        </div>

        <div className="sm:col-span-2">
          <span id="resa-canal" className="text-[12px] font-semibold text-ink-2">
            Canal
          </span>
          <div role="group" aria-labelledby="resa-canal" className="mt-1.5 flex flex-wrap gap-1.5">
            {Object.entries(CANAUX).map(([cle, c]) => (
              <button
                key={cle}
                type="button"
                onClick={() => setCanal(cle)}
                className={cx(
                  'rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors',
                  canal === cle ? c.classe : 'border-line bg-surface text-ink-2 hover:bg-mist-50',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="resa-arrivee" className="text-[12px] font-semibold text-ink-2">
            Arrivée
          </label>
          <input
            id="resa-arrivee"
            type="date"
            value={arrivee}
            min={state.date}
            onChange={(e) => setArrivee(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
          />
        </div>

        <div className={typeSejour === 'nuit' ? '' : 'hidden'}>
          <span id="resa-nuitees" className="text-[12px] font-semibold text-ink-2">
            Nuitées
          </span>
          <div role="group" aria-labelledby="resa-nuitees" className="mt-1.5 flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setNbNuits((n) => Math.max(1, n - 1))} aria-label="Retirer une nuit">−</Button>
            <span aria-live="polite" className="tnum w-10 text-center text-[15px] font-semibold">
              {nbNuits}
            </span>
            <Button variant="outline" size="sm" onClick={() => setNbNuits((n) => Math.min(30, n + 1))} aria-label="Ajouter une nuit">+</Button>
            <span className="ml-1 text-[12px] text-ink-3">→ départ {fmtCourt(depart)}</span>
          </div>
        </div>

        <div>
          <span id="resa-occupants" className="text-[12px] font-semibold text-ink-2">
            Occupants
          </span>
          <div role="group" aria-labelledby="resa-occupants" className="mt-1.5 flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setOccupants((n) => Math.max(1, n - 1))} aria-label="Retirer une personne">−</Button>
            <span aria-live="polite" className="tnum w-8 text-center text-[15px] font-semibold">
              {occupants}
            </span>
            <Button variant="outline" size="sm" onClick={() => setOccupants((n) => Math.min(3, n + 1))} aria-label="Ajouter une personne">+</Button>
          </div>
        </div>

        <div className={typeSejour === 'nuit' ? '' : 'hidden'}>
          <label htmlFor="resa-formule" className="text-[12px] font-semibold text-ink-2">
            Formule
          </label>
          <select
            id="resa-formule"
            value={formule}
            onChange={(e) => setFormule(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
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
            <span id="resa-chambres" className="text-[12px] font-semibold text-ink-2">
              Chambres disponibles ({dispo.length})
            </span>
            <span className="text-[12px] text-ink-3">{fmtCourt(arrivee)} → {fmtCourt(depart)}</span>
          </div>
          <div
            role="group"
            aria-labelledby="resa-chambres"
            className="mt-1.5 grid max-h-44 grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5 overflow-y-auto rounded-lg border border-line bg-mist-50 p-2"
          >
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
                    : 'border-line bg-surface text-ink-2 hover:border-maj/40',
                )}
              >
                <span className="tnum block text-[12px] font-semibold">{c.numero}</span>
                <span className="block text-[11px] opacity-80">{TYPES_CHAMBRE[c.type].court}</span>
              </button>
            ))}
          </div>
          {chambre && occupants > TYPES_CHAMBRE[chambre.type].capacite && (
            <p className="mt-1 text-[12px] text-crimson">Cette chambre accueille {TYPES_CHAMBRE[chambre.type].capacite} personnes maximum.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------
// Changement de chambre.
//
// Ce n'est pas une correction de saisie : c'est un événement de séjour, avec
// un motif, une origine (client ou hôtel) et une trace. Les règles affichées
// ici sont celles du réducteur, pas des convenances d'écran :
//  - chambre libre sur les mêmes dates ;
//  - standing égal ou supérieur (BR-SEJ-008) ;
//  - le supplément éventuel suit l'origine du motif.
// ------------------------------------------------------------------
function ChangementChambre({ cible, onClose }) {
  const { state, actions } = useApp();
  const { push } = useToast();
  const [numero, setNumero] = useState(null);
  const [motif, setMotif] = useState('maintenance');
  const [commentaire, setCommentaire] = useState('');

  const source = state.chambres.find((c) => c.numero === cible.chambre);
  const rangSource = RANG_STANDING[source?.type] ?? 1;

  const candidates = useMemo(
    () =>
      state.chambres.filter((c) => {
        if (c.numero === cible.chambre || c.active === false || c.statut === 'hors_service') return false;
        if ((RANG_STANDING[c.type] ?? 1) < rangSource) return false;
        const chevauche = [...state.reservations, ...state.sejours].some(
          (x) =>
            x.chambre === c.numero &&
            x.id !== cible.id &&
            x.arrivee < cible.depart &&
            x.depart > cible.arrivee,
        );
        return !chevauche;
      }),
    [state, cible, rangSource],
  );

  const motifRef = MOTIFS_CHANGEMENT.find((m) => m.cle === motif) ?? MOTIFS_CHANGEMENT[0];
  const choisie = state.chambres.find((c) => c.numero === numero);
  const supplement = choisie
    ? (prixDuJour(state, choisie.type) - prixDuJour(state, source?.type)) * Math.max(1, isoDiff(cible.depart, cible.arrivee))
    : 0;
  const commentaireRequis = motifRef.cle === 'autre' || motifRef.origine === 'client';
  const valide = Boolean(choisie) && (!commentaireRequis || commentaire.trim().length > 4);

  return (
    <Modal
      open
      onClose={onClose}
      title="Changer de chambre"
      subtitle={`${cible.client} · chambre ${cible.chambre} (${TYPES_CHAMBRE[source?.type]?.court ?? 'nc'})`}
      width="max-w-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-ink-2">
            {choisie ? (
              <>
                Supplément{' '}
                <span className="tnum font-semibold text-ink">
                  {money(motifRef.tarif === 'gratuit' ? 0 : Math.max(0, supplement))} MAD
                </span>{' '}
                · {motifRef.tarif === 'hotel' ? 'à la charge de l’hôtel' : motifRef.tarif === 'gratuit' ? 'sans frais' : 'facturé au client'}
              </>
            ) : (
              'Choisissez une chambre d’accueil'
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button
              disabled={!valide}
              onClick={() => {
                actions.changerChambre({
                  refType: cible.origine === 'resa' ? 'resa' : 'sejour',
                  refId: cible.id,
                  chambre: numero,
                  motif,
                  commentaire: commentaire.trim(),
                  par: state.session?.nom ?? 'Réception',
                });
                push(`${cible.client} déplacé en chambre ${numero} · motif tracé.`, 'success');
                onClose();
              }}
            >
              <ArrowRightLeft className="size-3.5" /> Déplacer
            </Button>
          </div>
        </div>
      }
    >
      <p className="mb-3 rounded-lg bg-mist-100 px-3 py-2 text-[11px] leading-4 text-ink-2">
        Seules les chambres de <strong>standing égal ou supérieur</strong> sont proposées. Un
        changement vers un standing inférieur exige une décision de la Direction (BR-SEJ-008).
      </p>

      <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
        {candidates.length === 0 && (
          <p className="py-6 text-center text-[12px] text-ink-3">
            Aucune chambre de standing suffisant n’est libre sur ces dates.
          </p>
        )}
        {candidates.map((c) => (
          <button
            key={c.numero}
            type="button"
            onClick={() => setNumero(c.numero)}
            className={cx(
              'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
              numero === c.numero ? 'border-maj bg-maj-50' : 'border-line bg-surface hover:bg-mist-50',
            )}
          >
            <span className="tnum w-10 text-[13px] font-semibold text-ink">{c.numero}</span>
            <span className="flex-1 text-[12px] text-ink-2">
              {TYPES_CHAMBRE[c.type].label} · {c.etage}ᵉ étage
            </span>
            <span className="text-[11px] text-ink-3">{c.statut === 'propre' ? 'propre' : 'à nettoyer'}</span>
            <span className="tnum w-20 text-right text-[12px] text-ink">{prixDuJour(state, c.type)} MAD</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="chg-motif" className="text-[12px] font-semibold text-ink-2">Motif</label>
          <select
            id="chg-motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
          >
            {MOTIFS_CHANGEMENT.map((m) => (
              <option key={m.cle} value={m.cle}>{m.label}</option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-ink-3">
            Origine : {motifRef.origine === 'hotel' ? 'hôtel' : 'client'}
          </p>
        </div>
        <div>
          <label htmlFor="chg-commentaire" className="text-[12px] font-semibold text-ink-2">
            Commentaire {commentaireRequis ? '(obligatoire)' : '(facultatif)'}
          </label>
          <textarea
            id="chg-commentaire"
            rows={3}
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Ce qui motive le déplacement, et ce qui a été dit au client"
            className="mt-1.5 w-full resize-none rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
          />
        </div>
      </div>
    </Modal>
  );
}

// Dossier client : tout ce que l'hôtel sait du client en un écran · séjours
// passés, réservations, factures et changements de chambre. C'est la mémoire
// que la réception perd aujourd'hui entre deux saisons.
function DossierClient({ nom, onClose }) {
  const { state } = useApp();
  const h = historiqueClient(state, nom);
  const total = h.factures.reduce((s, f) => s + f.montant, 0);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Dossier client · ${nom}`}
      subtitle={`${h.sejours.length + h.reservations.length} séjour(s) · ${money(total)} MAD facturés`}
      width="max-w-2xl"
      footer={<div className="flex justify-end"><Button variant="outline" onClick={onClose}>Fermer</Button></div>}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Séjours', h.sejours.length],
          ['Réservations', h.reservations.length],
          ['Non-présentations', h.noShows.length],
        ].map(([l, v]) => (
          <div key={l} className="rounded-lg border border-line bg-mist-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.06em] text-ink-3">{l}</p>
            <p className="tnum text-[16px] font-semibold text-ink">{v}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-4 mb-1.5 text-[11px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
        Historique des séjours
      </h3>
      <ul className="divide-y divide-line-soft text-[12px]">
        {[...h.sejours, ...h.reservations].length === 0 && (
          <li className="py-2 text-ink-3">Premier séjour · aucun historique.</li>
        )}
        {[...h.sejours, ...h.reservations]
          .sort((a, b) => b.arrivee.localeCompare(a.arrivee))
          .map((x) => (
            <li key={`${x.id}-${x.arrivee}`} className="flex items-center gap-3 py-1.5">
              <span className="tnum w-10 text-ink-2">{x.chambre}</span>
              <span className="flex-1">
                {fmtCourt(x.arrivee)} → {fmtCourt(x.depart)}
                <span className="ml-2 text-ink-3">
                  {FORMULES.find((f) => f.code === x.formule)?.label ?? x.formule}
                </span>
              </span>
              <Pill tone={x.statut === 'terminee' ? 'neutral' : x.statut === 'en_sejour' ? 'jade' : 'maj'}>
                {x.statut === 'en_sejour' ? 'En séjour' : x.statut === 'terminee' ? 'Terminé' : 'À venir'}
              </Pill>
            </li>
          ))}
      </ul>

      <h3 className="mt-4 mb-1.5 text-[11px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
        Changements de chambre
      </h3>
      <ul className="divide-y divide-line-soft text-[12px]">
        {h.changements.length === 0 && <li className="py-2 text-ink-3">Aucun changement enregistré.</li>}
        {h.changements.map((c) => (
          <li key={c.id} className="py-1.5">
            <p className="text-ink">
              {c.de} → {c.vers} <span className="text-ink-3">· {fmtCourt(c.date)} {c.heure}</span>
            </p>
            <p className="text-[11px] text-ink-3">
              {c.motifLabel} · origine {c.origine} · par {c.par}
              {c.commentaire ? ` · « ${c.commentaire} »` : ''}
            </p>
          </li>
        ))}
      </ul>

      {h.noShows.length > 0 && (
        <>
          <h3 className="mt-4 mb-1.5 text-[11px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
            Non-présentations
          </h3>
          <ul className="divide-y divide-line-soft text-[12px]">
            {h.noShows.map((n) => (
              <li key={n.id} className="py-1.5">
                <p className="text-ink">
                  {fmtCourt(n.arrivee)} · chambre {n.chambre} · {money(n.montant)} MAD
                </p>
                <p className="text-[11px] text-ink-3">
                  {n.suiviNote || 'dossier de suivi ouvert'} · {n.factureId}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="mt-4 mb-1.5 text-[11px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
        Factures
      </h3>
      <ul className="divide-y divide-line-soft text-[12px]">
        {h.factures.length === 0 && <li className="py-2 text-ink-3">Aucune facture.</li>}
        {h.factures.map((f) => (
          <li key={f.id} className="flex justify-between py-1.5">
            <span>{f.id} · {fmtCourt(f.date)}</span>
            <span className="tnum font-medium">{money(f.montant)} MAD</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

// ------------------------------------------------------------------
// Suivi des non-présentations.
//
// Un no-show n'est pas une ligne rayée : la nuit est facturée, le client peut
// contester, l'OTA peut reprendre la main. Le dossier reste donc ouvert avec
// un statut de suivi, une note et un historique d'étapes horodatées jusqu'à
// clôture explicite.
// ------------------------------------------------------------------
function SuiviNoShows() {
  const { state, actions } = useApp();
  const { push } = useToast();
  const [dossier, setDossier] = useState(null);
  const [statut, setStatut] = useState('a_traiter');
  const [note, setNote] = useState('');

  const dossiers = state.noShows ?? [];
  const ouverts = noShowsASuivre(state);
  const montant = dossiers.reduce((s, n) => s + (n.montant ?? 0), 0);

  const ouvrir = (n) => {
    setDossier(n);
    setStatut(n.suivi);
    setNote('');
  };

  return (
    <Card>
      <CardHeader
        titre="Non-présentations"
        sousTitre={`${dossiers.length} enregistrée(s) · ${ouverts.length} à suivre · ${money(montant)} MAD facturés`}
        action={
          <Exports
            nom={`no-shows-${state.date}`}
            titre="Non-présentations"
            compact
            colonnes={[
              { cle: 'id', label: 'Dossier' },
              { cle: 'date', label: 'Date' },
              { cle: 'client', label: 'Client' },
              { cle: 'chambre', label: 'Chambre' },
              { cle: 'canal', label: 'Canal' },
              { cle: 'montant', label: 'Nuit facturée (MAD)' },
              { cle: 'factureId', label: 'Facture' },
              { cle: 'suivi', label: 'Suivi' },
              { cle: 'suiviPar', label: 'Suivi par' },
            ]}
            lignes={dossiers.map((n) => ({
              id: n.id,
              date: fmtCourt(n.date),
              client: n.client,
              chambre: n.chambre,
              canal: CANAUX[n.canal]?.label ?? n.canal,
              montant: n.montant,
              factureId: n.factureId,
              suivi: SUIVI_NO_SHOW.find((x) => x.cle === n.suivi)?.label ?? n.suivi,
              suiviPar: n.suiviPar ?? 'nc',
            }))}
          />
        }
      />
      <ul className="divide-y divide-line-soft">
        {dossiers.length === 0 && (
          <li className="px-5 py-6 text-center text-[13px] text-ink-3">
            Aucune non-présentation enregistrée. Elles apparaissent ici dès qu’une
            réservation confirmée n’est pas honorée.
          </li>
        )}
        {dossiers.map((n) => {
          const etape = SUIVI_NO_SHOW.find((x) => x.cle === n.suivi) ?? SUIVI_NO_SHOW[0];
          return (
            <li key={n.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="tnum grid size-9 place-items-center rounded-[8px] bg-mist-100 text-[11px] font-semibold text-ink-2">
                {n.chambre}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">
                  {n.client}
                  <span className="ml-2 font-normal text-ink-3">
                    {fmtCourt(n.date)} · {n.heure} · {CANAUX[n.canal]?.label ?? n.canal}
                  </span>
                </p>
                <p className="truncate text-[12px] text-ink-3">
                  {n.factureId} · {money(n.montant)} MAD
                  {n.suiviNote ? ` · ${n.suiviNote}` : ''}
                </p>
              </div>
              <Pill tone={etape.tone}>{etape.label}</Pill>
              <Button size="sm" variant="outline" onClick={() => ouvrir(n)}>
                Suivre
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-line-soft px-5 py-3">
        <p className="text-[12px] leading-[1.5] text-ink-3">
          Chaque non-présentation enregistre la nuit retenue, la facture émise et un dossier de
          suivi. Le dossier ne se ferme que par une décision explicite (nuit réglée ou clos sans
          suite), avec son auteur et sa date.
        </p>
      </div>

      {dossier && (
        <Modal
          open
          onClose={() => setDossier(null)}
          title={`Suivi · ${dossier.client}`}
          subtitle={`${dossier.id} · nuit ${dossier.chambre} du ${fmtCourt(dossier.arrivee)} · facture ${dossier.factureId}`}
          width="max-w-md"
          footer={
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setDossier(null)}>Fermer</Button>
              <Button
                onClick={() => {
                  actions.suivreNoShow(dossier.id, { suivi: statut, note }, state.session?.nom);
                  push(`Suivi mis à jour · ${dossier.client}.`, 'success');
                  setDossier(null);
                }}
              >
                Enregistrer le suivi
              </Button>
            </div>
          }
        >
          <fieldset>
            <legend className="text-[13px] font-medium text-ink-2">Étape du dossier</legend>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {SUIVI_NO_SHOW.map((x) => (
                <label
                  key={x.cle}
                  className={cx(
                    'flex cursor-pointer items-center gap-2 rounded-[11px] border px-3 py-2 text-[13px] transition-colors',
                    statut === x.cle ? 'border-maj bg-maj-50 text-ink' : 'border-line text-ink-2 hover:bg-mist-50',
                  )}
                >
                  <input
                    type="radio"
                    name="suivi-ns"
                    checked={statut === x.cle}
                    onChange={() => setStatut(x.cle)}
                    className="size-3.5 accent-[var(--color-maj)]"
                  />
                  {x.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4">
            <label htmlFor="ns-note" className="text-[13px] font-medium text-ink-2">
              Note de suivi
            </label>
            <textarea
              id="ns-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Appel du client, réponse de l’OTA, accord de la Direction…"
              className="mt-1.5 w-full resize-none rounded-[11px] border border-line-strong bg-surface px-3 py-2 text-[13px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/20"
            />
          </div>

          <h3 className="mt-4 text-[12px] font-semibold tracking-[0.02em] text-ink-3 uppercase">
            Historique
          </h3>
          <ul className="mt-2 space-y-2">
            <li className="text-[12px] text-ink-2">
              <span className="font-medium text-ink">{fmtCourt(dossier.date)}</span> · dossier ouvert
              ({dossier.source === 'cloture' ? 'clôture de journée' : 'réception'})
            </li>
            {(dossier.relances ?? []).map((r, i) => (
              <li key={`${r.le}-${i}`} className="text-[12px] text-ink-2">
                <span className="font-medium text-ink">{fmtCourt(r.le)}</span> · {r.texte} ·{' '}
                <span className="text-ink-3">{r.par}</span>
              </li>
            ))}
            {dossier.suiviLe && (dossier.relances ?? []).length === 0 && (
              <li className="text-[12px] text-ink-2">
                <span className="font-medium text-ink">{fmtCourt(dossier.suiviLe)}</span> ·{' '}
                {dossier.suiviNote || 'suivi enregistré'} ·{' '}
                <span className="text-ink-3">{dossier.suiviPar}</span>
              </li>
            )}
          </ul>
        </Modal>
      )}
    </Card>
  );
}

export function Reservations() {
  const { state, actions } = useApp();
  const { push } = useToast();
  const [filtre, setFiltre] = useState('tous');
  const [detail, setDetail] = useState(null);
  const [creation, setCreation] = useState(false);
  const [changement, setChangement] = useState(null);
  const [dossier, setDossier] = useState(null);

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

  // Files d'attente de la réception, calculées comme les sélecteurs du store.
  const arrivees = state.reservations.filter((r) => r.arrivee === state.date && r.statut === 'confirmee');
  const departs = state.sejours.filter((x) => x.depart === state.date);

  // Solde du séjour affiché dans le détail (check-out bloqué si non soldé).
  const folioDetail = detail ? state.folios.find((f) => f.id === detail.folioId) : null;
  const soldeDetail = folioDetail ? soldeDuFolio(folioDetail) : 0;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.1em] text-ink-3 uppercase">Pilotage · Planning</p>
          <h2 className="font-display mt-1 text-[26px] leading-tight">Réservations</h2>
          <p className="mt-1 text-[14px] text-ink-2">
            {fmtCourt(state.date)} → {fmtCourt(isoAdd(state.date, 13))} · {blocs.length} séjours au planning
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => push('Filtres avancés · second rideau', 'info')}>
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
            <p className="text-[11px] font-medium tracking-[0.06em] text-ink-3 uppercase">{l}</p>
            <p className="tnum mt-1.5 text-xl font-semibold text-ink">{v}</p>
            <p className="mt-0.5 text-[12px] text-ink-3">{h}</p>
          </Card>
        ))}
      </div>

      {/* Check-in et check-out au même endroit : c'est le geste le plus
          fréquent de la réception, il ne doit pas demander d'ouvrir un séjour. */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-2.5">
          <p className="text-[12px] font-semibold text-ink">Réception du jour</p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-ink-3">
              {arrivees.length} arrivée(s) · {departs.length} départ(s)
            </span>
            <Exports
              nom={`reception-${state.date}`}
              titre="Réception du jour"
              compact
              colonnes={[
                { cle: 'sens', label: 'Sens' },
                { cle: 'client', label: 'Client' },
                { cle: 'chambre', label: 'Chambre' },
                { cle: 'formule', label: 'Formule' },
                { cle: 'occupants', label: 'Occupants' },
                { cle: 'statut', label: 'Statut' },
              ]}
              lignes={[
                ...arrivees.map((r) => ({ sens: 'Arrivée', client: r.client, chambre: r.chambre, formule: r.formule, occupants: r.occupants, statut: 'À enregistrer' })),
                ...departs.map((x) => ({ sens: 'Départ', client: x.client, chambre: x.chambre, formule: x.formule, occupants: x.occupants, statut: 'À libérer' })),
              ]}
            />
          </div>
        </div>
        <div className="grid divide-y divide-line-soft lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div>
            <p className="flex items-center gap-1.5 px-4 pt-3 text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
              <UserCheck className="size-3.5" /> Arrivées à enregistrer
            </p>
            <ul className="divide-y divide-line-soft">
              {arrivees.length === 0 && (
                <li className="px-4 py-4 text-[12px] text-ink-3">Toutes les arrivées sont enregistrées.</li>
              )}
              {arrivees.map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-4 py-2">
                  <span className="tnum grid size-8 place-items-center rounded-lg bg-maj-50 text-[11px] font-semibold text-maj">
                    {r.chambre}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-ink">{r.client}</p>
                    <p className="text-[11px] text-ink-3">
                      {r.occupants} pers. · {FORMULES.find((f) => f.code === r.formule)?.label ?? r.formule}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      actions.checkIn(r.id);
                      push(`Check-in · ${r.client}, chambre ${r.chambre}.`, 'success');
                    }}
                  >
                    <Check className="size-3.5" /> Check-in
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="flex items-center gap-1.5 px-4 pt-3 text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
              <LogOut className="size-3.5" /> Départs du jour
            </p>
            <ul className="divide-y divide-line-soft">
              {departs.length === 0 && (
                <li className="px-4 py-4 text-[12px] text-ink-3">Aucun départ prévu aujourd’hui.</li>
              )}
              {departs.map((x) => {
                const folio = state.folios.find((f) => f.id === x.folioId);
                const du = folio ? soldeDuFolio(folio) : 0;
                return (
                  <li key={x.id} className="flex items-center gap-2 px-4 py-2">
                    <span className="tnum grid size-8 place-items-center rounded-lg bg-terra-100 text-[11px] font-semibold text-terra">
                      {x.chambre}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-ink">{x.client}</p>
                      <p className="text-[11px] text-ink-3">
                        {du > 0 ? `Solde à régler : ${money(du)} MAD` : 'Folio soldé'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={du > 0 ? 'outline' : 'primary'}
                      onClick={() => {
                        actions.checkOut(x.id);
                        push(`Check-out · ${x.client}, chambre ${x.chambre} libérée.`, 'success');
                      }}
                    >
                      <DoorOpen className="size-3.5" /> Check-out
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Card>

      <SuiviNoShows />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltre('tous')}
              className={cx('rounded-full px-2.5 py-1 text-[11px] font-medium', filtre === 'tous' ? 'bg-ink text-white' : 'bg-mist-100 text-ink-2')}
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
                  filtre === cle ? c.classe : 'border-line bg-surface text-ink-2 hover:bg-mist-50',
                )}
              >
                <span className={cx('size-1.5 rounded-full', c.dot)} />
                {c.label}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <MousePointerClick className="size-3.5" /> Cliquez sur un séjour pour le détail
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1020px]">
            <div className="grid border-b border-line bg-mist-50" style={{ gridTemplateColumns: `116px repeat(${JOURS_AFFICHES}, minmax(62px, 1fr))` }}>
              <div className="px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Chambre</div>
              {jours.map((j, i) => (
                <div key={j} className={cx('border-l border-line-soft px-2 py-2 text-center text-[11px] font-medium', i === 0 ? 'bg-maj-50 text-maj' : 'text-ink-2')}>
                  {fmtCourt(j).slice(0, 7)}
                </div>
              ))}
            </div>

            {[1, 2, 3].map((etage) => (
              <div key={etage}>
                <div className="border-b border-line-soft bg-mist-50/60 px-3 py-1.5">
                  <span className="text-[12px] font-semibold text-ink-2">{etage}ᵉ étage</span>
                </div>
                {state.chambres.filter((c) => c.etage === etage).map((chambre) => {
                  const sejours = filtres.filter((b) => b.chambre === chambre.numero);
                  return (
                    <div key={chambre.numero} className="grid border-b border-line-soft last:border-b-0 hover:bg-mist-50/40" style={{ gridTemplateColumns: `116px repeat(${JOURS_AFFICHES}, minmax(62px, 1fr))` }}>
                      <div className="flex items-center gap-2 px-3 py-1.5">
                        <span className="tnum text-[12px] font-semibold text-ink">{chambre.numero}</span>
                        <span className="text-[11px] text-ink-3">{TYPES_CHAMBRE[chambre.type].court}</span>
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
                                  'pointer-events-auto mx-0.5 flex h-6 items-center gap-1 self-center overflow-hidden rounded-lg border px-1.5 text-left text-[11px] font-medium transition-transform hover:z-10 hover:scale-[1.02]',
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

      {changement && <ChangementChambre cible={changement} onClose={() => setChangement(null)} />}
      {dossier && <DossierClient nom={dossier} onClose={() => setDossier(null)} />}

      {detail && (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={detail.client}
          subtitle={`Chambre ${detail.chambre} · ${
            detail.typeSejour && detail.typeSejour !== 'nuit'
              ? TYPES_SEJOUR[detail.typeSejour].label
              : `${isoDiff(detail.depart, detail.arrivee)} nuits`
          } · ${CANAUX[detail.canal]?.label ?? 'Direct'}`}
          width="max-w-md"
          footer={
            <div className="flex flex-wrap justify-between gap-2">
              {detail.origine === 'resa' && detail.arrivee === state.date && detail.statut === 'confirmee' ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      actions.checkIn(detail.id);
                      push(`Check-in effectué · chambre ${detail.chambre}.`);
                      setDetail(null);
                    }}
                  >
                    <Check className="size-3.5" /> Enregistrer l’arrivée
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      actions.marquerNoShow(detail.id);
                      push(`No-show enregistré · ${detail.client} : première nuit facturée.`, 'info');
                      setDetail(null);
                    }}
                  >
                    <X className="size-3.5" /> Non présenté
                  </Button>
                </div>
              ) : detail.origine === 'resa' && detail.statut === 'confirmee' ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    actions.cancelReservation(detail.id, detail.client);
                    push(`Réservation annulée · ${detail.client}`, 'info');
                    setDetail(null);
                  }}
                >
                  <X className="size-3.5" /> Annuler
                </Button>
              ) : detail.origine === 'sejour' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => {
                      actions.checkOut(detail.id);
                      push(`Check-out · ${detail.client}, chambre ${detail.chambre} libérée.`, 'success');
                      setDetail(null);
                    }}
                    title={soldeDetail > 0 ? `Solde de ${money(soldeDetail)} MAD à régler en caisse` : 'Folio soldé'}
                    disabled={soldeDetail > 0}
                  >
                    <DoorOpen className="size-3.5" /> Check-out
                  </Button>
                  {soldeDetail > 0 && (
                    <span className="text-[11px] text-terra">Solde de {money(soldeDetail)} MAD à régler</span>
                  )}
                </div>
              ) : (
                <span className="text-[12px] text-ink-3">Séjour terminé.</span>
              )}
              <div className="flex flex-wrap gap-2">
                {(detail.origine === 'resa' && detail.statut === 'confirmee') || detail.origine === 'sejour' ? (
                  <Button variant="outline" onClick={() => setChangement(detail)}>
                    <ArrowRightLeft className="size-3.5" /> Changer de chambre
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => setDossier(detail.client)}>
                  <History className="size-3.5" /> Dossier client
                </Button>
                <Button variant="outline" onClick={() => setDetail(null)}>Fermer</Button>
              </div>
            </div>
          }
        >
          <dl className="space-y-2 text-[12px]">
            {[
              ['Arrivée', fmtCourt(detail.arrivee)],
              ['Départ', fmtCourt(detail.depart)],
              ['Formule', FORMULES.find((f) => f.code === detail.formule)?.label ?? detail.formule],
              ['Occupants', `${detail.occupants ?? 2} personne(s)`],
              [
                'Prix appliqué',
                `${money(prixDuJour(state, state.chambres.find((c) => c.numero === detail.chambre)?.type))} MAD`,
              ],
              ['Statut', detail.statut === 'en_sejour' ? 'En séjour' : 'Confirmée'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-ink-3">{k}</dt>
                <dd className="font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-mist-100 px-3 py-2 text-[11px] text-ink-2">
            <Users className="size-3.5 text-ink-3" />{' '}
            {detail.typeSejour && detail.typeSejour !== 'nuit'
              ? 'demi-journée'
              : `${nuits(detail.arrivee, detail.depart)} nuit(s)`}{' '}
            · total estimé{' '}
            {money(
              detail.typeSejour && detail.typeSejour !== 'nuit'
                ? (state.parametres?.demiJournee ?? 200)
                : montantHebergement(
                    state.chambres.find((c) => c.numero === detail.chambre)?.type,
                    detail.formule,
                    detail.occupants ?? 2,
                    nuits(detail.arrivee, detail.depart),
                    state.parametres?.grille,
                  ),
            )} MAD
          </div>
        </Modal>
      )}
    </div>
  );
}
