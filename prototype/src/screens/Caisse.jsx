// Caisse & factures — folios, détail des charges (hébergement / restaurant /
// taxe), encaissements, émission de facture et check-out.
//
// Règles métier : BR-SEJ-004 (solde à 0), BR-TR-002 (facture immuable),
// BR-PAI-001/002 (idempotence et modes de règlement), BR-PAI-003 (plafond
// espèces), BR-FAC-002 (typologie des lignes).

import { useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Landmark,
  LogOut,
  Receipt,
  Search,
} from 'lucide-react';
import { PARAMS } from '../data';
import { soldeDuFolio, useApp } from '../store';
import { fmtCourt, fmtLong, money } from '../lib/date';
import { Bar, Button, Card, CardHeader, Drawer, Modal, Pill, cx, useToast } from '../components/ui';

const MOYENS = [
  { label: 'Espèces', icone: Banknote },
  { label: 'Carte bancaire', icone: CreditCard },
  { label: 'Virement', icone: Landmark },
];

export function Caisse() {
  const { state, actions } = useApp();
  const { push } = useToast();
  const [filtre, setFiltre] = useState('tous');
  const [recherche, setRecherche] = useState('');
  const [folioId, setFolioId] = useState(null);
  const [paiement, setPaiement] = useState(false);
  const [moyen, setMoyen] = useState('Espèces');

  const folio = state.folios.find((f) => f.id === folioId) ?? null;
  const sejour = folio ? state.sejours.find((s) => s.folioId === folio.id) : null;

  const encaisse = state.folios.reduce(
    (s, f) => s + f.paiements.reduce((x, p) => x + p.montant, 0),
    0,
  );
  const notesChambre = state.folios.reduce(
    (s, f) => s + f.lignes.filter((l) => l.type === 'restaurant').reduce((x, l) => x + l.montant, 0),
    0,
  );
  const taxeCollectee = state.folios.reduce(
    (s, f) => s + f.lignes.filter((l) => l.type === 'taxe').reduce((x, l) => x + l.montant, 0),
    0,
  );
  const totalSoldes = state.folios.reduce((s, f) => s + Math.max(0, soldeDuFolio(f)), 0);

  const liste = useMemo(
    () =>
      state.folios.filter((f) => {
        const solde = soldeDuFolio(f);
        const okFiltre =
          filtre === 'tous' ||
          (filtre === 'ouvert' && solde > 0 && f.statut === 'ouvert') ||
          (filtre === 'solde' && solde <= 0 && f.statut !== 'facture') ||
          (filtre === 'facture' && f.statut === 'facture');
        const q = recherche.trim().toLowerCase();
        const okQ = !q || f.client.toLowerCase().includes(q) || f.chambre?.includes(q) || f.id.toLowerCase().includes(q);
        return okFiltre && okQ;
      }),
    [state.folios, filtre, recherche],
  );

  function encaisser() {
    actions.payFolio(folio.id, moyen);
    push(`Encaissement enregistré — ${money(soldeDuFolio(folio))} MAD (${moyen.toLowerCase()}).`);
    setPaiement(false);
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.1em] text-ink-3 uppercase">Administration · Caisse</p>
          <h2 className="font-display mt-1 text-[26px] leading-tight">Caisse & factures</h2>
          <p className="mt-1 text-[13px] text-ink-2">{fmtLong(state.date)} · folios du jour, encaissements et notes restaurant.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => push('Journal de caisse exporté (CSV)', 'info')}>
            <Download className="size-3.5" /> Journal de caisse
          </Button>
          <Button onClick={() => setPaiement(true)} disabled={!folio}>
            <CreditCard className="size-3.5" /> Encaisser un folio
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Encaissé (folios)', `${money(encaisse)} MAD`, 'règlements enregistrés', 'jade'],
          ['Notes en chambre', `${money(notesChambre)} MAD`, 'écritures restaurant', 'maj'],
          ['Factures émises', `${state.factures.length}`, 'dont séminaires', 'neutral'],
          ['Taxe de séjour', `${money(taxeCollectee)} MAD`, `reversement Trésor · ${PARAMS.taxeSejour} MAD/nuit/adulte`, 'saffron'],
        ].map(([l, v, h, tone]) => (
          <Card key={l} className="p-4">
            <p className="text-[10px] font-medium tracking-[0.06em] text-ink-3 uppercase">{l}</p>
            <p className="tnum mt-1 text-xl font-semibold text-ink">{v}</p>
            <Pill tone={tone} className="mt-1.5">{h}</Pill>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader
            titre="Folios"
            sousTitre={`${liste.length} dossier(s) · ${money(totalSoldes)} MAD de soldes ouverts`}
            action={
              <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5">
                <Search className="size-3.5 text-ink-3" />
                <input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Folio, chambre, client"
                  className="w-32 bg-transparent text-[11px] outline-none placeholder:text-ink-3"
                />
              </div>
            }
          />
          <div className="flex flex-wrap gap-1.5 border-b border-line-soft px-5 py-2.5">
            {[
              ['tous', 'Tous'],
              ['ouvert', 'Soldes ouverts'],
              ['solde', 'Soldés'],
              ['facture', 'Facturés'],
            ].map(([cle, label]) => (
              <button
                key={cle}
                type="button"
                onClick={() => setFiltre(cle)}
                className={cx(
                  'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  filtre === cle ? 'bg-ink text-white' : 'bg-sand-100 text-ink-2 hover:bg-sand-200',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-[10px] tracking-[0.05em] text-ink-3 uppercase">
                  <th className="px-5 py-2 font-medium">Folio</th>
                  <th className="px-2 py-2 font-medium">Client</th>
                  <th className="px-2 py-2 text-right font-medium">Charges</th>
                  <th className="px-2 py-2 text-right font-medium">Réglé</th>
                  <th className="px-2 py-2 text-right font-medium">Solde</th>
                  <th className="px-5 py-2 text-right font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {liste.map((f) => {
                  const charges = f.lignes.reduce((s, l) => s + l.montant, 0);
                  const regle = f.paiements.reduce((s, p) => s + p.montant, 0);
                  const solde = charges - regle;
                  return (
                    <tr key={f.id} className={cx('cursor-pointer hover:bg-sand-50/60', folioId === f.id && 'bg-maj-50/60')} onClick={() => setFolioId(f.id)}>
                      <td className="px-5 py-2.5">
                        <span className="block font-medium text-ink">{f.id}</span>
                        <span className="text-[10px] text-ink-3">Ch. {f.chambre}</span>
                      </td>
                      <td className="max-w-[150px] truncate px-2 py-2.5 text-ink-2">{f.client}</td>
                      <td className="tnum px-2 py-2.5 text-right text-ink-2">{money(charges)}</td>
                      <td className="tnum px-2 py-2.5 text-right text-ink-2">{money(regle)}</td>
                      <td className="tnum px-2 py-2.5 text-right font-semibold text-ink">{money(Math.max(0, solde))}</td>
                      <td className="px-5 py-2.5 text-right">
                        <Pill tone={solde > 0 ? 'crimson' : f.statut === 'facture' ? 'jade' : 'maj'}>
                          {solde > 0 ? 'à encaisser' : f.statut === 'facture' ? 'facturé' : 'soldé'}
                        </Pill>
                      </td>
                    </tr>
                  );
                })}
                {liste.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-[12px] text-ink-3">Aucun folio pour ce filtre.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader titre="Moyens de paiement" sousTitre="Encaissements enregistrés" />
            <div className="space-y-3 px-5 py-4 text-[12px]">
              {[
                ['Carte bancaire', state.folios.flatMap((f) => f.paiements).filter((p) => p.moyen === 'Carte bancaire').reduce((s, p) => s + p.montant, 0), 'bg-maj', CreditCard],
                ['Espèces', state.folios.flatMap((f) => f.paiements).filter((p) => p.moyen === 'Espèces').reduce((s, p) => s + p.montant, 0), 'bg-jade', Banknote],
                ['Virement', state.folios.flatMap((f) => f.paiements).filter((p) => p.moyen === 'Virement').reduce((s, p) => s + p.montant, 0), 'bg-terra', Landmark],
              ].map(([l, v, tone, Icone]) => (
                <div key={l}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-ink-2"><Icone className="size-3.5 text-ink-3" /> {l}</span>
                    <span className="tnum font-medium text-ink">{money(v)}</span>
                  </div>
                  <Bar value={v} max={Math.max(1, encaisse)} tone={tone} />
                </div>
              ))}
            </div>
            <div className="border-t border-line-soft px-5 py-3">
              <p className="flex items-center gap-1.5 text-[10.5px] text-ink-3">
                <Receipt className="size-3" /> Plafond espèces : {money(PARAMS.plafondEspeces)} MAD / opération
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader titre="Factures" sousTitre={`${state.factures.length} documents émis`} />
            <ul className="divide-y divide-line-soft">
              {state.factures.slice(0, 6).map((f) => (
                <li key={f.id} className="flex items-center gap-2 px-5 py-2.5">
                  <FileText className="size-3.5 text-ink-3" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-ink">{f.id}</p>
                    <p className="truncate text-[10.5px] text-ink-3">{f.client}{f.chambre ? ` · ch. ${f.chambre}` : ''}</p>
                  </div>
                  <span className="tnum text-[12px] font-semibold text-ink">{money(f.montant)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* Détail du folio */}
      <Drawer
        open={Boolean(folio)}
        onClose={() => setFolioId(null)}
        title={folio ? `Folio ${folio.id}` : ''}
        subtitle={folio ? `${folio.client} · chambre ${folio.chambre} · ${fmtCourt(state.date)}` : ''}
        footer={
          folio && (
            <div className="flex flex-wrap gap-2">
              {soldeDuFolio(folio) > 0 ? (
                <Button className="flex-1" onClick={() => setPaiement(true)}>
                  <CreditCard className="size-3.5" /> Encaisser {money(soldeDuFolio(folio))} MAD
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  onClick={() => {
                    if (sejour) {
                      actions.checkOut(sejour.id);
                      push(`Check-out — chambre ${folio.chambre}, facture émise.`);
                      setFolioId(null);
                    }
                  }}
                  disabled={!sejour}
                >
                  <LogOut className="size-3.5" /> Check-out
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  actions.invoiceFolio(folio.id);
                  push(`Facture émise pour ${folio.client}.`);
                }}
                disabled={folio.statut === 'facture'}
              >
                <FileText className="size-3.5" /> Facturer
              </Button>
            </div>
          )
        }
      >
        {folio && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] tracking-[0.06em] text-ink-3 uppercase">Solde à régler</p>
                  <p className="tnum mt-1 text-2xl font-semibold text-ink">{money(Math.max(0, soldeDuFolio(folio)))} MAD</p>
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    {folio.statut === 'facture' ? 'Facture émise' : soldeDuFolio(folio) <= 0 ? 'Folio soldé' : 'En cours'}
                  </p>
                </div>
                <span className={cx('grid size-11 place-items-center rounded-xl', soldeDuFolio(folio) > 0 ? 'bg-crimson-100 text-crimson' : 'bg-jade-100 text-jade')}>
                  {soldeDuFolio(folio) > 0 ? <Receipt className="size-5" /> : <CheckCircle2 className="size-5" />}
                </span>
              </div>
            </Card>

            <Card>
              <CardHeader titre="Charges" sousTitre={`${folio.lignes.length} ligne(s)`} />
              <ul className="divide-y divide-line-soft">
                {folio.lignes.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 px-4 py-2">
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ink-2">{l.libelle}</span>
                    <Pill tone={l.type === 'hebergement' ? 'maj' : l.type === 'restaurant' ? 'terra' : 'saffron'}>
                      {l.type === 'hebergement' ? 'Hébergement' : l.type === 'restaurant' ? 'Restaurant' : l.type === 'taxe' ? 'Taxe séjour' : 'Extra'}
                    </Pill>
                    <span className="tnum w-16 text-right text-[12px] font-medium text-ink">{money(l.montant)}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader titre="Règlements" sousTitre={`${folio.paiements.length} encaissement(s)`} />
              {folio.paiements.length === 0 ? (
                <p className="px-4 py-4 text-[12px] text-ink-3">Aucun règlement enregistré.</p>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {folio.paiements.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-4 py-2 text-[12px]">
                      <span className="text-ink-2">{p.moyen} <span className="text-ink-3">· {p.heure}</span></span>
                      <span className="tnum font-medium text-ink">{money(p.montant)} MAD</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </Drawer>

      <Modal
        open={paiement}
        onClose={() => setPaiement(false)}
        title="Encaisser un folio"
        subtitle={folio ? `${folio.client} · solde ${money(Math.max(0, soldeDuFolio(folio)))} MAD` : 'Sélectionnez un folio'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPaiement(false)}>Annuler</Button>
            <Button disabled={!folio} onClick={encaisser}>
              <CreditCard className="size-3.5" /> Valider le règlement
            </Button>
          </div>
        }
      >
        {folio ? (
          <>
            <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">Moyen de paiement</p>
            <div className="mt-2 space-y-1.5">
              {MOYENS.map((m) => {
                const Icone = m.icone;
                return (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => setMoyen(m.label)}
                    className={cx(
                      'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[12.5px] transition-colors',
                      moyen === m.label ? 'border-maj bg-maj-50 text-maj' : 'border-line bg-white text-ink-2 hover:bg-sand-50',
                    )}
                  >
                    <Icone className="size-4" />
                    <span className="flex-1 text-left">{m.label}</span>
                    {moyen === m.label && <CheckCircle2 className="size-4" />}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 rounded-lg bg-sand-100 px-3 py-2 text-[11px] leading-4 text-ink-2">
              Le règlement est idempotent : un double clic ne crée jamais deux
              encaissements. Plafond espèces {money(PARAMS.plafondEspeces)} MAD.
            </p>
          </>
        ) : (
          <p className="text-[12px] text-ink-3">Sélectionnez d’abord un folio dans la liste.</p>
        )}
      </Modal>
    </div>
  );
}
