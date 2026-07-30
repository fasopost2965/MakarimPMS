import { useEffect, useMemo, useState } from 'react';
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
import { DiffViewer } from '@/components/ui/diff-viewer';
import { searchAuditLogs } from '../api';
import type { AuditAction, AuditEntity, AuditLogEntry } from '../types';

// CH-015 (docs/governance/REGISTRE_CHANTIERS.md ; refonte visuelle batch 3
// design handoff, Audit.dc.html) — le backend (GET /audit-logs,
// AuditController) existait déjà et était pleinement fonctionnel ; seule
// cette interface manquait. Purement consultatif — AuditService est
// append-only (INV-AUD-001), aucune action d'écriture n'est exposée ici.
// KPI et table denses calculées côté client depuis les résultats déjà
// chargés (jamais un second appel réseau) — "Utilisateur (Admin/RH/…)" du
// mockup n'est pas affiché : AuditLogEntry n'expose que `userId` (pas de
// jointure vers un nom/rôle), afficher un rôle inventé serait fabriqué.
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

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AuditPage() {
  const [entite, setEntite] = useState<string>(ALL);
  const [action, setAction] = useState<string>(ALL);
  const [userId, setUserId] = useState('');
  const [du, setDu] = useState(firstOfMonth());
  const [au, setAu] = useState(today());
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleReset() {
    setEntite(ALL);
    setAction(ALL);
    setUserId('');
    setDu(firstOfMonth());
    setAu(today());
    setEntries([]);
    setSearched(false);
    setError(null);
  }

  const kpi = useMemo(() => {
    const utilisateurs = new Set(
      entries.filter((e) => e.userId !== null).map((e) => e.userId),
    );
    const blacklist = entries.filter(
      (e) => e.action === 'BLACKLIST_CLIENT',
    ).length;
    const derniere = entries[0]?.createdAt ?? null;
    return {
      total: entries.length,
      utilisateurs: utilisateurs.size,
      blacklist,
      derniere,
    };
  }, [entries]);

  const expandedEntry = entries.find((e) => e.id === expandedId) ?? null;

  return (
    <div className="flex h-full flex-col gap-5 overflow-auto p-6">
      <div className="grid grid-cols-4 gap-3">
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <span className="text-muted-foreground text-[10.5px] font-bold tracking-wide uppercase">
            Entrées (période)
          </span>
          <span className="text-2xl font-bold tracking-tight">{kpi.total}</span>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <span className="text-muted-foreground text-[10.5px] font-bold tracking-wide uppercase">
            Utilisateurs distincts
          </span>
          <span className="text-2xl font-bold tracking-tight">
            {kpi.utilisateurs}
          </span>
        </div>
        <div
          className={`flex flex-col gap-2 rounded-lg border p-4 ${
            kpi.blacklist > 0 ? 'border-warning/50' : ''
          }`}
        >
          <span
            className={`text-[10.5px] font-bold tracking-wide uppercase ${
              kpi.blacklist > 0 ? 'text-warning' : 'text-muted-foreground'
            }`}
          >
            Changements Blacklist
          </span>
          <span
            className={`text-2xl font-bold tracking-tight ${
              kpi.blacklist > 0 ? 'text-warning' : ''
            }`}
          >
            {kpi.blacklist}
          </span>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <span className="text-muted-foreground text-[10.5px] font-bold tracking-wide uppercase">
            Dernière entrée
          </span>
          <span className="text-2xl font-bold tracking-tight">
            {kpi.derniere
              ? new Date(kpi.derniere).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </span>
        </div>
      </div>

      <div className="bg-card flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="audit-entite" className="text-xs font-normal">
            Entité
          </Label>
          <Select
            value={entite}
            onValueChange={(v) => v && setEntite(v)}
            items={[
              { value: ALL, label: 'Toutes' },
              ...ENTITES.map((e) => ({ value: e, label: e })),
            ]}
          >
            <SelectTrigger id="audit-entite" className="w-40">
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

        <div className="flex flex-col gap-1">
          <Label htmlFor="audit-action" className="text-xs font-normal">
            Action
          </Label>
          <Select
            value={action}
            onValueChange={(v) => v && setAction(v)}
            items={[
              { value: ALL, label: 'Toutes' },
              ...ACTIONS.map((a) => ({ value: a, label: a })),
            ]}
          >
            <SelectTrigger id="audit-action" className="w-48">
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

        <div className="flex flex-col gap-1">
          <Label htmlFor="audit-userid" className="text-xs font-normal">
            Utilisateur (ID)
          </Label>
          <Input
            id="audit-userid"
            type="number"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-28"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="audit-du" className="text-xs font-normal">
            Du
          </Label>
          <Input
            id="audit-du"
            type="date"
            value={du}
            onChange={(e) => setDu(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="audit-au" className="text-xs font-normal">
            Au
          </Label>
          <Input
            id="audit-au"
            type="date"
            value={au}
            onChange={(e) => setAu(e.target.value)}
          />
        </div>

        <Button
          size="sm"
          disabled={loading}
          onClick={() => void handleSearch()}
        >
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

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="bg-card overflow-hidden rounded-lg border">
        <div className="border-b px-4.5 py-3.5">
          <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
            Registre d'audit — append-only
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="bg-muted/60 text-muted-foreground grid min-w-[840px] grid-cols-[130px_100px_170px_130px_70px_1fr_90px] gap-2 px-4.5 py-2 text-[11px] font-bold">
            <span>Horodatage</span>
            <span>Utilisateur</span>
            <span>Action</span>
            <span>Entité</span>
            <span>ID</span>
            <span>Motif</span>
            <span className="text-right">Détail</span>
          </div>
          {searched && !loading && entries.length === 0 && !error ? (
            <p className="text-muted-foreground px-4.5 py-3 text-sm">
              Aucune entrée pour ces critères.
            </p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className={`grid min-w-[840px] grid-cols-[130px_100px_170px_130px_70px_1fr_90px] items-center gap-2 border-t px-4.5 py-2.5 text-sm ${
                  entry.action === 'BLACKLIST_CLIENT' ? 'bg-warning/5' : ''
                } ${expandedId === entry.id ? 'bg-primary/5' : ''}`}
              >
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-xs">
                  {entry.userId !== null ? `#${entry.userId}` : 'Système'}
                </span>
                <Badge variant="outline" className="w-fit">
                  {entry.action}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {entry.targetEntity} #{entry.targetId}
                </span>
                <span className="text-muted-foreground text-xs">
                  {entry.targetId}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {entry.motif}
                </span>
                {entry.oldValue !== null || entry.newValue !== null ? (
                  <button
                    type="button"
                    className="text-primary text-right text-xs font-semibold hover:underline"
                    onClick={() =>
                      setExpandedId(expandedId === entry.id ? null : entry.id)
                    }
                  >
                    Voir diff{expandedId === entry.id ? ' ▾' : ''}
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))
          )}
        </div>

        {expandedEntry && (
          <div className="bg-muted/40 flex flex-col gap-2 border-t p-4.5">
            <span className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
              Détail — {expandedEntry.action} sur {expandedEntry.targetEntity} #
              {expandedEntry.targetId}
            </span>
            <DiffViewer
              before={expandedEntry.oldValue}
              after={expandedEntry.newValue}
            />
          </div>
        )}
      </div>
    </div>
  );
}
