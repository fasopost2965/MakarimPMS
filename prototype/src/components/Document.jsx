// ------------------------------------------------------------------
// Documents imprimables (A4) — factures, fiches de police, rapports de
// tournée, relevés de régie restaurant.
//
// Un PMS sans papier propre n'est pas utilisable : la réception remet une
// note, la police réclame les fiches, la comptabilité veut des factures
// ventilées par taux de TVA. Ces composants produisent des documents
// réellement imprimables (impression navigateur → PDF), pas des maquettes.
//
// Règles matérialisées : BR-CLI-006 (mentions légales obligatoires sur la
// facture entreprise), BR-FAC-002 (typologie des charges et ventilation TVA),
// BR-CLI-003 (fiche de police à l'arrivée), BR-RH-003 (rapport de shift
// horodaté et signé), BR-RST-002 (notes en chambre).
//
// Les mentions légales ci-dessous sont fictives (démonstration).
// ------------------------------------------------------------------

import { Printer, X } from 'lucide-react';
import { HOTEL } from '../data';
import { fmtCourt, fmtLong, money } from '../lib/date';
import { Button, cx } from './ui';

// Raison sociale et identifiants fiscaux — à remplacer par les vraies
// valeurs avant toute démonstration client.
export const MENTIONS = {
  raison: 'SARL Hôtel Makarim',
  ice: '001987654000073',
  rc: 'RC 4512 — Tribunal de Tétouan',
  if: 'IF 40218764',
  patente: '37102458',
  cnss: '8845210',
  adresse: HOTEL.adresse,
  telephone: '+212 5 39 96 44 10',
  email: 'reception@hotel-makarim.ma',
  banque: 'Attijariwafa Bank — RIB 007 780 000123456789012 34',
};

/* ------------------------------------------------------------------ */
/* Feuille A4                                                          */
/* ------------------------------------------------------------------ */

export function Feuille({ children, className }) {
  return (
    <div
      className={cx(
        // 210 × 297 mm, marges 16 mm : proportions d'une vraie feuille.
        'zone-impression mx-auto w-full max-w-[210mm] bg-surface px-[16mm] py-[14mm] text-ink shadow-pop print:max-w-none print:shadow-none',
        className,
      )}
    >
      {children}
    </div>
  );
}

function Entete({ titre, numero, date, sousTitre }) {
  return (
    <header className="mb-6 border-b-2 border-ink pb-4">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="font-display text-[22px] leading-none text-ink">{HOTEL.nom}</p>
          <p className="mt-1 text-[11px] text-ink-2">
            {HOTEL.categorie} · {HOTEL.adresse}
          </p>
          <p className="text-[10px] text-ink-3">
            ICE {MENTIONS.ice} · RC {MENTIONS.rc} · IF {MENTIONS.if} · Patente {MENTIONS.patente}
          </p>
          <p className="text-[10px] text-ink-3">
            Tél. {MENTIONS.telephone} · {MENTIONS.email}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-ink-3 uppercase">{titre}</p>
          <p className="font-display mt-1 text-[20px] leading-none">{numero}</p>
          <p className="mt-1 text-[11px] text-ink-2">{date}</p>
          {sousTitre && <p className="text-[10px] text-ink-3">{sousTitre}</p>}
        </div>
      </div>
    </header>
  );
}

function Pied() {
  return (
    <footer className="mt-8 border-t border-line pt-3 text-[10px] leading-4 text-ink-3">
      <p>
        {MENTIONS.raison} · {MENTIONS.adresse} · Tél. {MENTIONS.telephone} — ICE {MENTIONS.ice} · RC{' '}
        {MENTIONS.rc} · IF {MENTIONS.if} · CNSS {MENTIONS.cnss}
      </p>
      <p className="mt-1">{MENTIONS.banque} — Paiement par virement, chèque ou espèces (plafond légal 10 000 MAD).</p>
      <p className="mt-1">
        Document édité le {fmtCourt(new Date().toISOString().slice(0, 10))} — démonstration, mentions légales fictives.
      </p>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Facture                                                             */
/* ------------------------------------------------------------------ */

// Ventilation TVA : les montants du PMS sont TTC (ADR-008), on reconstitue
// la base hors taxe par taux pour la déclaration.
export function ventilationTva(lignes) {
  const parTaux = {};
  for (const l of lignes) {
    const taux = l.tva ?? 0;
    const base = taux > 0 ? l.montant / (1 + taux / 100) : l.montant;
    const tva = l.montant - base;
    parTaux[taux] = parTaux[taux] ?? { base: 0, tva: 0, ttc: 0 };
    parTaux[taux].base += base;
    parTaux[taux].tva += tva;
    parTaux[taux].ttc += l.montant;
  }
  return Object.entries(parTaux)
    .map(([taux, v]) => ({ taux: Number(taux), ...v }))
    .sort((a, b) => a.taux - b.taux);
}

export function FactureDoc({ facture }) {
  const lignes = facture.lignes ?? [
    { libelle: 'Prestations d’hébergement', montant: facture.montant, tva: 10 },
  ];
  const tva = ventilationTva(lignes);
  const totalTtc = lignes.reduce((s, l) => s + l.montant, 0);
  const totalTva = tva.reduce((s, t) => s + t.tva, 0);
  const totalHt = totalTtc - totalTva;

  return (
    <Feuille>
      <Entete
        titre={facture.type === 'societe' ? 'Facture société' : 'Note d’hôtel'}
        numero={facture.id}
        date={fmtLong(facture.date)}
        sousTitre={facture.chambre && facture.chambre !== '—' ? `Chambre ${facture.chambre}` : undefined}
      />

      <div className="mb-6 flex items-start justify-between gap-8">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Facturé à</p>
          <p className="mt-1 text-[14px] font-semibold text-ink">{facture.client}</p>
          {facture.societe && (
            <p className="text-[11px] text-ink-2">Séjour réglé par l’entreprise · {facture.societe}</p>
          )}
          {facture.type === 'societe' && (
            <p className="mt-1 text-[10px] text-ink-3">
              Facture à adresser au service achats — règlement selon conditions contractuelles.
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Statut</p>
          <p className="mt-1 text-[13px] font-semibold">
            {facture.statut === 'payee' ? 'Réglée' : 'À régler'}
          </p>
          <p className="text-[10px] text-ink-3">Émise le {fmtCourt(facture.date)}</p>
        </div>
      </div>

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-ink text-left">
            <th className="py-2 font-semibold">Désignation</th>
            <th className="py-2 text-right font-semibold">TVA</th>
            <th className="py-2 text-right font-semibold">Montant TTC</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={`${l.libelle}-${i}`} className="border-b border-line-soft">
              <td className="py-2 pr-4">{l.libelle}</td>
              <td className="py-2 text-right text-ink-2">{l.tva ?? 0} %</td>
              <td className="tnum py-2 text-right font-medium">{money(l.montant)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <table className="w-[70mm] text-[11px]">
          <tbody>
            {tva.map((t) => (
              <tr key={t.taux}>
                <td className="py-0.5 text-ink-2">Base HT {t.taux} %</td>
                <td className="tnum py-0.5 text-right">{money(Math.round(t.base))}</td>
              </tr>
            ))}
            {tva.map((t) => (
              <tr key={`tva-${t.taux}`}>
                <td className="py-0.5 text-ink-2">TVA {t.taux} %</td>
                <td className="tnum py-0.5 text-right">{money(Math.round(t.tva))}</td>
              </tr>
            ))}
            <tr className="border-t border-line">
              <td className="py-1 text-ink-2">Total HT</td>
              <td className="tnum py-1 text-right">{money(Math.round(totalHt))}</td>
            </tr>
            <tr className="border-t-2 border-ink">
              <td className="py-1.5 text-[13px] font-semibold">Total à payer</td>
              <td className="tnum py-1.5 text-right text-[13px] font-semibold">
                {money(totalTtc)} MAD
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-[10px] leading-4 text-ink-3">
        Taxe de séjour reversée au Trésor public, non soumise à TVA. Arrhes et acomptes imputés sur la
        présente note. Aucun escompte pour paiement anticipé.
      </p>
      <Pied />
    </Feuille>
  );
}

/* ------------------------------------------------------------------ */
/* Fiche de police                                                     */
/* ------------------------------------------------------------------ */

function Ligne({ label, valeur, large }) {
  return (
    <div className={cx('border border-line px-2 py-1.5', large && 'col-span-2')}>
      <p className="text-[10px] font-semibold tracking-[0.1em] text-ink-3 uppercase">{label}</p>
      <p className="mt-0.5 min-h-[14px] text-[11px] text-ink">{valeur || '—'}</p>
    </div>
  );
}

export function FichePoliceDoc({ fiche }) {
  const manquants = [
    !fiche.dateNaissance && 'date de naissance',
    !fiche.lieuNaissance && 'lieu de naissance',
    !fiche.nationalite && 'nationalité',
    !fiche.pays && 'pays d’origine',
    !fiche.ville && 'ville',
    !fiche.profession && 'profession',
    !fiche.domicile && 'domicile',
    !fiche.pieceNumero && 'numéro de pièce',
  ].filter(Boolean);

  const etatCivil = [
    [fiche.type === 'entreprise' ? 'Raison sociale' : 'Nom', fiche.nom],
    ['Prénom', fiche.prenom],
    ['Date de naissance', fiche.dateNaissance],
    ['Lieu de naissance', fiche.lieuNaissance],
    ['Nationalité', fiche.nationalite],
    ['Profession', fiche.profession],
  ];
  const origine = [
    ['Pays d’origine', fiche.pays],
    ['Ville', fiche.ville],
    ['Domicile habituel', fiche.domicile],
    ['Téléphone', fiche.telephone],
  ];
  const documents = [
    ['Nature de la pièce', fiche.pieceType],
    ['Numéro', fiche.pieceNumero],
    ['Délivrée le', fiche.pieceDelivreeLe],
  ];
  const sejour = [
    ['Chambre', fiche.chambre],
    ['Arrivée', fmtCourt(fiche.arrivee)],
    ['Départ prévu', fmtCourt(fiche.depart)],
    ['Occupants', String(fiche.occupants ?? 1)],
    ['Fiche établie le', fmtCourt(fiche.etablieLe)],
    ['Type de client', fiche.type === 'entreprise' ? 'Entreprise' : 'Particulier'],
  ];

  const Bloc = ({ titre, lignes }) => (
    <div className="mb-3">
      <h3 className="mb-1.5 border-b border-ink pb-1 text-[9px] font-semibold tracking-[0.14em] text-ink-3 uppercase">
        {titre}
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {lignes.map(([label, valeur]) => (
          <div key={label} className="flex justify-between gap-2 border-b border-line-soft pb-0.5 text-[10px]">
            <span className="text-ink-3">{label}</span>
            <span className={cx('text-right font-medium', valeur ? 'text-ink' : 'text-crimson')}>
              {valeur || 'à compléter'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Feuille>
      <Entete
        titre="Fiche individuelle de police"
        numero={fiche.id}
        date={fmtLong(fiche.etablieLe)}
        sousTitre="Déclaration d’hébergement — registre tenu à la disposition des autorités"
      />

      <div className="mb-4 flex items-start justify-between gap-4 border border-line px-3 py-2">
        <div>
          <p className="text-[9px] tracking-[0.12em] text-ink-3 uppercase">Établissement</p>
          <p className="text-[11px] font-semibold text-ink">Hôtel Makarim — Tétouan</p>
          <p className="text-[9.5px] text-ink-2">Avenue Mohammed V, Tétouan 93000 · 3 étoiles</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] tracking-[0.12em] text-ink-3 uppercase">Séjour</p>
          <p className="tnum text-[11px] font-semibold text-ink">
            Chambre {fiche.chambre} · {fmtCourt(fiche.arrivee)} → {fmtCourt(fiche.depart)}
          </p>
          <p className="text-[9.5px] text-ink-2">
            {fiche.occupants} occupant(s) · fiche établie le {fmtCourt(fiche.etablieLe)}
          </p>
        </div>
      </div>

      <p className="mb-3 text-[9.5px] leading-4 text-ink-2">
        Article 4 du dahir relatif à l’industrie hôtelière : tout exploitant doit déclarer les
        personnes logées. La fiche est conservée six mois, puis détruite. Une fiche sans pièce
        d’identité n’est pas valable.
      </p>

      <Bloc titre="Identité déclarée" lignes={etatCivil} />
      <Bloc titre="Origine et domicile" lignes={origine} />
      <Bloc titre="Pièce d’identité" lignes={documents} />
      <Bloc titre="Séjour" lignes={sejour} />

      {manquants.length > 0 && (
        <p className="mt-2 border border-crimson/40 bg-crimson-100/50 px-2 py-1.5 text-[9.5px] text-crimson">
          Fiche incomplète : {manquants.join(', ')}. À compléter avant la clôture de la journée.
        </p>
      )}

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[9px] text-ink-3">Signature du client</p>
          <div className="mt-1 h-16 border border-line" />
        </div>
        <div>
          <p className="text-[9px] text-ink-3">Empreinte / cachet de l’établissement</p>
          <div className="mt-1 h-16 border border-line" />
        </div>
        <div>
          <p className="text-[9px] text-ink-3">Visa de la réception</p>
          <div className="mt-1 h-16 border border-line" />
        </div>
      </div>

      <p className="mt-3 text-[8.5px] leading-3 text-ink-3">
        Document produit par le PMS Makarim — toute rature invalide la fiche. Conservation :
        six mois. Communication : autorités de police et de gendarmerie sur réquisition.
      </p>

      <Pied />
    </Feuille>
  );
}

/* Registre imprimable : la liste complète des fiches du jour, pour le contrôle
   de police qui demande parfois le registre et non la fiche individuelle. */
export function RegistrePoliceDoc({ fiches, date }) {
  return (
    <Feuille>
      <Entete
        titre="Registre d’hébergement"
        numero={`REG-${String(date).replaceAll('-', '')}`}
        date={fmtLong(date)}
        sousTitre={`${fiches.length} fiche(s) — synthèse par chambre et par nationalité`}
      />
      <table className="w-full border-collapse text-[9.5px]">
        <thead>
          <tr className="border-b border-ink text-left">
            <th className="py-1.5 font-semibold">Fiche</th>
            <th className="py-1.5 font-semibold">Ch.</th>
            <th className="py-1.5 font-semibold">Nom et prénom</th>
            <th className="py-1.5 font-semibold">Pays · ville</th>
            <th className="py-1.5 font-semibold">Pièce</th>
            <th className="py-1.5 font-semibold">Séjour</th>
            <th className="py-1.5 font-semibold">État</th>
          </tr>
        </thead>
        <tbody>
          {fiches.map((f) => (
            <tr key={f.id} className="border-b border-line-soft">
              <td className="py-1">{f.id}</td>
              <td className="tnum py-1">{f.chambre}</td>
              <td className="py-1">{`${f.nom ?? ''} ${f.prenom ?? ''}`.trim()}</td>
              <td className="py-1">{f.pays ?? '—'}{f.ville ? ` · ${f.ville}` : ''}</td>
              <td className="py-1">{f.pieceNumero ? `${f.pieceType} ${f.pieceNumero}` : '—'}</td>
              <td className="py-1">{fmtCourt(f.arrivee)} → {fmtCourt(f.depart)}</td>
              <td className="py-1">{f.statut === 'complete' ? 'Complète' : 'À compléter'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-[9px] text-ink-2">
        Registre arrêté à la clôture de la journée. Les fiches marquées « à compléter » sont
        signalées à la réception avant le passage à J+1.
      </p>
      <div className="mt-6 flex items-end justify-between gap-8">
        <div className="flex-1">
          <p className="text-[9.5px] text-ink-3">Le veilleur de nuit</p>
          <div className="mt-1 h-12 border border-line" />
        </div>
        <div className="flex-1">
          <p className="text-[9.5px] text-ink-3">Le directeur</p>
          <div className="mt-1 h-12 border border-line" />
        </div>
      </div>
      <Pied />
    </Feuille>
  );
}

/* ------------------------------------------------------------------ */
/* Rapport de tournée (cahier de transmission)                         */
/* ------------------------------------------------------------------ */

export function RapportTourneeDoc({ tournee, suivante }) {
  return (
    <Feuille>
      <Entete
        titre="Rapport de tournée"
        numero={`SHIFT ${tournee.shift.toUpperCase()}`}
        date={fmtLong(tournee.date)}
        sousTitre={`${tournee.debut} → ${tournee.fin ?? 'en cours'}`}
      />

      <div className="mb-4 grid grid-cols-3 gap-1.5">
        <Ligne label="Agent sortant" valeur={tournee.agent} />
        <Ligne label="Shift" valeur={`${tournee.shift} (${tournee.debut})`} />
        <Ligne label="Clôturé à" valeur={tournee.closLe ?? '—'} />
        <Ligne label="Fond de caisse" valeur={`${money(tournee.caisse.fond)} MAD`} />
        <Ligne label="Comptage" valeur={`${money(tournee.caisse.comptage)} MAD`} />
        <Ligne
          label="Écart"
          valeur={`${money(tournee.caisse.comptage - tournee.caisse.fond)} MAD`}
        />
      </div>

      <h3 className="mt-5 mb-2 text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
        Contrôles du shift
      </h3>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
        {tournee.taches.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-[11px]">
            <span
              className={cx(
                'grid size-3 place-items-center border text-[8px] leading-none',
                t.fait ? 'border-ink bg-ink text-white' : 'border-line-3 text-transparent',
              )}
            >
              ✓
            </span>
            <span className={t.fait ? 'text-ink' : 'text-ink-3'}>{t.label}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-5 mb-2 text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
        Main courante
      </h3>
      {tournee.evenements.length === 0 ? (
        <p className="text-[11px] text-ink-3">Aucun événement consigné sur ce shift.</p>
      ) : (
        <table className="w-full border-collapse text-[11px]">
          <tbody>
            {tournee.evenements.map((e, i) => (
              <tr key={`${e.heure}-${i}`} className="border-b border-line-soft">
                <td className="w-14 py-1 align-top text-ink-2">{e.heure}</td>
                <td className="py-1">{e.texte}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="mt-5 mb-1 text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
        Remarques de l’agent sortant
      </h3>
      <p className="min-h-[26px] border border-line px-2 py-1.5 text-[11px]">
        {tournee.remarques || '—'}
      </p>

      <h3 className="mt-3 mb-1 text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
        Consignes pour {suivante?.label ?? 'le shift suivant'}
      </h3>
      <p className="min-h-[26px] border border-line px-2 py-1.5 text-[11px]">
        {tournee.consignes || '—'}
      </p>

      <div className="mt-6 flex items-end justify-between gap-8">
        <div className="flex-1">
          <p className="text-[10px] text-ink-3">Signature de l’agent sortant</p>
          <div className="mt-1 h-12 border border-line" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-ink-3">
            Visa de l’agent entrant — {suivante?.agent ?? ''}
          </p>
          <div className="mt-1 h-12 border border-line" />
        </div>
      </div>

      <Pied />
    </Feuille>
  );
}

/* ------------------------------------------------------------------ */
/* Relevé de régie restaurant                                          */
/* ------------------------------------------------------------------ */

export function ReleveRegieDoc({ regie, date }) {
  return (
    <Feuille>
      <Entete
        titre="Relevé de régie"
        numero={`REGIE-${date.replaceAll('-', '')}`}
        date={fmtLong(date)}
        sousTitre="Restaurant Le Marsa — encaissements du jour"
      />

      <p className="mb-4 text-[10px] leading-4 text-ink-2">
        Le restaurant tient sa propre caisse. L’hôtel encaisse pour son compte les notes portées en
        chambre et les règlements pris à la réception. Le présent relevé arrête ce que l’hôtel doit
        reverser au restaurant en fin de journée.
      </p>

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-ink text-left">
            <th className="py-2 font-semibold">Poste</th>
            <th className="py-2 text-right font-semibold">Nombre</th>
            <th className="py-2 text-right font-semibold">Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-line-soft">
            <td className="py-2">Notes portées en chambre (régularisées au folio)</td>
            <td className="py-2 text-right">{regie.enChambre.length}</td>
            <td className="tnum py-2 text-right">{money(regie.totalChambre)}</td>
          </tr>
          <tr className="border-b border-line-soft">
            <td className="py-2">Tables réglées directement (restaurant)</td>
            <td className="py-2 text-right">{regie.directes.length}</td>
            <td className="tnum py-2 text-right">{money(regie.totalDirect)}</td>
          </tr>
          <tr className="border-t-2 border-ink">
            <td className="py-2 text-[12px] font-semibold">Total encaissé par l’hôtel</td>
            <td className="py-2" />
            <td className="tnum py-2 text-right text-[12px] font-semibold">
              {money(regie.encaisseParHotel)} MAD
            </td>
          </tr>
          <tr>
            <td className="py-2 text-[12px] font-semibold">À reverser au restaurant</td>
            <td className="py-2" />
            <td className="tnum py-2 text-right text-[12px] font-semibold">
              {money(regie.aReverser)} MAD
            </td>
          </tr>
        </tbody>
      </table>

      <h3 className="mt-5 mb-2 text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
        Détail des moyens de paiement
      </h3>
      <ul className="space-y-1 text-[11px]">
        {Object.entries(regie.parMoyen).map(([moyen, montant]) => (
          <li key={moyen} className="flex justify-between border-b border-line-soft pb-1">
            <span className="text-ink-2">{moyen}</span>
            <span className="tnum">{money(montant)} MAD</span>
          </li>
        ))}
        {Object.keys(regie.parMoyen).length === 0 && (
          <li className="text-ink-3">Aucun règlement direct encaissé aujourd’hui.</li>
        )}
      </ul>

      <div className="mt-6 flex items-end justify-between gap-8">
        <div className="flex-1">
          <p className="text-[10px] text-ink-3">Le responsable restaurant</p>
          <div className="mt-1 h-12 border border-line" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-ink-3">La réception (caisse)</p>
          <div className="mt-1 h-12 border border-line" />
        </div>
      </div>

      <Pied />
    </Feuille>
  );
}

/* ------------------------------------------------------------------ */
/* Rapport restaurant du jour (rapport imprimable, à défaut d'écran)   */
/* ------------------------------------------------------------------ */

export function RapportRestoDoc({ donnees }) {
  const {
    date, caJour, caChambre, couverts, categories = [], articles = [],
    reglees = [], servies = [], tva = 20,
  } = donnees;
  const toutes = [...reglees, ...servies];
  const total = caJour + caChambre;
  const parMoyen = {};
  for (const c of reglees) {
    const m = c.moyen ?? 'Espèces';
    parMoyen[m] = (parMoyen[m] ?? 0) + c.lignes.reduce((s, l) => s + l.prix * l.qte, 0);
  }
  const ttc = (m) => m;
  const ht = (m) => m / (1 + tva / 100);

  return (
    <Feuille>
      <Entete
        titre="Rapport restaurant — service du jour"
        numero={`RESTO-${date.replaceAll('-', '')}`}
        date={fmtLong(date)}
        sousTitre={`Restaurant Le Marsa · ${toutes.length} note(s) · ${couverts} couvert(s)`}
      />

      <div className="mb-4 grid grid-cols-3 gap-1.5">
        <Ligne label="CA encaissé" valeur={`${money(caJour)} MAD`} />
        <Ligne label="Notes en chambre" valeur={`${money(caChambre)} MAD`} />
        <Ligne label="Total du jour" valeur={`${money(total)} MAD`} />
      </div>

      <h3 className="mt-4 mb-2 text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
        Ventilation par famille
      </h3>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-ink text-left">
            <th className="py-1.5 font-semibold">Famille</th>
            <th className="py-1.5 text-right font-semibold">Montant TTC</th>
            <th className="py-1.5 text-right font-semibold">Part du CA</th>
          </tr>
        </thead>
        <tbody>
          {categories.length === 0 && (
            <tr><td colSpan={3} className="py-2 text-ink-3">Aucune vente enregistrée.</td></tr>
          )}
          {categories.map((c) => (
            <tr key={c.cat} className="border-b border-line-soft">
              <td className="py-1.5">{c.cat}</td>
              <td className="tnum py-1.5 text-right">{money(c.montant)} MAD</td>
              <td className="tnum py-1.5 text-right text-ink-2">
                {Math.round((c.montant / Math.max(1, total)) * 100)} %
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="mt-5 mb-2 text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
        Détail des articles vendus
      </h3>
      <table className="w-full border-collapse text-[10.5px]">
        <thead>
          <tr className="border-b border-ink text-left">
            <th className="py-1.5 font-semibold">Article</th>
            <th className="py-1.5 font-semibold">Catégorie</th>
            <th className="py-1.5 text-right font-semibold">Qté</th>
            <th className="py-1.5 text-right font-semibold">TTC</th>
          </tr>
        </thead>
        <tbody>
          {articles.length === 0 && (
            <tr><td colSpan={4} className="py-2 text-ink-3">Aucun article vendu.</td></tr>
          )}
          {articles.map((a) => (
            <tr key={a.article} className="border-b border-line-soft">
              <td className="py-1">{a.article}</td>
              <td className="py-1 text-ink-2">{a.categorie}</td>
              <td className="tnum py-1 text-right">{a.quantite}</td>
              <td className="tnum py-1 text-right">{money(a.montant)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="mt-5 mb-2 text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
        Encaissements
      </h3>
      <ul className="space-y-1 text-[11px]">
        {Object.entries(parMoyen).map(([moyen, montant]) => (
          <li key={moyen} className="flex justify-between border-b border-line-soft pb-1">
            <span className="text-ink-2">{moyen}</span>
            <span className="tnum">{money(montant)} MAD</span>
          </li>
        ))}
        <li className="flex justify-between border-b border-line-soft pb-1">
          <span className="text-ink-2">Notes portées en chambre (folio)</span>
          <span className="tnum">{money(caChambre)} MAD</span>
        </li>
        {Object.keys(parMoyen).length === 0 && caChambre === 0 && (
          <li className="text-ink-3">Aucun encaissement aujourd’hui.</li>
        )}
      </ul>

      <div className="mt-4 grid grid-cols-2 gap-1.5">
        <Ligne label="TVA restauration appliquée" valeur={`${tva} %`} />
        <Ligne label="CA hors taxes" valeur={`${money(ht(ttc(total)))} MAD`} />
      </div>

      <div className="mt-6 flex items-end justify-between gap-8">
        <div className="flex-1">
          <p className="text-[10px] text-ink-3">Le responsable restaurant</p>
          <div className="mt-1 h-12 border border-line" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-ink-3">La réception (caisse)</p>
          <div className="mt-1 h-12 border border-line" />
        </div>
      </div>

      <Pied />
    </Feuille>
  );
}

/* ------------------------------------------------------------------ */
/* Journal de caisse : les folios du jour et leurs soldes              */
/* ------------------------------------------------------------------ */

export function JournalCaisseDoc({ liste = [], date }) {
  const charges = liste.reduce((s, f) => s + f.lignes.reduce((a, l) => a + l.montant, 0), 0);
  const regle = liste.reduce((s, f) => s + f.paiements.reduce((a, p) => a + p.montant, 0), 0);
  const solde = charges - regle;

  return (
    <Feuille>
      <Entete
        titre="Journal de caisse — folios du jour"
        numero={`CAISSE-${String(date).replaceAll('-', '')}`}
        date={fmtLong(date)}
        sousTitre={`${liste.length} folio(s) · charges ${money(charges)} MAD · réglé ${money(regle)} MAD`}
      />
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-ink text-left">
            <th className="py-1.5 font-semibold">Folio</th>
            <th className="py-1.5 font-semibold">Client</th>
            <th className="py-1.5 text-center font-semibold">Ch.</th>
            <th className="py-1.5 text-right font-semibold">Charges</th>
            <th className="py-1.5 text-right font-semibold">Réglé</th>
            <th className="py-1.5 text-right font-semibold">Solde</th>
          </tr>
        </thead>
        <tbody>
          {liste.length === 0 && (
            <tr><td colSpan={6} className="py-3 text-ink-3">Aucun folio sur la période.</td></tr>
          )}
          {liste.map((f) => {
            const c = f.lignes.reduce((a, l) => a + l.montant, 0);
            const r = f.paiements.reduce((a, p) => a + p.montant, 0);
            return (
              <tr key={f.id} className="border-b border-line-soft">
                <td className="py-1">{f.id}</td>
                <td className="py-1">{f.client}</td>
                <td className="tnum py-1 text-center">{f.chambre}</td>
                <td className="tnum py-1 text-right">{money(c)}</td>
                <td className="tnum py-1 text-right">{money(r)}</td>
                <td className="tnum py-1 text-right font-semibold">{money(Math.max(0, c - r))}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-ink">
            <td colSpan={3} className="py-1.5 text-[11px] font-semibold">Total</td>
            <td className="tnum py-1.5 text-right font-semibold">{money(charges)}</td>
            <td className="tnum py-1.5 text-right font-semibold">{money(regle)}</td>
            <td className="tnum py-1.5 text-right font-semibold">{money(Math.max(0, solde))}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-3 text-[9.5px] leading-4 text-ink-2">
        Les folios sont arrêtés à la clôture de la journée. Les soldes restants sont repris au
        lendemain et suivis par la réception.
      </p>
      <div className="mt-6 flex items-end justify-between gap-8">
        <div className="flex-1">
          <p className="text-[9.5px] text-ink-3">Le réceptionniste</p>
          <div className="mt-1 h-12 border border-line" />
        </div>
        <div className="flex-1">
          <p className="text-[9.5px] text-ink-3">Le directeur</p>
          <div className="mt-1 h-12 border border-line" />
        </div>
      </div>
      <Pied />
    </Feuille>
  );
}

/* ------------------------------------------------------------------ */
/* Aperçu plein écran + impression                                     */
/* ------------------------------------------------------------------ */

export function ApercuDocument({ titre, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-ink/50 backdrop-blur-[2px]">
      <div className="no-print flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Aperçu avant impression</p>
          <p className="text-[14px] font-semibold text-ink">{titre}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="size-3.5" /> Fermer
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-3.5" /> Imprimer / PDF
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-sand-200 px-4 py-6">
        <div className="mx-auto max-w-[210mm]">{children}</div>
      </div>
    </div>
  );
}
