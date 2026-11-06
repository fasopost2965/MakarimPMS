// ------------------------------------------------------------------
// Fiches de police · registre d'hébergement.
//
// Obligation légale : toute personne logée doit être déclarée, avec son
// identité complète et sa pièce d'identité. L'écran ne sert donc pas à
// « ranger » des fiches : il signale ce qui manque, avant la clôture.
//
// Règles matérialisées : BR-CLI-001 (typologie particulier / entreprise),
// BR-CLI-003 (enregistrement obligatoire des pièces d'identité), BR-CLI-005
// (validité de la pièce au check-in), BR-SEJ-002 (fiche établie à l'arrivée).
// Un client « entreprise » garde une fiche au nom de la société, mais les
// occupants déclarés restent des personnes physiques.
// ------------------------------------------------------------------

import { useMemo, useState } from 'react';
import {
  CheckCircle2, IdCard, PencilLine, Printer, Search, TriangleAlert,
} from 'lucide-react';
import { PAYS, TYPES_CLIENT, villesDe } from '../data';
import { useApp } from '../store';
import { fmtCourt } from '../lib/date';
import { ApercuDocument, FichePoliceDoc, RegistrePoliceDoc } from '../components/Document';
import { Exports } from '../components/Exports';
import { Button, Card, CardHeader, Modal, Pill, Stat, cx, useToast } from '../components/ui';

// Sélecteur pays / ville de la fiche de police.
// Le pays se cherche par saisie, puis la liste des villes se réduit à ce pays ;
// les villes sont elles-mêmes filtrables. Une ville hors référentiel reste
// saisissable : l'obligation de déclaration prime sur la liste.
function PaysVille({ pays, ville, onChange }) {
  const [filtrePays, setFiltrePays] = useState('');
  const [filtreVille, setFiltreVille] = useState('');
  const [villeLibre, setVilleLibre] = useState(false);

  const paysFiltres = PAYS.filter((p) =>
    p.nom.toLowerCase().includes(filtrePays.trim().toLowerCase()),
  );
  const villes = villesDe(pays).filter((v) =>
    v.toLowerCase().includes(filtreVille.trim().toLowerCase()),
  );

  return (
    <>
      <div>
        <label htmlFor="fp-pays" className="text-[12px] font-semibold text-ink-2">Pays d’origine</label>
        <input
          aria-label="Filtrer la liste des pays"
          value={filtrePays}
          onChange={(e) => setFiltrePays(e.target.value)}
          placeholder="Filtrer les pays…"
          className="mt-1.5 w-full rounded-lg border border-line bg-mist-50 px-2.5 py-1.5 text-[11px] outline-none focus:border-maj"
        />
        <select
          id="fp-pays"
          value={pays}
          onChange={(e) => {
            onChange({ pays: e.target.value, ville: '' });
            setVilleLibre(false);
            setFiltreVille('');
          }}
          className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
        >
          <option value=""> ·  Choisir un pays  · </option>
          {paysFiltres.map((p) => (
            <option key={p.code} value={p.nom}>{p.nom}</option>
          ))}
          {paysFiltres.length === 0 && <option value="">Aucun pays ne correspond</option>}
        </select>
      </div>

      <div>
        <label htmlFor="fp-ville-select" className="text-[12px] font-semibold text-ink-2">Ville</label>
        {villes.length > 0 && !villeLibre ? (
          <>
            <input
              aria-label="Filtrer la liste des villes"
              value={filtreVille}
              onChange={(e) => setFiltreVille(e.target.value)}
              placeholder="Filtrer les villes…"
              className="mt-1.5 w-full rounded-lg border border-line bg-mist-50 px-2.5 py-1.5 text-[11px] outline-none focus:border-maj"
            />
            <select
              id="fp-ville-select"
              value={ville}
              onChange={(e) => {
                if (e.target.value === '__libre') setVilleLibre(true);
                else onChange({ pays, ville: e.target.value });
              }}
              className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
            >
              <option value=""> ·  Choisir une ville  · </option>
              {villes.map((v) => <option key={v} value={v}>{v}</option>)}
              <option value="__libre">Autre ville…</option>
            </select>
          </>
        ) : (
          <input
            id="fp-ville-select"
            value={ville}
            onChange={(e) => onChange({ pays, ville: e.target.value })}
            placeholder={pays ? 'Saisir la ville' : 'Choisir d’abord le pays'}
            className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
          />
        )}
      </div>
    </>
  );
}

function ChipType({ type }) {
  const t = TYPES_CLIENT[type] ?? TYPES_CLIENT.particulier;
  return (
    <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium', t.chip)}>{t.label}</span>
  );
}

export function Police() {
  const { state, actions } = useApp();
  const { push } = useToast();
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState('toutes');
  const [aCompleter, setACompleter] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [registre, setRegistre] = useState(false);
  const [brouillon, setBrouillon] = useState({});
  const [filtrePays, setFiltrePays] = useState('tous');

  const fiches = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return state.fichesPolice
      .filter((f) => (filtre === 'toutes' ? true : f.statut === filtre))
      .filter((f) => filtrePays === 'tous' || f.pays === filtrePays)
      .filter((f) =>
        q
          ? `${f.nom} ${f.prenom} ${f.chambre} ${f.id} ${f.pieceNumero} ${f.pays ?? ''} ${f.ville ?? ''}`
              .toLowerCase()
              .includes(q)
          : true,
      );
  }, [state.fichesPolice, recherche, filtre, filtrePays]);

  const completes = state.fichesPolice.filter((f) => f.statut === 'complete').length;
  const manquantes = state.fichesPolice.length - completes;

  const ouvrirEdition = (fiche) => {
    setBrouillon({ ...fiche });
    setACompleter(fiche);
  };

  const enregistrer = () => {
    actions.updateFichePolice(aCompleter.id, {
      nom: brouillon.nom,
      prenom: brouillon.prenom,
      dateNaissance: brouillon.dateNaissance,
      lieuNaissance: brouillon.lieuNaissance,
      nationalite: brouillon.nationalite,
      profession: brouillon.profession,
      domicile: brouillon.domicile,
      pays: brouillon.pays,
      ville: brouillon.ville,
      telephone: brouillon.telephone,
      pieceType: brouillon.pieceType,
      pieceNumero: brouillon.pieceNumero,
      pieceDelivreeLe: brouillon.pieceDelivreeLe,
    });
    const complete = Boolean(
      brouillon.nom?.trim() && brouillon.pieceNumero?.trim()
        && brouillon.dateNaissance?.trim() && brouillon.nationalite?.trim(),
    );
    setACompleter(null);
    push(
      complete
        ? `Fiche ${aCompleter.id} complétée · chambre ${aCompleter.chambre}.`
        : `Fiche ${aCompleter.id} enregistrée, il reste des champs obligatoires.`,
      complete ? 'success' : 'info',
    );
  };

  const champ = (cle, label, type = 'text', large = false) => (
    <div className={large ? 'sm:col-span-2' : ''}>
      <label htmlFor={`fp-${cle}`} className="text-[12px] font-semibold text-ink-2">
        {label}
      </label>
      <input
        id={`fp-${cle}`}
        type={type}
        value={brouillon[cle] ?? ''}
        onChange={(e) => setBrouillon((b) => ({ ...b, [cle]: e.target.value }))}
        className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
      />
    </div>
  );

  return (
    <div className="space-y-4 px-4 py-5 sm:px-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Fiches établies" value={String(state.fichesPolice.length)} unit="séjours en cours" />
        <Stat label="Complètes" value={String(completes)} unit="prêtes pour contrôle" tone="jade" />
        <Stat
          label="À compléter"
          value={String(manquantes)}
          unit="obligation légale"
          tone={manquantes > 0 ? 'crimson' : 'jade'}
        />
      </div>

      <Card>
        <CardHeader
          titre="Registre d’hébergement"
          sousTitre="Une fiche par séjour en cours · conservées six mois à disposition des autorités"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5">
                <Search className="size-3.5 text-ink-3" />
                <input
                  aria-label="Rechercher une fiche de police"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Nom, chambre, pièce…"
                  className="w-40 bg-transparent text-[12px] outline-none placeholder:text-ink-3"
                />
              </div>
              <select
                aria-label="Filtrer par pays d’origine"
                value={filtrePays}
                onChange={(e) => setFiltrePays(e.target.value)}
                className="rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-[11px] text-ink-2 outline-none focus:border-maj"
              >
                <option value="tous">Tous les pays</option>
                {[...new Set(state.fichesPolice.map((f) => f.pays).filter(Boolean))].sort().map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {[
                { cle: 'toutes', label: 'Toutes' },
                { cle: 'complete', label: 'Complètes' },
                { cle: 'a_completer', label: 'À compléter' },
              ].map((f) => (
                <button
                  key={f.cle}
                  type="button"
                  onClick={() => setFiltre(f.cle)}
                  className={cx(
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    filtre === f.cle
                      ? 'border-maj bg-maj-50 text-maj'
                      : 'border-line bg-surface text-ink-2 hover:bg-mist-50',
                  )}
                >
                  {f.label}
                </button>
              ))}
              <Exports
                nom={`fiches-police-${state.date}`}
                titre="Fiches de police"
                colonnes={[
                  { cle: 'id', label: 'Fiche' },
                  { cle: 'chambre', label: 'Chambre' },
                  { cle: 'nom', label: 'Nom' },
                  { cle: 'prenom', label: 'Prénom' },
                  { cle: 'pays', label: 'Pays' },
                  { cle: 'ville', label: 'Ville' },
                  { cle: 'pieceType', label: 'Pièce' },
                  { cle: 'pieceNumero', label: 'Numéro' },
                  { cle: 'arrivee', label: 'Arrivée' },
                  { cle: 'depart', label: 'Départ' },
                  { cle: 'statut', label: 'État' },
                ]}
                lignes={fiches.map((f) => ({
                  ...f,
                  statut: f.statut === 'complete' ? 'Complète' : 'À compléter',
                }))}
                onPdf={() => setRegistre(true)}
              />
            </div>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-line-soft text-[11px] tracking-[0.08em] text-ink-3 uppercase">
                <th className="px-5 py-2 font-semibold">Fiche</th>
                <th className="px-3 py-2 font-semibold">Chambre</th>
                <th className="px-3 py-2 font-semibold">Client</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Origine</th>
                <th className="px-3 py-2 font-semibold">Pièce</th>
                <th className="px-3 py-2 font-semibold">Séjour</th>
                <th className="px-3 py-2 font-semibold">État</th>
                <th className="px-5 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fiches.map((f) => (
                <tr key={f.id} className="border-b border-line-soft last:border-0 hover:bg-mist-50/60">
                  <td className="px-5 py-2.5 font-medium text-ink">{f.id}</td>
                  <td className="px-3 py-2.5 tnum">{f.chambre}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-ink">{f.nom}</p>
                    <p className="text-[11px] text-ink-3">{f.prenom || 'prénom manquant'}</p>
                  </td>
                  <td className="px-3 py-2.5"><ChipType type={f.type} /></td>
                  <td className="px-3 py-2.5 text-ink-2">
                    {f.pays ? `${f.pays}${f.ville ? ` · ${f.ville}` : ''}` : <span className="text-ink-3">nc</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {f.pieceNumero ? (
                      <span className="text-ink-2">{f.pieceType} {f.pieceNumero}</span>
                    ) : (
                      <span className="text-crimson">non renseignée</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-ink-2">
                    {fmtCourt(f.arrivee)} → {fmtCourt(f.depart)}
                  </td>
                  <td className="px-3 py-2.5">
                    {f.statut === 'complete' ? (
                      <Pill tone="jade"><CheckCircle2 className="size-3" /> Complète</Pill>
                    ) : (
                      <Pill tone="crimson"><TriangleAlert className="size-3" /> À compléter</Pill>
                    )}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => ouvrirEdition(f)}>
                        <PencilLine className="size-3.5" />
                        <span className="sr-only sm:not-sr-only">Compléter</span>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setApercu(f)}>
                        <Printer className="size-3.5" />
                        <span className="sr-only sm:not-sr-only">Imprimer</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {fiches.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-[12px] text-ink-3">
                    Aucune fiche ne correspond à ce filtre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-line bg-mist-50 p-3">
        <IdCard className="mt-0.5 size-4 shrink-0 text-ink-3" />
        <p className="text-[12px] leading-5 text-ink-2">
          Une fiche sans numéro de pièce d’identité n’est pas valable : elle est signalée en rouge et
          bloque la clôture de la journée tant qu’elle n’est pas complétée. Les fiches sont
          conservées six mois, puis détruites.
        </p>
      </div>

      <Modal
        open={Boolean(aCompleter)}
        onClose={() => setACompleter(null)}
        title={`Fiche ${aCompleter?.id ?? ''}`}
        subtitle={aCompleter ? `Chambre ${aCompleter.chambre} · ${aCompleter.client}` : ''}
        width="max-w-2xl"
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-ink-3">Nom, date de naissance, nationalité et pièce sont obligatoires.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setACompleter(null)}>Annuler</Button>
              <Button onClick={enregistrer}>Enregistrer la fiche</Button>
            </div>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {champ('nom', 'Nom', 'text', true)}
          {champ('prenom', 'Prénom')}
          {champ('dateNaissance', 'Date de naissance', 'date')}
          {champ('lieuNaissance', 'Lieu de naissance')}
          <div>
            <label htmlFor="fp-nationalite" className="text-[12px] font-semibold text-ink-2">Nationalité</label>
            <input
              id="fp-nationalite"
              value={brouillon.nationalite ?? ''}
              onChange={(e) => setBrouillon((b) => ({ ...b, nationalite: e.target.value }))}
              placeholder="Française, marocaine…"
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
            />
          </div>
          {champ('profession', 'Profession')}
          <div className="sm:col-span-2">
            {champ('domicile', 'Domicile habituel', 'text', true)}
          </div>
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
            <PaysVille
              pays={brouillon.pays ?? ''}
              ville={brouillon.ville ?? ''}
              onChange={(patch) => setBrouillon((b) => ({ ...b, ...patch }))}
            />
          </div>
          {champ('telephone', 'Téléphone')}
          <div>
            <label htmlFor="fp-pieceType" className="text-[12px] font-semibold text-ink-2">
              Nature de la pièce
            </label>
            <select
              id="fp-pieceType"
              value={brouillon.pieceType ?? 'CIN'}
              onChange={(e) => setBrouillon((b) => ({ ...b, pieceType: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
            >
              {['CIN', 'Passeport', 'Carte de séjour', 'RC'].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          {champ('pieceNumero', 'Numéro de la pièce')}
          {champ('pieceDelivreeLe', 'Délivrée le', 'date')}
        </div>
      </Modal>

      {apercu && (
        <ApercuDocument titre={`Fiche de police ${apercu.id}`} onClose={() => setApercu(null)}>
          <FichePoliceDoc fiche={apercu} />
        </ApercuDocument>
      )}

      {registre && (
        <ApercuDocument titre="Registre d’hébergement" onClose={() => setRegistre(false)}>
          <RegistrePoliceDoc fiches={fiches} date={state.date} />
        </ApercuDocument>
      )}
    </div>
  );
}
