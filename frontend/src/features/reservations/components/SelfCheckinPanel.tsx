import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateSelfCheckinLink, getSelfCheckinPending } from '../api';
import type { SelfCheckinLink, SelfCheckinPending } from '../types';

interface Props {
  reservationId: number;
  guestEmail: string | null;
}

const TYPE_PIECE_LABEL: Record<string, string> = {
  CIN: 'CIN',
  PASSEPORT: 'Passeport',
  SEJOUR: 'Titre de séjour',
  AUTRE: 'Autre',
};

// CH-007 (docs/governance/REGISTRE_CHANTIERS.md) — donne une vraie
// visibilité réception sur F6 (self-checkin), jusqu'ici entièrement
// invisible côté frontend malgré un backend fonctionnel. Pas de nouvelle
// route : réutilise POST .../self-checkin-link et
// GET .../self-checkin-pending tels quels (voir CLAUDE.md, ce dernier est
// déjà consommé côté Police pour le pré-remplissage, mais jamais affiché
// tel quel avant l'arrivée du client).
export function SelfCheckinPanel({ reservationId, guestEmail }: Props) {
  const [pending, setPending] = useState<SelfCheckinPending | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [link, setLink] = useState<SelfCheckinLink | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setPending(await getSelfCheckinPending(reservationId));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleGenerate() {
    setGenerating(true);
    setLinkError(null);
    setCopied(false);
    try {
      setLink(await generateSelfCheckinLink(reservationId));
      // La régénération réécrit la même ligne SelfCheckinToken et efface
      // toute soumission précédente côté backend (self-checkin.service.ts,
      // generateLink) — refléter immédiatement, sans attendre un rechargement.
      setPending(null);
    } catch (err) {
      setLinkError(
        err instanceof Error ? err.message : 'Erreur de génération du lien',
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link.url);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Self check-in</p>
        {!loading &&
          (pending ? (
            <Badge variant="success">Informations soumises</Badge>
          ) : (
            <Badge variant="secondary">En attente</Badge>
          ))}
      </div>

      {loadError && <p className="text-destructive text-sm">{loadError}</p>}

      {!guestEmail && (
        <p className="text-amber-600 text-xs">
          Ce client n'a pas d'adresse email enregistrée — le lien ne pourra pas
          être envoyé automatiquement, à transmettre manuellement (copier le
          lien).
        </p>
      )}

      {!loading && pending && (
        <ul className="text-muted-foreground flex flex-col gap-0.5 text-xs">
          <li>
            Pièce : {pending.numeroPiece ?? '—'}
            {pending.typePiece
              ? ` (${TYPE_PIECE_LABEL[pending.typePiece]})`
              : ''}
          </li>
          <li>Naissance : {pending.dateNaissance?.slice(0, 10) ?? '—'}</li>
          {(pending.paysProvenance || pending.villeProvenance) && (
            <li>
              Provenance :{' '}
              {[pending.villeProvenance, pending.paysProvenance]
                .filter(Boolean)
                .join(', ')}
            </li>
          )}
          {(pending.paysDestination || pending.villeDestination) && (
            <li>
              Destination :{' '}
              {[pending.villeDestination, pending.paysDestination]
                .filter(Boolean)
                .join(', ')}
            </li>
          )}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating
            ? 'Génération…'
            : pending
              ? 'Régénérer le lien (efface les données soumises)'
              : link
                ? 'Régénérer le lien'
                : 'Générer le lien'}
        </Button>
        {link && (
          <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? 'Copié !' : 'Copier le lien'}
          </Button>
        )}
      </div>

      {linkError && <p className="text-destructive text-sm">{linkError}</p>}

      {link && (
        <p className="text-muted-foreground truncate text-xs">
          {link.url} — expire le{' '}
          {new Date(link.expiresAt).toLocaleString('fr-FR')}
        </p>
      )}

      <p className="text-muted-foreground text-xs">
        Un email est automatiquement envoyé au client à la génération du lien
        (si une adresse est renseignée).
      </p>
    </div>
  );
}
