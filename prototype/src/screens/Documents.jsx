// ------------------------------------------------------------------
// Documents & PDF — bibliothèque des pièces imprimables du jour.
//
// Tout ce que l'hôtel remet en main propre doit sortir du PMS sans
// retouche : note d'hôtel, facture société, fiche de police, rapport de
// tournée, relevé de régie restaurant. Cet écran rassemble ces pièces et
// ouvre un aperçu A4 avant impression (impression navigateur → PDF).
//
// Règles matérialisées : BR-CLI-006 (mentions légales de la facture
// entreprise), BR-FAC-001 (capacité multi-folios : société et client
// facturés séparément), BR-FAC-002 (typologie des charges), BR-REP-001
// (export imprimable), BR-RST-002 (note en chambre) et BR-CLI-003 (fiche
// de police).
// ------------------------------------------------------------------

import { useMemo, useState } from 'react';
import { FileText, Printer, ReceiptText, Search, ClipboardList, IdCard } from 'lucide-react';
import { useApp, regieRestaurant } from '../store';
import { fmtCourt, fmtLong, money } from '../lib/date';
import {
  ApercuDocument, FactureDoc, FichePoliceDoc, RapportTourneeDoc, ReleveRegieDoc,
} from '../components/Document';
import { Button, Card, CardHeader, Pill, Stat, cx } from '../components/ui';

const FAMILLES = [
  { cle: 'factures', label: 'Factures & notes', icon: ReceiptText },
  { cle: 'police', label: 'Fiches de police', icon: IdCard },
  { cle: 'tournees', label: 'Rapports de tournée', icon: ClipboardList },
  { cle: 'regie', label: 'Régie restaurant', icon: FileText },
];

export function Documents() {
  const { state } = useApp();
  const [famille, setFamille] = useState('factures');
  const [recherche, setRecherche] = useState('');
  const [apercu, setApercu] = useState(null); // { titre, rendu }

  const regie = useMemo(() => regieRestaurant(state), [state.commandes]);

  const documents = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const filtre = (txt) => (q ? txt.toLowerCase().includes(q) : true);
    const liste = [];

    if (famille === 'factures') {
      for (const f of state.factures) {
        if (!filtre(`${f.id} ${f.client}`)) continue;
        liste.push({
          cle: f.id,
          titre: f.id,
          sous: `${f.client} · ${fmtCourt(f.date)}`,
          meta: `${money(f.montant)} MAD`,
          badge: f.type === 'societe' ? 'Facture société' : 'Note d’hôtel',
          tone: f.type === 'societe' ? 'maj' : 'neutral',
          rendu: <FactureDoc facture={f} />,
        });
      }
    }
    if (famille === 'police') {
      for (const f of state.fichesPolice) {
        if (!filtre(`${f.id} ${f.nom} ${f.chambre}`)) continue;
        liste.push({
          cle: f.id,
          titre: f.id,
          sous: `${f.nom} ${f.prenom} · chambre ${f.chambre}`,
          meta: `${fmtCourt(f.arrivee)} → ${fmtCourt(f.depart)}`,
          badge: f.statut === 'complete' ? 'Complète' : 'À compléter',
          tone: f.statut === 'complete' ? 'jade' : 'crimson',
          rendu: <FichePoliceDoc fiche={f} />,
        });
      }
    }
    if (famille === 'tournees') {
      for (const t of state.tournees) {
        if (!filtre(`${t.shift} ${t.agent}`)) continue;
        liste.push({
          cle: t.id,
          titre: `Shift ${t.shift}`,
          sous: `${t.agent} · ${t.debut} → ${t.fin ?? 'en cours'}`,
          meta: `${t.taches.filter((x) => x.fait).length}/${t.taches.length} contrôles`,
          badge: t.statut === 'clos' ? 'Signé' : 'Brouillon',
          tone: t.statut === 'clos' ? 'jade' : 'neutral',
          rendu: <RapportTourneeDoc tournee={t} suivante={state.tournees.find((x) => x.id !== t.id)} />,
        });
      }
    }
    if (famille === 'regie') {
      if (filtre('régie restaurant marsa')) {
        liste.push({
          cle: 'regie',
          titre: `Relevé de régie — ${fmtCourt(state.date)}`,
          sous: `Restaurant Le Marsa · ${regie.commandes} commandes`,
          meta: `${money(regie.aReverser)} MAD à reverser`,
          badge: 'Régie',
          tone: 'neutral',
          rendu: <ReleveRegieDoc regie={regie} date={state.date} />,
        });
      }
    }
    return liste;
  }, [famille, recherche, state.factures, state.fichesPolice, state.tournees, regie, state.date]);

  return (
    <div className="space-y-4 px-4 py-5 sm:px-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Factures émises"
          value={String(state.factures.length)}
          unit={`${money(state.factures.reduce((s, f) => s + f.montant, 0))} MAD`}
        />
        <Stat label="Fiches de police" value={String(state.fichesPolice.length)} unit="séjours déclarés" />
        <Stat
          label="Rapports de tournée"
          value={String(state.tournees.filter((t) => t.statut === 'clos').length)}
          unit={`sur ${state.tournees.length} shifts`}
          tone="jade"
        />
        <Stat
          label="Régie restaurant"
          value={money(regie.encaisseParHotel)}
          unit="MAD encaissés pour le restaurant"
          tone="maj"
        />
      </div>

      <Card>
        <CardHeader
          titre="Bibliothèque des pièces imprimables"
          sousTitre={`${fmtLong(state.date)} · aperçu A4 puis impression / PDF`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5">
                <Search className="size-3.5 text-ink-3" />
                <input
                  aria-label="Rechercher un document"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Numéro, client…"
                  className="w-40 bg-transparent text-[12px] outline-none placeholder:text-ink-3"
                />
              </div>
            </div>
          }
        />

        <div className="flex flex-wrap gap-1.5 border-b border-line-soft px-5 py-3">
          {FAMILLES.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.cle}
                type="button"
                onClick={() => setFamille(f.cle)}
                className={cx(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors',
                  famille === f.cle
                    ? 'border-maj bg-maj-50 text-maj'
                    : 'border-line bg-surface text-ink-2 hover:bg-sand-50',
                )}
              >
                <Icon className="size-3.5" />
                {f.label}
              </button>
            );
          })}
        </div>

        <ul className="divide-y divide-line-soft">
          {documents.map((d) => (
            <li key={d.cle} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-sand-50/60">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium text-ink">{d.titre}</p>
                  <Pill tone={d.tone}>{d.badge}</Pill>
                </div>
                <p className="truncate text-[11px] text-ink-3">{d.sous}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="tnum text-[12px] text-ink-2">{d.meta}</span>
                <Button variant="outline" size="sm" onClick={() => setApercu(d)}>
                  <Printer className="size-3.5" />
                  <span className="sr-only sm:not-sr-only">Aperçu</span>
                </Button>
              </div>
            </li>
          ))}
          {documents.length === 0 && (
            <li className="px-5 py-8 text-center text-[12px] text-ink-3">
              Aucun document dans cette famille.
            </li>
          )}
        </ul>
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-line bg-sand-50 p-3">
        <FileText className="mt-0.5 size-4 shrink-0 text-ink-3" />
        <p className="text-[12px] leading-5 text-ink-2">
          Les documents reprennent les mentions légales de l’établissement (ICE, RC, IF, patente,
          CNSS) et ventilent la TVA par taux : 10 % sur l’hébergement et les pensions, 20 % sur la
          restauration et les prestations annexes, taxe de séjour hors TVA. L’impression passe par la
          boîte de dialogue du navigateur : « Enregistrer au format PDF » produit l’archive à archiver.
        </p>
      </div>

      {apercu && (
        <ApercuDocument titre={`${apercu.badge} — ${apercu.titre}`} onClose={() => setApercu(null)}>
          {apercu.rendu}
        </ApercuDocument>
      )}
    </div>
  );
}
