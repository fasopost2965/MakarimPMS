// ------------------------------------------------------------------
// Stock · consommables, linge et dotation minibar des chambres.
//
// Le stock n'est pas un module comptable isolé : il est branché sur
// l'exploitation. Le minibar se consomme depuis la chambre, la ligne part
// au folio du client et le stock se décrémente dans le même geste. Les
// sorties de petit-déjeuner et de maintenance se déclarent ici.
//
// Règles matérialisées : BR-STK-001 (sortie de stock liée à l'activité),
// BR-STK-002 (alerte de seuil critique), BR-RST-002 (imputation au folio).
// ------------------------------------------------------------------

import { useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, PackageSearch, TriangleAlert } from 'lucide-react';
import { CATEGORIES_STOCK } from '../data';
import { articlesEnAlerte, useApp } from '../store';
import { fmtCourt, money } from '../lib/date';
import { Exports } from '../components/Exports';
import { Button, Card, CardHeader, Modal, Pill, Stat, cx, useToast } from '../components/ui';
import { InfoBulle } from '../components/InfoBulle';

const TYPES_MOUVEMENT = {
  entree: { label: 'Entrée', tone: 'jade', icone: ArrowUpCircle },
  sortie: { label: 'Sortie', tone: 'terracotta', icone: ArrowDownCircle },
};

export function Stock() {
  const { state, actions } = useApp();
  const { push } = useToast();
  const [categorie, setCategorie] = useState('toutes');
  const [mouvement, setMouvement] = useState(null); // { articleId, type }
  const [qte, setQte] = useState('1');
  const [motif, setMotif] = useState('');

  const alertes = articlesEnAlerte(state);
  const valeur = state.stock.reduce((s, a) => s + a.stock * (a.prix || 0), 0);
  const minibarActif = Boolean(state.parametres?.options?.minibar);

  const articles = useMemo(
    () => state.stock.filter((a) => categorie === 'toutes' || a.categorie === categorie),
    [state.stock, categorie],
  );

  const enregistrer = () => {
    actions.mouvementStock(mouvement.articleId, mouvement.type, Number(qte), motif.trim());
    push(`${mouvement.type === 'entree' ? 'Entrée' : 'Sortie'} de stock enregistrée.`, 'success');
    setMouvement(null);
    setQte('1');
    setMotif('');
  };

  return (
    <div className="space-y-4 px-4 py-5 sm:px-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Références suivies" value={String(state.stock.length)} unit="articles" />
        <Stat
          label="Sous le seuil"
          value={String(alertes.length)}
          unit="à réapprovisionner"
          tone={alertes.length > 0 ? 'crimson' : 'jade'}
        />
        <Stat label="Valeur du stock" value={money(Math.round(valeur))} unit="MAD (prix de vente minibar)" />
      </div>

      {alertes.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-saffron/40 bg-saffron-100/40 p-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-saffron" />
          <p className="text-[12px] leading-5 text-ink">
            <strong className="font-semibold">Seuil critique :</strong>{' '}
            {alertes.map((a) => `${a.nom} (${a.stock}/${a.seuil})`).join(' · ')}
          </p>
        </div>
      )}

      <Card>
        <CardHeader
          titre="Inventaire"
          sousTitre="Entrées fournisseurs, sorties d’exploitation et dotation minibar"
          action={
            <div className="flex flex-wrap items-center gap-1.5">
              <Exports
                nom={`stock-${state.date}`}
                titre="Inventaire"
                compact
                colonnes={[
                  { cle: 'nom', label: 'Article' },
                  { cle: 'categorie', label: 'Catégorie' },
                  { cle: 'unite', label: 'Unité' },
                  { cle: 'stock', label: 'Stock' },
                  { cle: 'seuil', label: 'Seuil' },
                  { cle: 'alerte', label: 'Alerte' },
                ]}
                lignes={(state.stock ?? []).map((a) => ({
                  ...a,
                  alerte: a.stock <= a.seuil ? 'Seuil critique' : 'OK',
                }))}
              />
              {['toutes', ...CATEGORIES_STOCK].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategorie(c)}
                  className={cx(
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    categorie === c
                      ? 'border-maj bg-maj-50 text-maj'
                      : 'border-line bg-surface text-ink-2 hover:bg-mist-50',
                  )}
                >
                  {c === 'toutes' ? 'Tout' : c}
                </button>
              ))}
            </div>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-line-soft text-[11px] tracking-[0.06em] text-ink-3 uppercase">
                <th className="px-5 py-2 font-semibold">Article</th>
                <th className="px-3 py-2 font-semibold">Catégorie</th>
                <th className="px-3 py-2 text-right font-semibold">Stock</th>
                <th className="px-3 py-2 text-right font-semibold">Seuil</th>
                <th className="px-3 py-2 font-semibold">État</th>
                <th className="px-5 py-2 text-right font-semibold">Mouvement</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => {
                const alerte = a.stock <= a.seuil;
                return (
                  <tr key={a.id} className="border-b border-line-soft last:border-0 hover:bg-mist-50/60">
                    <td className="px-5 py-2.5">
                      <p className="flex items-center gap-1.5 font-medium text-ink">
                        {a.nom}
                        {a.minibar && minibarActif && (
                          <Pill tone="maj">minibar</Pill>
                        )}
                      </p>
                      <p className="text-[11px] text-ink-3">{a.unite}</p>
                    </td>
                    <td className="px-3 py-2.5 text-ink-2">{a.categorie}</td>
                    <td className="tnum px-3 py-2.5 text-right font-medium text-ink">{a.stock}</td>
                    <td className="tnum px-3 py-2.5 text-right text-ink-3">{a.seuil}</td>
                    <td className="px-3 py-2.5">
                      {alerte ? (
                        <Pill tone="crimson">à réapprovisionner</Pill>
                      ) : (
                        <Pill tone="jade">correct</Pill>
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMouvement({ articleId: a.id, type: 'entree' })}
                        >
                          <ArrowUpCircle className="size-3.5" /> Entrée
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMouvement({ articleId: a.id, type: 'sortie' })}
                        >
                          <ArrowDownCircle className="size-3.5" /> Sortie
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          titre="Derniers mouvements"
          sousTitre="Traçabilité des entrées et sorties"
          action={
            <InfoBulle titre="Sortie liée à l’activité">
              Une sortie de stock n’est jamais saisie « au hasard » : elle se rattache à un service
              (petit-déjeuner, recouche, maintenance) ou à une chambre pour le minibar. Le motif
              saisi ici apparaît dans le journal.
            </InfoBulle>
          }
        />
        <ul className="divide-y divide-line-soft">
          {state.mouvementsStock.slice(0, 8).map((m) => {
            const article = state.stock.find((a) => a.id === m.articleId);
            const type = TYPES_MOUVEMENT[m.type] ?? TYPES_MOUVEMENT.sortie;
            const Icone = type.icone;
            return (
              <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                <Icone className={cx('size-4 shrink-0', m.type === 'entree' ? 'text-jade' : 'text-terra')} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-ink">
                    {article?.nom ?? m.articleId} · {m.qte} {article?.unite ?? ''}
                  </p>
                  <p className="truncate text-[11px] text-ink-3">{m.motif || 'nc'}</p>
                </div>
                <span className="shrink-0 text-[11px] text-ink-3">{fmtCourt(m.date)} {m.heure}</span>
              </li>
            );
          })}
          {state.mouvementsStock.length === 0 && (
            <li className="px-5 py-6 text-center text-[12px] text-ink-3">Aucun mouvement enregistré.</li>
          )}
        </ul>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-line bg-mist-50 p-3">
        <PackageSearch className="mt-0.5 size-4 shrink-0 text-ink-3" />
        <p className="text-[12px] leading-5 text-ink-2">
          Le stock minibar est <strong className="font-medium text-ink">lié aux chambres</strong> : sur
          une chambre dont l’option est activée, la consommation se déclare depuis le plan des
          chambres et le montant est porté au folio du client dans le même geste.
          {!minibarActif && ' L’option est actuellement désactivée dans les paramètres.'}
        </p>
      </div>

      <Modal
        open={Boolean(mouvement)}
        onClose={() => setMouvement(null)}
        title={`${mouvement?.type === 'entree' ? 'Entrée' : 'Sortie'} de stock`}
        subtitle={state.stock.find((a) => a.id === mouvement?.articleId)?.nom ?? ''}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMouvement(null)}>Annuler</Button>
            <Button onClick={enregistrer} disabled={!Number(qte)}>Enregistrer</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="st-qte" className="text-[12px] font-semibold text-ink-2">Quantité</label>
            <input
              id="st-qte"
              type="number"
              min="1"
              value={qte}
              onChange={(e) => setQte(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
            />
          </div>
          <div>
            <label htmlFor="st-motif" className="text-[12px] font-semibold text-ink-2">Motif</label>
            <input
              id="st-motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder={mouvement?.type === 'entree' ? 'Livraison fournisseur' : 'Service petit-déjeuner'}
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[12px] outline-none focus:border-maj focus:ring-2 focus:ring-maj/25"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
