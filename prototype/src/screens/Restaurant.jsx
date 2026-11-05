// Restaurant Le Marsa — quatre onglets : service du jour (plan de salle et
// prise de commande), carte & ruptures, petit-déjeuner, rapport du jour.
//
// Règles métier : BR-RST-001 (une note par table et par service), BR-RST-002
// (envoi en chambre vers le folio), BR-RST-003 (petit-déjeuner inclus non
// refacturé), BR-RST-004 (rupture), BR-RST-005 (encaissement, TVA 20 %).

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BedDouble,
  ChefHat,
  Coffee,
  CreditCard,
  Minus,
  Plus,
  Receipt,
  Search,
  Users,
  Utensils,
} from 'lucide-react';
import { CATEGORIES_RESTO, TABLES } from '../data';
import { useApp } from '../store';
import { money } from '../lib/date';
import { totalCommande } from '../lib/pricing';
import { Bar, Button, Card, CardHeader, Modal, Pill, cx, useToast } from '../components/ui';

const ONGLETS = [
  { cle: 'service', label: 'Service du jour', icon: Utensils },
  { cle: 'carte', label: 'Carte & disponibilités', icon: ChefHat },
  { cle: 'petitdej', label: 'Petit-déjeuner', icon: Coffee },
  { cle: 'rapport', label: 'Rapport du jour', icon: Receipt },
];

const MOYENS = ['Espèces', 'Carte bancaire', 'Virement'];

function PanneauCommande({ table, onClose }) {
  const { state, actions } = useApp();
  const { push } = useToast();
  const [cat, setCat] = useState('Plats');
  const [lignes, setLignes] = useState([]);
  const [modaleChambre, setModaleChambre] = useState(false);
  const [chambreChoisie, setChambreChoisie] = useState(state.sejours[0]?.chambre ?? '');
  const [moyen, setMoyen] = useState('Espèces');

  const commandeOuverte = state.commandes.find((c) => c.table === table.id && c.statut === 'ouverte');

  useEffect(() => {
    setLignes(
      commandeOuverte
        ? commandeOuverte.lignes.map((l) => ({ ...l }))
        : [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.id]);

  const total = lignes.reduce((s, l) => s + l.prix * l.qte, 0);
  const articles = state.carte.filter((a) => a.cat === cat);

  function ajouter(article) {
    if (!article.dispo) return;
    setLignes((prev) => {
      const found = prev.find((l) => l.articleId === article.id);
      if (found) return prev.map((l) => (l.articleId === article.id ? { ...l, qte: l.qte + 1 } : l));
      return [...prev, { articleId: article.id, nom: article.nom, prix: article.prix, qte: 1 }];
    });
  }

  function retirer(articleId) {
    setLignes((prev) =>
      prev.flatMap((l) => (l.articleId === articleId ? (l.qte > 1 ? [{ ...l, qte: l.qte - 1 }] : []) : [l])),
    );
  }

  function envoyerEnChambre() {
    actions.commitOrder({ table: table.id, couverts: table.couverts, lignes, mode: 'room', chambre: chambreChoisie });
    push(`Note de ${money(total)} MAD envoyée au folio de la chambre ${chambreChoisie}.`);
    setModaleChambre(false);
    onClose();
  }

  function encaisser() {
    actions.commitOrder({ table: table.id, couverts: table.couverts, lignes, mode: 'cash', moyen });
    push(`Table ${table.id} encaissée — ${money(total)} MAD (${moyen.toLowerCase()}).`);
    onClose();
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-surface p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-ink">Table {table.id}</p>
            <p className="text-[11px] text-ink-3">{table.couverts} couverts · {table.zone}</p>
          </div>
          <Pill tone={commandeOuverte ? 'maj' : 'jade'}>{commandeOuverte ? 'Commande ouverte' : 'Libre'}</Pill>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES_RESTO.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={cx(
              'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
              cat === c ? 'bg-ink text-white' : 'border border-line bg-surface text-ink-2 hover:bg-sand-50',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-xl border border-line bg-surface p-1.5">
        {articles.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={!a.dispo}
            onClick={() => ajouter(a)}
            className={cx(
              'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
              a.dispo ? 'hover:bg-maj-50' : 'cursor-not-allowed opacity-40',
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium text-ink">{a.nom}</span>
              <span className="block truncate text-[10px] text-ink-3">{a.desc}</span>
            </span>
            <span className="tnum text-[12px] font-semibold text-ink-2">{a.prix}</span>
            <Plus className="size-3.5 text-maj" />
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line-soft px-3 py-2">
          <p className="text-[11px] font-semibold tracking-[0.05em] text-ink-3 uppercase">Commande en cours</p>
          <span className="tnum text-[11px] text-ink-3">{lignes.reduce((s, l) => s + l.qte, 0)} article(s)</span>
        </div>
        <div className="max-h-40 overflow-y-auto">
          {lignes.length === 0 && (
            <p className="px-3 py-6 text-center text-[11px] text-ink-3">Aucun article — sélectionnez un plat dans la carte.</p>
          )}
          {lignes.map((l) => (
            <div key={l.articleId} className="flex items-center gap-2 border-b border-line-soft px-3 py-1.5 last:border-b-0">
              <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{l.nom}</span>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => retirer(l.articleId)} className="grid size-5 place-items-center rounded border border-line text-ink-3 hover:bg-sand-100" aria-label={`Retirer ${l.nom}`}>
                  <Minus className="size-3" />
                </button>
                <span className="tnum w-4 text-center text-[12px] font-medium">{l.qte}</span>
                <button type="button" onClick={() => ajouter({ ...l, id: l.articleId, dispo: true })} className="grid size-5 place-items-center rounded border border-line text-ink-3 hover:bg-sand-100" aria-label={`Ajouter ${l.nom}`}>
                  <Plus className="size-3" />
                </button>
              </div>
              <span className="tnum w-14 text-right text-[12px] font-semibold text-ink">{l.prix * l.qte}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-3 py-2.5">
          <div>
            <p className="text-[12px] font-medium text-ink-2">Total TTC</p>
            <p className="tnum text-lg font-semibold text-ink">{money(total)} MAD</p>
            <p className="text-[10px] text-ink-3">TVA 20 % · {money(total / 1.2)} MAD HT</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Button size="sm" onClick={() => setModaleChambre(true)} disabled={!lignes.length}>
              <BedDouble className="size-3.5" /> Envoyer en chambre
            </Button>
            <Button size="sm" variant="outline" disabled={!lignes.length} onClick={encaisser}>
              <CreditCard className="size-3.5" /> Encaisser
            </Button>
          </div>
        </div>
        <div className="border-t border-line-soft px-3 py-2">
          <span id="resto-moyen" className="text-[12px] font-medium text-ink-2">
            Moyen de paiement direct
          </span>
          <div role="group" aria-labelledby="resto-moyen" className="mt-1 flex gap-1.5">
            {MOYENS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMoyen(m)}
                className={cx(
                  'rounded-lg border px-2.5 py-1.5 text-[11px] font-medium',
                  moyen === m ? 'border-maj bg-maj-50 text-maj' : 'border-line text-ink-2',
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Modal
        open={modaleChambre}
        onClose={() => setModaleChambre(false)}
        title="Envoyer la note en chambre"
        subtitle="La charge rejoint le folio du séjour en cours (type RESTAURANT)."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModaleChambre(false)}>Annuler</Button>
            <Button onClick={envoyerEnChambre} disabled={!chambreChoisie}>Envoyer {money(total)} MAD</Button>
          </div>
        }
      >
        <label htmlFor="resto-chambre" className="text-[12px] font-semibold text-ink-2">
          Chambre du client
        </label>
        <select
          id="resto-chambre"
          value={chambreChoisie}
          onChange={(e) => setChambreChoisie(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-[13px]"
        >
          {state.sejours.map((s) => (
            <option key={s.id} value={s.chambre}>
              Chambre {s.chambre} — {s.client}
            </option>
          ))}
        </select>
        <p className="mt-3 rounded-lg bg-saffron-100 px-3 py-2 text-[11px] leading-4 text-ink-2">
          Règle conservée : la note n’est possible que si le séjour est en cours.
          Une trace d’audit est écrite et le check-out restera bloqué tant que le
          folio n’est pas soldé.
        </p>
      </Modal>
    </div>
  );
}

export function Restaurant() {
  const { state, actions } = useApp();
  const { push } = useToast();
  const [onglet, setOnglet] = useState('service');
  const [table, setTable] = useState(null);
  const [recherche, setRecherche] = useState('');

  const ouvertes = state.commandes.filter((c) => c.statut === 'ouverte');
  const servies = state.commandes.filter((c) => c.statut === 'envoyee');
  const reglees = state.commandes.filter((c) => c.statut === 'reglee');

  const caJour = reglees.reduce((s, c) => s + totalCommande(c), 0);
  const caChambre = servies.reduce((s, c) => s + totalCommande(c), 0);
  const couvertsServis = [...reglees, ...servies].reduce((s, c) => s + c.couverts, 0);

  const etatTable = (t) => {
    if (ouvertes.some((c) => c.table === t.id)) return 'occupee';
    if (state.commandes.some((c) => c.table === t.id && c.statut === 'envoyee' && c.folioChambre)) return 'occupee';
    return 'libre';
  };

  const petitDej = state.sejours.filter((s) => s.formule !== 'RO');
  const couvertsDemain = petitDej.reduce((s, x) => s + x.occupants, 0);

  const caParCategorie = useMemo(() => {
    const map = {};
    for (const c of [...reglees, ...servies]) {
      for (const l of c.lignes) {
        const article = state.carte.find((a) => a.id === l.articleId);
        const cat = article?.cat ?? 'Autres';
        map[cat] = (map[cat] ?? 0) + l.prix * l.qte;
      }
    }
    return Object.entries(map)
      .map(([cat, montant]) => ({ cat, montant }))
      .sort((a, b) => b.montant - a.montant);
  }, [state]);

  const maxCat = Math.max(1, ...caParCategorie.map((c) => c.montant));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.1em] text-ink-3 uppercase">Exploitation · Restauration</p>
          <h2 className="font-display mt-1 text-[26px] leading-tight">Restaurant Le Marsa</h2>
          <p className="mt-1 text-[13px] text-ink-2">48 couverts · 12 tables · service midi & soir · cuisine marocaine</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => push('Bon de commande imprimé en cuisine', 'info')}>
            <ChefHat className="size-3.5" /> Bon cuisine
          </Button>
          <Button onClick={() => { setOnglet('service'); setTable(TABLES.find((t) => etatTable(t) === 'libre')); }}>
            <Plus className="size-3.5" /> Nouvelle commande
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-line pb-2">
        {ONGLETS.map((o) => {
          const Icon = o.icon;
          return (
            <button
              key={o.cle}
              type="button"
              onClick={() => setOnglet(o.cle)}
              className={cx(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
                onglet === o.cle ? 'bg-maj text-white' : 'text-ink-2 hover:bg-surface',
              )}
            >
              <Icon className="size-3.5" />
              {o.label}
            </button>
          );
        })}
      </div>

      {onglet === 'service' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Tickets ouverts', `${ouvertes.length}`, `${ouvertes.reduce((s, c) => s + c.couverts, 0)} couverts`],
                ['Couverts servis', `${couvertsServis}`, 'midi & soir'],
                ['CA encaissé', `${money(caJour)} MAD`, `dont ${money(caChambre)} en chambre`],
              ].map(([l, v, h]) => (
                <Card key={l} className="p-4">
                  <p className="text-[10px] font-medium tracking-[0.06em] text-ink-3 uppercase">{l}</p>
                  <p className="tnum mt-1 text-xl font-semibold text-ink">{v}</p>
                  <p className="mt-0.5 text-[11px] text-ink-3">{h}</p>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader
                titre="Plan de salle"
                sousTitre="Sélectionnez une table pour ouvrir ou reprendre la commande"
                action={
                  <div className="flex gap-1.5">
                    <Pill tone="maj">Ouverte</Pill>
                    <Pill tone="jade">Libre</Pill>
                  </div>
                }
              />
              <div className="space-y-4 p-4">
                {['Salle', 'Terrasse', 'Bar'].map((zone) => (
                  <div key={zone}>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] font-semibold tracking-[0.09em] text-ink-3 uppercase">{zone}</p>
                      <span className="text-[10px] text-ink-3">{TABLES.filter((t) => t.zone === zone).length} tables</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {TABLES.filter((t) => t.zone === zone).map((t) => {
                        const ouvert = ouvertes.find((c) => c.table === t.id);
                        const occupee = etatTable(t) === 'occupee';
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setTable(t)}
                            className={cx(
                              'rounded-xl border p-2.5 text-left transition-all hover:-translate-y-0.5',
                              table?.id === t.id
                                ? 'border-maj bg-maj text-white shadow-card'
                                : occupee
                                  ? 'border-maj/30 bg-maj-50 text-maj'
                                  : 'border-jade/30 bg-surface text-jade',
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[13px] font-semibold">{t.id}</span>
                              <span className="flex items-center gap-1 text-[10px] opacity-80">
                                <Users className="size-3" /> {t.couverts}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-[10px] opacity-80">
                              {ouvert ? `${money(totalCommande(ouvert))} MAD · ${ouvert.heure}` : occupee ? 'Note en chambre' : 'Disponible'}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader titre="Dernières notes envoyées" sousTitre="Écritures au folio du jour" />
              <ul className="divide-y divide-line-soft">
                {servies.length === 0 && <li className="px-5 py-6 text-center text-[12px] text-ink-3">Aucune note envoyée aujourd’hui.</li>}
                {servies.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="tnum text-[11px] text-ink-3">{c.heure}</span>
                    <span className="grid size-9 place-items-center rounded-lg bg-maj-50 text-maj">
                      <BedDouble className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-ink">
                        Chambre {c.folioChambre} — table {c.table}
                      </p>
                      <p className="truncate text-[10px] text-ink-3">
                        {c.lignes.map((l) => `${l.qte} × ${l.nom}`).join(', ')}
                      </p>
                    </div>
                    <span className="tnum text-[12px] font-semibold text-ink">{money(totalCommande(c))} MAD</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="h-fit p-4">
            {table ? (
              <PanneauCommande key={table.id} table={table} onClose={() => setTable(null)} />
            ) : (
              <div className="py-10 text-center">
                <ChefHat className="mx-auto size-6 text-ink-3" />
                <p className="mt-2 text-[12px] font-medium text-ink">Aucune table sélectionnée</p>
                <p className="mt-1 text-[11px] text-ink-3">
                  Choisissez une table dans le plan de salle pour ouvrir une commande
                  ou envoyer une note en chambre.
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {onglet === 'carte' && (
        <Card>
          <CardHeader
            titre="Carte & disponibilités"
            sousTitre={`${state.carte.length} articles · TVA 20 % (prestations annexes)`}
            action={
              <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5">
                <Search className="size-3.5 text-ink-3" />
                <input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher un plat"
                  className="w-32 bg-transparent text-[11px] outline-none placeholder:text-ink-3"
                />
              </div>
            }
          />
          <div className="divide-y divide-line-soft">
            {state.carte
              .filter((p) => !recherche || p.nom.toLowerCase().includes(recherche.toLowerCase()) || p.cat.toLowerCase().includes(recherche.toLowerCase()))
              .map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sand-100 text-ink-2">
                    <ChefHat className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-ink">{p.nom}</p>
                    <p className="truncate text-[10px] text-ink-3">{p.cat} · {p.desc}</p>
                  </div>
                  <span className="tnum w-16 text-right text-[12px] font-semibold text-ink">{p.price ?? p.prix} MAD</span>
                  <button
                    type="button"
                    onClick={() => {
                      actions.toggleArticle(p.id);
                      push(`${p.nom} — ${p.dispo ? 'marqué en rupture' : 'remis à la carte'}`, 'info');
                    }}
                    className={cx(
                      'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium',
                      p.dispo ? 'border-jade/30 bg-jade-100 text-jade' : 'border-crimson/30 bg-crimson-100 text-crimson',
                    )}
                  >
                    <BadgeCheck className="size-3" />
                    {p.dispo ? 'Disponible' : 'Rupture'}
                  </button>
                </div>
              ))}
          </div>
        </Card>
      )}

      {onglet === 'petitdej' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Card>
            <CardHeader
              titre="Petit-déjeuner — demain"
              sousTitre={`${couvertsDemain} couverts prévus · service 6:30 → 10:00`}
              action={<Pill tone="terra">Commande boulangerie à valider</Pill>}
            />
            <ul className="divide-y divide-line-soft">
              {petitDej.length === 0 && <li className="px-5 py-6 text-center text-[12px] text-ink-3">Aucun séjour avec petit-déjeuner.</li>}
              {petitDej.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="tnum grid size-9 place-items-center rounded-lg bg-maj-50 text-[11px] font-semibold text-maj">{s.chambre}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-ink">{s.client}</p>
                    <p className="text-[10px] text-ink-3">
                      {s.formule === 'PC' ? 'Pension complète' : s.formule === 'DP' ? 'Demi-pension' : 'Petit-déjeuner inclus'}
                    </p>
                  </div>
                  <Pill tone={s.formule === 'BB' ? 'jade' : 'terra'}>{s.formule} · {s.occupants} pers.</Pill>
                </li>
              ))}
            </ul>
          </Card>
          <div className="space-y-4">
            <Card className="p-4">
              <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">Préparation</p>
              <div className="mt-3 space-y-3">
                {[
                  ['Couverts', couvertsDemain, 45],
                  ['Inclus BB', petitDej.filter((s) => s.formule === 'BB').reduce((n, s) => n + s.occupants, 0), 45],
                  ['Pensions', petitDej.filter((s) => s.formule !== 'BB').reduce((n, s) => n + s.occupants, 0), 45],
                ].map(([l, v, m]) => (
                  <div key={l}>
                    <div className="mb-1 flex justify-between text-[11px]">
                      <span className="text-ink-2">{l}</span>
                      <span className="tnum font-medium text-ink">{v}</span>
                    </div>
                    <Bar value={v} max={m} tone="bg-terra" />
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">À commander avant 18:00</p>
              <ul className="mt-2 space-y-1.5 text-[12px] text-ink-2">
                {['Msemen — 120 pièces', 'Beghrir — 80 pièces', 'Œufs — 4 plateaux', 'Oranges — 15 kg', 'Lait — 20 L'].map((x) => (
                  <li key={x} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-terra" />
                    {x}
                  </li>
                ))}
              </ul>
              <Button size="sm" variant="soft" className="mt-3 w-full" onClick={() => push('Bon de commande fournisseur créé — à valider par l’économat', 'info')}>
                Générer le bon de commande
              </Button>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'rapport' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Card>
            <CardHeader titre="Chiffre d’affaires par famille" sousTitre={`Aujourd’hui · ${money(caJour + caChambre)} MAD TTC`} />
            <div className="space-y-3 px-5 py-4">
              {caParCategorie.length === 0 && <p className="text-[12px] text-ink-3">Aucune vente enregistrée aujourd’hui.</p>}
              {caParCategorie.map((c, i) => (
                <div key={c.cat}>
                  <div className="mb-1 flex justify-between text-[12px]">
                    <span className="text-ink-2">{c.cat}</span>
                    <span className="tnum font-medium text-ink">{money(c.montant)} MAD</span>
                  </div>
                  <Bar value={c.montant} max={maxCat} tone={['bg-maj', 'bg-terra', 'bg-saffron', 'bg-jade', 'bg-ink-3'][i % 5]} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 divide-x divide-line-soft border-t border-line-soft">
              {[
                ['Ticket moyen', `${money((caJour + caChambre) / Math.max(1, reglees.length + servies.length))} MAD`],
                ['CA / couvert', `${money((caJour + caChambre) / Math.max(1, couvertsServis))} MAD`],
                ['Couverts', `${couvertsServis}`],
              ].map(([l, v]) => (
                <div key={l} className="px-4 py-3">
                  <p className="text-[12px] font-medium text-ink-2">{l}</p>
                  <p className="tnum mt-1 text-sm font-semibold text-ink">{v}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">Répartition des règlements</p>
            <ul className="mt-3 space-y-2.5 text-[12px]">
              {[
                ['Notes en chambre (folio)', caChambre, 'bg-maj'],
                ['Espèces', reglees.filter((c) => c.moyen === 'Espèces').reduce((s, c) => s + totalCommande(c), 0), 'bg-jade'],
                ['Carte bancaire', reglees.filter((c) => c.moyen === 'Carte bancaire').reduce((s, c) => s + totalCommande(c), 0), 'bg-terra'],
              ].map(([l, v, tone]) => (
                <li key={l}>
                  <div className="mb-1 flex justify-between">
                    <span className="text-ink-2">{l}</span>
                    <span className="tnum font-medium text-ink">{money(v)} MAD</span>
                  </div>
                  <Bar value={v} max={Math.max(1, caChambre, caJour)} tone={tone} />
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg bg-sand-100 p-3 text-[11px] leading-4 text-ink-2">
              Les notes en chambre remontent automatiquement au folio et sont
              contrôlées au check-out (garde-fou du module billing).
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
