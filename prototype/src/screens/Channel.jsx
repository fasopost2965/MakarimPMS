// ------------------------------------------------------------------
// Channel manager · distribution en ligne.
//
// Un hôtel 3★ vend surtout par les OTA, et une chambre vendue deux fois coûte
// plus cher qu'une chambre vide (BR-RES-001). L'écran montre donc trois
// choses : qui est connecté, quand la dernière synchronisation a eu lieu, et
// si la grille publiée a bien été poussée.
//
// Simulation assumée : aucune requête réseau n'est émise. Le sens de
// circulation est celui d'un vrai channel manager (pousser tarifs et
// disponibilités, récupérer les réservations).
// ------------------------------------------------------------------

import { useState } from 'react';
import {
  CalendarClock, CheckCircle2, Link2, PlugZap, RefreshCw, Send, TriangleAlert, WifiOff,
} from 'lucide-react';
import { CANAUX, TYPES_CHAMBRE } from '../data';
import { prixDuJour, saisonActive, useApp } from '../store';
import { fmtLong, money } from '../lib/date';
import { Button, Card, CardHeader, Pill, Stat, cx, useToast } from '../components/ui';
import { InfoBulle } from '../components/InfoBulle';

export function Channel() {
  const { state, actions } = useApp();
  const { push } = useToast();
  const [enCours, setEnCours] = useState(null);

  const connectes = state.canauxDistribution.filter((c) => c.etat === 'connecte');
  const saison = saisonActive(state);
  const dernierSync = connectes.map((c) => c.dernierSync).filter((h) => h !== 'nc').sort().pop();

  const synchroniser = (id) => {
    setEnCours(id);
    setTimeout(() => {
      actions.syncCanal(id);
      setEnCours(null);
      push('Synchronisation terminée · disponibilités et tarifs à jour.', 'success');
    }, 600);
  };

  const pousser = () => {
    actions.pousserTarifs();
    push(`Grille v${state.parametres.version} poussée vers ${connectes.length} canal(aux).`, 'success');
  };

  return (
    <div className="space-y-4 px-4 py-5 sm:px-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Canaux connectés" value={String(connectes.length)} unit={`sur ${state.canauxDistribution.length}`} />
        <Stat label="Dernière synchronisation" value={dernierSync ?? 'nc'} unit="aujourd’hui" tone="jade" />
        <Stat
          label="Grille publiée"
          value={`v${state.parametres.version}`}
          unit={`${saison?.nom ?? 'saison standard'} · coef. ${saison?.coef ?? 1}`}
        />
      </div>

      <Card>
        <CardHeader
          titre="Connexions de distribution"
          sousTitre={`${fmtLong(state.date)} · tarifs poussés depuis la grille publiée`}
          action={
            <div className="flex items-center gap-2">
              <InfoBulle titre="Ce que fait le channel manager" cote="gauche">
                Il pousse vos tarifs et disponibilités vers les plateformes, et récupère leurs
                réservations dans le planning · sans double saisie et sans risque de surréservation
                (BR-RES-001). Les réservations importées arrivent en statut confirmé.
              </InfoBulle>
              <Button onClick={pousser} disabled={connectes.length === 0}>
                <Send className="size-3.5" /> Pousser tarifs & dispo
              </Button>
            </div>
          }
        />

        <ul className="divide-y divide-line-soft">
          {state.canauxDistribution.map((c) => {
            const connecte = c.etat === 'connecte';
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span
                  className={cx(
                    'grid size-9 shrink-0 place-items-center rounded-lg',
                    connecte ? 'bg-jade-100 text-jade' : 'bg-mist-100 text-ink-3',
                  )}
                >
                  {connecte ? <Link2 className="size-4" /> : <WifiOff className="size-4" />}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
                    {c.nom}
                    <Pill tone={connecte ? 'jade' : 'neutral'}>{connecte ? 'connecté' : 'déconnecté'}</Pill>
                  </p>
                  <p className="text-[11px] text-ink-3">
                    {c.type} · {c.mapping} type(s) mappé(s) · {c.reservationsJour} réservation(s) du jour
                    {connecte ? ` · dernière synchro ${c.dernierSync}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {connecte && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => synchroniser(c.id)}
                      disabled={enCours === c.id}
                    >
                      <RefreshCw className={cx('size-3.5', enCours === c.id && 'animate-spin')} />
                      {enCours === c.id ? 'Synchro…' : 'Synchroniser'}
                    </Button>
                  )}
                  <Button
                    variant={connecte ? 'ghost' : 'primary'}
                    size="sm"
                    onClick={() => {
                      actions.toggleCanal(c.id);
                      push(
                        connecte
                          ? `${c.nom} déconnecté · les tarifs ne sont plus poussés.`
                          : `${c.nom} connecté · mappage des 4 types de chambre.`,
                        connecte ? 'info' : 'success',
                      );
                    }}
                  >
                    <PlugZap className="size-3.5" />
                    {connecte ? 'Déconnecter' : 'Connecter'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            titre="Tarifs poussés par type de chambre"
            sousTitre={`Grille v${state.parametres.version} · ${saison?.nom ?? 'saison standard'}`}
          />
          <ul className="divide-y divide-line-soft">
            {Object.entries(TYPES_CHAMBRE).map(([cle, t]) => (
              <li key={cle} className="flex items-center justify-between px-5 py-2.5 text-[12px]">
                <span className="text-ink-2">{t.label}</span>
                <span className="tnum font-medium text-ink">{money(prixDuJour(state, cle))} MAD</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-line-soft px-5 py-3">
            <p className="text-[11px] leading-4 text-ink-3">
              Les tarifs poussés incluent le coefficient de saison appliqué à la date d’exploitation.
              Une modification de grille doit être <strong className="font-medium text-ink">publiée</strong>{' '}
              avant d’être poussée.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader titre="Mapping des canaux" sousTitre="Correspondance types de chambre ↔ plateformes" />
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-line-soft text-[11px] tracking-[0.06em] text-ink-3 uppercase">
                  <th className="px-5 py-2 text-left font-semibold">Type</th>
                  {connectes.map((c) => (
                    <th key={c.id} className="px-3 py-2 text-center font-semibold">{c.nom.split(' ')[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(TYPES_CHAMBRE).map(([cle, t]) => (
                  <tr key={cle} className="border-b border-line-soft last:border-0">
                    <td className="px-5 py-2 text-ink-2">{t.court}</td>
                    {connectes.map((c) => (
                      <td key={c.id} className="px-3 py-2 text-center">
                        <CheckCircle2 className="mx-auto size-3.5 text-jade" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line-soft px-5 py-3">
            <p className="flex items-start gap-2 text-[11px] leading-4 text-ink-2">
              <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
              Canaux actifs dans le PMS : {Object.values(CANAUX).map((c) => c.label).join(', ')}.
            </p>
          </div>
        </Card>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-saffron/40 bg-saffron-100/40 p-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-saffron" />
        <p className="text-[12px] leading-5 text-ink-2">
          <strong className="font-medium text-ink">Démonstration :</strong> aucune connexion réseau
          n’est ouverte vers Booking.com ni vers les autres plateformes. L’écran reproduit le
          comportement attendu (connexion, synchronisation, push) pour valider l’ergonomie avant
          d’intégrer un vrai channel manager.
        </p>
      </div>
    </div>
  );
}
