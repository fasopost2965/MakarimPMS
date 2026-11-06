// Caisse & factures — folios, détail des charges (hébergement / restaurant /
// taxe), encaissements, émission de facture et check-out.
//
// Règles métier : BR-SEJ-004 (solde à 0), BR-TR-002 (facture immuable),
// BR-PAI-001/002 (idempotence et modes de règlement), BR-PAI-003 (plafond
// espèces), BR-FAC-002 (typologie des lignes), BR-FAC-001 (capacité
// multi-folios : répartition société / client et émission de deux factures),
// BR-SEJ-007 (prolongation facturée au client), BR-RST-002 (note en chambre)
// et BR-RST-005 (encaissement direct au restaurant).

import { useMemo, useState } from 'react';
import {
  Banknote,
  BedDouble,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Landmark,
  LogOut,
  Printer,
  Receipt,
  Search,
  User,
} from 'lucide-react';
import { PARAMS } from '../data';
import { regieRestaurant, repartirFolio, soldeDuFolio, useApp } from '../store';
import { fmtCourt, fmtLong, money } from '../lib/date';
import { Bar, Button, Card, CardHeader, Drawer, Modal, Pill, cx, useToast } from '../components/ui';
import { ApercuDocument, FactureDoc, ReleveRegieDoc } from '../components/Document';

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
  const [apercu, setApercu] = useState(null);

  const folio = state.folios.find((f) => f.id === folioId) ?? null;
  const sejour = folio ? state.sejours.find((s) => s.folioId === folio.id) : null;
  // Répartition société / client du folio ouvert (source unique : store).
  const repartition = folio ? repartirFolio(state, folio) : null;
  const partSociete = repartition?.find((r) => r.payeur === 'societe');
  const partClient = repartition?.find((r) => r.payeur === 'client');
  // Régie du restaurant : ce que l'hôtel encaisse pour son compte.
  const regie = regieRestaurant(state);

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
          <p className="mt-1 text-[14px] text-ink-2">{fmtLong(state.date)} · folios du jour, encaissements et notes restaurant.</p>
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
              <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5">
                <Search className="size-3.5 text-ink-3" />
                <input
                  aria-label="Rechercher un folio par numéro, chambre ou client"
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
              <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
                <Receipt className="size-3" /> Plafond espèces : {money(PARAMS.plafondEspeces)} MAD / opération
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader
              titre="Régie restaurant"
              sousTitre="Ce que l’hôtel encaisse pour le compte du restaurant"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setApercu({
                      titre: 'Relevé de régie — Restaurant Le Marsa',
                      rendu: <ReleveRegieDoc regie={regie} date={state.date} />,
                    })
                  }
                >
                  <Printer className="size-3.5" />
                  <span className="sr-only sm:not-sr-only">Relevé</span>
                </Button>
              }
            />
            <div className="space-y-2 px-5 py-4 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-ink-2">Notes portées en chambre</span>
                <span className="tnum font-medium text-ink">{money(regie.totalChambre)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-2">Tables réglées au restaurant</span>
                <span className="tnum font-medium text-ink">{money(regie.totalDirect)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-line-soft pt-2">
                <span className="font-medium text-ink">À reverser au restaurant</span>
                <span className="tnum font-semibold text-ink">{money(regie.aReverser)} MAD</span>
              </div>
              <p className="text-[11px] leading-4 text-ink-3">
                Le client peut régler sa consommation à la réception : la note est alors portée au
                folio de sa chambre. L’hôtel encaisse et reverse au restaurant en fin de journée.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader
              titre="Factures"
              sousTitre={`${state.factures.length} documents émis · aperçu et impression`}
            />
            <ul className="divide-y divide-line-soft">
              {state.factures.slice(0, 6).map((f) => (
                <li key={f.id} className="flex items-center gap-2 px-5 py-2.5">
                  <FileText className="size-3.5 text-ink-3" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-ink">{f.id}</p>
                    <p className="truncate text-[12px] text-ink-3">{f.client}{f.chambre ? ` · ch. ${f.chambre}` : ''}</p>
                  </div>
                  <span className="tnum text-[12px] font-semibold text-ink">{money(f.montant)}</span>
                  <button
                    type="button"
                    aria-label={`Imprimer la facture ${f.id}`}
                    onClick={() => setApercu({ titre: `Facture ${f.id}`, rendu: <FactureDoc facture={f} /> })}
                    className="grid size-9 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-sand-50 hover:text-ink"
                  >
                    <Printer className="size-3.5" />
                  </button>
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
                  actions.emettreFactures(folio.id);
                  const nb = repartition.filter((r) => r.lignes.length > 0).length;
                  push(
                    nb > 1
                      ? `Facturation séparée — ${nb} factures émises (société et client).`
                      : `Facture émise pour ${folio.client}.`,
                  );
                }}
                disabled={folio.statut === 'facture'}
              >
                <FileText className="size-3.5" /> Émettre les factures
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
                  <p className="mt-0.5 text-[12px] text-ink-3">
                    {folio.statut === 'facture' ? 'Facture émise' : soldeDuFolio(folio) <= 0 ? 'Folio soldé' : 'En cours'}
                  </p>
                </div>
                <span className={cx('grid size-11 place-items-center rounded-xl', soldeDuFolio(folio) > 0 ? 'bg-crimson-100 text-crimson' : 'bg-jade-100 text-jade')}>
                  {soldeDuFolio(folio) > 0 ? <Receipt className="size-5" /> : <CheckCircle2 className="size-5" />}
                </span>
              </div>
            </Card>

            <Card>
              <CardHeader
                titre="Charges"
                sousTitre={`${folio.lignes.length} ligne(s) · le payeur se règle ligne par ligne`}
              />
              <ul className="divide-y divide-line-soft">
                {folio.lignes.map((l) => {
                  const auClient = (l.payeur ?? 'client') === 'client';
                  return (
                    <li key={l.id} className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[12px] text-ink-2">{l.libelle}</span>
                        <Pill tone={l.type === 'hebergement' ? 'maj' : l.type === 'restaurant' ? 'terra' : 'saffron'}>
                          {l.type === 'hebergement' ? 'Hébergement' : l.type === 'restaurant' ? 'Restaurant' : l.type === 'taxe' ? 'Taxe séjour' : 'Extra'}
                        </Pill>
                        <span className="tnum w-16 text-right text-[12px] font-medium text-ink">{money(l.montant)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => actions.setPayeur(folio.id, l.id, auClient ? 'societe' : 'client')}
                          disabled={!folio.societeId || folio.statut === 'facture'}
                          className={cx(
                            'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                            auClient
                              ? 'border-line bg-sand-50 text-ink-2'
                              : 'border-maj/30 bg-maj-100 text-maj',
                            (!folio.societeId || folio.statut === 'facture') && 'cursor-default opacity-70',
                          )}
                          title={
                            folio.societeId
                              ? 'Basculer la charge entre le client et l’entreprise'
                              : 'Séjour sans entreprise : le client règle tout'
                          }
                        >
                          {auClient ? <User className="size-3" /> : <Building2 className="size-3" />}
                          {auClient ? 'Client' : 'Entreprise'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Répartition et facturation séparée */}
              <div className="border-t border-line-soft px-4 py-3">
                <p className="text-[10px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
                  Répartition de la facturation
                </p>
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-1.5 text-ink-2">
                      <Building2 className="size-3.5 text-ink-3" />
                      {partSociete?.libelle ?? 'Entreprise'}
                    </span>
                    <span className="tnum font-medium text-ink">{money(partSociete?.total ?? 0)} MAD</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-1.5 text-ink-2">
                      <User className="size-3.5 text-ink-3" /> {folio.client}
                    </span>
                    <span className="tnum font-medium text-ink">{money(partClient?.total ?? 0)} MAD</span>
                  </div>
                </div>
                {sejour && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => {
                      actions.prolongerSejour(sejour.id);
                      push('Nuit supplémentaire ajoutée — facturée au client, pas à l’entreprise.');
                    }}
                    disabled={folio.statut === 'facture'}
                  >
                    <BedDouble className="size-3.5" /> Ajouter une nuit au compte du client
                  </Button>
                )}
                {partSociete && partSociete.total > 0 && partClient && partClient.total > 0 && (
                  <p className="mt-2 text-[11px] leading-4 text-ink-3">
                    Deux factures distinctes seront émises : une à l’entreprise, une au client.
                  </p>
                )}
              </div>
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
                      'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[12px] transition-colors',
                      moyen === m.label ? 'border-maj bg-maj-50 text-maj' : 'border-line bg-surface text-ink-2 hover:bg-sand-50',
                    )}
                  >
                    <Icone className="size-4" />
                    <span className="flex-1 text-left">{m.label}</span>
                    {moyen === m.label && <CheckCircle2 className="size-4" />}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 rounded-lg bg-sand-100 px-3 py-2 text-[12px] leading-4 text-ink-2">
              Le règlement est idempotent : un double clic ne crée jamais deux
              encaissements. Plafond espèces {money(PARAMS.plafondEspeces)} MAD.
            </p>
          </>
        ) : (
          <p className="text-[12px] text-ink-3">Sélectionnez d’abord un folio dans la liste.</p>
        )}
      </Modal>

      {apercu && (
        <ApercuDocument titre={apercu.titre} onClose={() => setApercu(null)}>
          {apercu.rendu}
        </ApercuDocument>
      )}
    </div>
  );
}
