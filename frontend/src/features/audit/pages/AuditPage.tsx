import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { searchAuditLogs } from '../api';
import type { AuditAction, AuditEntity, AuditLogEntry } from '../types';

// CH-015 (docs/governance/REGISTRE_CHANTIERS.md) — le backend (GET
// /audit-logs, AuditController) existait déjà et était pleinement
// fonctionnel ; seule cette interface manquait. Purement consultatif —
// AuditService est append-only (INV-AUD-001), aucune action d'écriture
// n'est exposée ici.
const ENTITES: AuditEntity[] = [
  'Guest',
  'Reservation',
  'Stay',
  'Room',
  'Payment',
  'Invoice',
  'HotelConfig',
  'TaxRateConfig',
  'SeasonRate',
  'TimeShift',
  'PaySlip',
  'POLICE_RECORD',
  'RESERVATION_DEPOSIT',
  'Folio',
  'CancellationPolicy',
  'RateRestriction',
  'NotificationTemplate',
  'ChannelRoomTypeMapping',
];

const ACTIONS: AuditAction[] = [
  'CHANGE_CATEGORY',
  'BLACKLIST_CLIENT',
  'UPDATE_PRICE',
  'CANCEL_RESERVATION',
  'UPDATE_HOTEL_CONFIG',
  'UPDATE_TAX_RATE',
  'CREATE_TAX_RATE',
  'CREATE_SEASON_RATE',
  'UPDATE_SEASON_RATE',
  'DELETE_SEASON_RATE',
  'ADJUST_TIME_SHIFT',
  'INVALIDATE_TIME_SHIFT',
  'AUTO_CLOSE_TIME_SHIFT',
  'VALIDATE_PAYSLIP',
  'CREATE_POLICE_RECORD',
  'CREATE_DEPOSIT',
  'IMPUTE_DEPOSIT',
  'REFUND_DEPOSIT',
  'EXCLUDE_FOLIO_TAX',
  'CREATE_CANCELLATION_POLICY',
  'UPDATE_CANCELLATION_POLICY',
  'MARK_NO_SHOW',
  'CREATE_RATE_RESTRICTION',
  'UPDATE_RATE_RESTRICTION',
  'DELETE_RATE_RESTRICTION',
  'CREATE_NOTIFICATION_TEMPLATE',
  'UPDATE_NOTIFICATION_TEMPLATE',
  'CREATE_CHANNEL_ROOM_TYPE_MAPPING',
  'DELETE_CHANNEL_ROOM_TYPE_MAPPING',
  'CREATE_CREDIT_NOTE',
  'FORCE_CHECKOUT',
];

// Sentinelle : base-ui Select n'accepte pas une valeur vide comme option
// "Toutes" — traduite en `undefined` (pas de filtre) avant l'appel API.
const ALL = '__ALL__';

export function AuditPage() {
  const [entite, setEntite] = useState<string>(ALL);
  const [action, setAction] = useState<string>(ALL);
  const [userId, setUserId] = useState('');
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    try {
      setEntries(
        await searchAuditLogs({
          entite: entite === ALL ? undefined : (entite as AuditEntity),
          action: action === ALL ? undefined : (action as AuditAction),
          userId: userId ? Number(userId) : undefined,
          du: du || undefined,
          au: au || undefined,
        }),
      );
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de recherche');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setEntite(ALL);
    setAction(ALL);
    setUserId('');
    setDu('');
    setAu('');
    setEntries([]);
    setSearched(false);
    setError(null);
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <p className="text-muted-foreground text-sm">
        Registre d'audit append-only — consultation seule, aucune modification
        possible depuis cet écran.
      </p>

      <div className="grid grid-cols-2 gap-3 rounded-md border p-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="flex flex-col gap-1.5">
          <Label>Entité</Label>
          <Select
            value={entite}
            onValueChange={(v) => v && setEntite(v)}
            items={[
              { value: ALL, label: 'Toutes' },
              ...ENTITES.map((e) => ({ value: e, label: e })),
            ]}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes</SelectItem>
              {ENTITES.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Action</Label>
          <Select
            value={action}
            onValueChange={(v) => v && setAction(v)}
            items={[
              { value: ALL, label: 'Toutes' },
              ...ACTIONS.map((a) => ({ value: a, label: a })),
            ]}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes</SelectItem>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-userid">Utilisateur (ID)</Label>
          <Input
            id="audit-userid"
            type="number"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-du">Du</Label>
          <Input
            id="audit-du"
            type="date"
            value={du}
            onChange={(e) => setDu(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-au">Au</Label>
          <Input
            id="audit-au"
            type="date"
            value={au}
            onChange={(e) => setAu(e.target.value)}
          />
        </div>

        <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-5">
          <Button size="sm" disabled={loading} onClick={handleSearch}>
            {loading ? 'Recherche…' : 'Rechercher'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={handleReset}
          >
            Réinitialiser
          </Button>
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {searched && !loading && entries.length === 0 && !error && (
        <p className="text-muted-foreground text-sm">
          Aucune entrée pour ces critères.
        </p>
      )}

      {entries.length > 0 && (
        <div className="flex flex-1 flex-col gap-2 overflow-auto">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{entry.action}</Badge>
                  <span className="text-muted-foreground text-xs">
                    {entry.targetEntity} #{entry.targetId}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {entry.userId !== null
                      ? `Utilisateur #${entry.userId}`
                      : 'Système'}
                  </span>
                </div>
                <span className="text-muted-foreground text-xs">
                  {new Date(entry.createdAt).toLocaleString('fr-FR')}
                </span>
              </div>
              <p className="mt-1">{entry.motif}</p>
              {(entry.oldValue !== null || entry.newValue !== null) && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto p-0 text-xs"
                  onClick={() =>
                    setExpandedId(expandedId === entry.id ? null : entry.id)
                  }
                >
                  {expandedId === entry.id
                    ? 'Masquer le détail'
                    : 'Voir le détail'}
                </Button>
              )}
              {expandedId === entry.id && (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">
                      Avant
                    </p>
                    <pre className="bg-muted overflow-x-auto rounded p-2 text-xs">
                      {JSON.stringify(entry.oldValue, null, 2) ?? '—'}
                    </pre>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">
                      Après
                    </p>
                    <pre className="bg-muted overflow-x-auto rounded p-2 text-xs">
                      {JSON.stringify(entry.newValue, null, 2) ?? '—'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
