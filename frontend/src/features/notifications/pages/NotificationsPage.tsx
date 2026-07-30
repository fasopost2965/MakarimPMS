import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createTemplate,
  listLogs,
  listTemplates,
  updateTemplate,
} from '../api';
import type {
  CanalNotification,
  CreateNotificationTemplateInput,
  EvenementNotification,
  NotificationLog,
  NotificationTemplate,
  StatutNotification,
} from '../types';

const EVENEMENT_LABEL: Record<EvenementNotification, string> = {
  RESERVATION_CONFIRMEE: 'Réservation confirmée',
  RAPPEL_J_MOINS_1: 'Rappel J-1',
  POST_SEJOUR: 'Post-séjour',
  SELF_CHECKIN_LIEN: 'Lien self check-in',
  FACTURE_EMISE: 'Facture émise',
};

const CANAL_LABEL: Record<CanalNotification, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
};

const STATUT_BADGE: Record<
  StatutNotification,
  { label: string; variant: 'success' | 'destructive' | 'outline' | 'warning' }
> = {
  ENVOYE: { label: 'Envoyé', variant: 'success' },
  ECHEC: { label: 'Échec', variant: 'destructive' },
  IGNORE: { label: 'Ignoré', variant: 'outline' },
  EN_ATTENTE: { label: 'En attente', variant: 'warning' },
};

const TEXTAREA_CLASS =
  'border-input focus-visible:ring-ring/50 focus-visible:border-ring w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3';

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// CH-008 (F7 gestion ; refonte visuelle batch 3 design handoff,
// Notifications.dc.html) — NotificationTemplate/NotificationLog étaient
// pleinement fonctionnels côté backend (F7) sans aucune UI de gestion : les
// templates ne pouvaient être modifiés qu'en base directement. Réservé à
// notifications:write (Administrateur) pour l'écriture, notifications:read
// (Réception incluse) pour la consultation — même logique que parameters.
// Page unique à sections empilées (KPI, Modèles, Journal), remplace l'ancien
// commutateur Templates/Journal.
export function NotificationsPage() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [t, l] = await Promise.all([listTemplates(), listLogs()]);
      setTemplates(t);
      setLogs(l);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  const kpi = useMemo(() => {
    const logsToday = logs.filter((l) => isToday(l.createdAt));
    return {
      actifs: templates.filter((t) => t.actif).length,
      total: templates.length,
      envoyes: logsToday.filter((l) => l.statut === 'ENVOYE').length,
      echecs: logsToday.filter((l) => l.statut === 'ECHEC').length,
      ignores: logsToday.filter((l) => l.statut === 'IGNORE').length,
    };
  }, [templates, logs]);

  if (loading)
    return <p className="text-muted-foreground p-6 text-sm">Chargement…</p>;
  if (loadError)
    return <p className="text-destructive p-6 text-sm">{loadError}</p>;

  return (
    <div className="flex h-full flex-col gap-5 overflow-auto p-6">
      <div className="grid grid-cols-4 gap-3">
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <span className="text-muted-foreground text-[10.5px] font-bold tracking-wide uppercase">
            Modèles actifs
          </span>
          <span className="text-2xl font-bold tracking-tight">
            {kpi.actifs} / {kpi.total}
          </span>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <span className="text-muted-foreground text-[10.5px] font-bold tracking-wide uppercase">
            Envoyés aujourd'hui
          </span>
          <span className="text-success text-2xl font-bold tracking-tight">
            {kpi.envoyes}
          </span>
        </div>
        <div
          className={`flex flex-col gap-2 rounded-lg border p-4 ${
            kpi.echecs > 0 ? 'border-destructive/40' : ''
          }`}
        >
          <span
            className={`text-[10.5px] font-bold tracking-wide uppercase ${
              kpi.echecs > 0 ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            Échecs aujourd'hui
          </span>
          <span
            className={`text-2xl font-bold tracking-tight ${
              kpi.echecs > 0 ? 'text-destructive' : ''
            }`}
          >
            {kpi.echecs}
          </span>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <span className="text-muted-foreground text-[10.5px] font-bold tracking-wide uppercase">
            Ignorés aujourd'hui
          </span>
          <span className="text-2xl font-bold tracking-tight">
            {kpi.ignores}
          </span>
        </div>
      </div>

      <TemplatesSection templates={templates} onRefetch={refetch} />
      <JournalSection logs={logs} />
    </div>
  );
}

interface Draft {
  sujet: string;
  corps: string;
  actif: boolean;
}

interface TemplatesSectionProps {
  templates: NotificationTemplate[];
  onRefetch: () => Promise<void>;
}

function TemplatesSection({ templates, onRefetch }: TemplatesSectionProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [motif, setMotif] = useState('');
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const editingTemplate = templates.find((t) => t.id === editingId) ?? null;

  function startEditing(t: NotificationTemplate) {
    setEditingId(t.id);
    setDraft({ sujet: t.sujet ?? '', corps: t.corps, actif: t.actif });
    setMotif('');
    setRowError(null);
  }

  async function handleSave() {
    if (!editingTemplate || !draft || motif.length < 10) return;
    setSaving(true);
    setRowError(null);
    try {
      await updateTemplate(editingTemplate.id, {
        sujet:
          editingTemplate.canal === 'EMAIL'
            ? draft.sujet || undefined
            : undefined,
        corps: draft.corps,
        actif: draft.actif,
        motif,
      });
      setEditingId(null);
      setDraft(null);
      setMotif('');
      await onRefetch();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate(input: CreateNotificationTemplateInput) {
    setFormError(null);
    setSubmitting(true);
    try {
      await createTemplate(input);
      setDialogOpen(false);
      await onRefetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b px-4.5 py-3.5">
        <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
          Modèles de message — un par événement × canal
        </span>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          + Nouveau template
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="bg-muted/60 text-muted-foreground grid min-w-[680px] grid-cols-[190px_100px_1fr_80px_100px] gap-2 px-4.5 py-2 text-[11px] font-bold">
          <span>Événement</span>
          <span>Canal</span>
          <span>Sujet</span>
          <span>Actif</span>
          <span className="text-right">Action</span>
        </div>
        {templates.length === 0 ? (
          <p className="text-muted-foreground px-4.5 py-3 text-sm">
            Aucun template configuré.
          </p>
        ) : (
          templates.map((t) => (
            <div
              key={t.id}
              className={`grid min-w-[680px] grid-cols-[190px_100px_1fr_80px_100px] items-center gap-2 border-t px-4.5 py-2.5 text-sm ${
                editingId === t.id ? 'bg-primary/5' : ''
              }`}
            >
              <span>{EVENEMENT_LABEL[t.evenement]}</span>
              <span className="text-muted-foreground text-xs">
                {CANAL_LABEL[t.canal]}
              </span>
              <span className="text-muted-foreground truncate text-xs">
                {t.sujet || '—'}
              </span>
              <Badge
                variant={t.actif ? 'success' : 'outline'}
                className="w-fit"
              >
                {t.actif ? 'Oui' : 'Non'}
              </Badge>
              <button
                type="button"
                className="text-primary text-right text-xs font-semibold hover:underline"
                onClick={() => startEditing(t)}
              >
                Modifier{editingId === t.id ? ' ▾' : ''}
              </button>
            </div>
          ))
        )}
      </div>

      {editingTemplate && draft && (
        <div className="bg-muted/40 flex flex-col gap-2.5 border-t p-4.5">
          <span className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
            Modifier — {EVENEMENT_LABEL[editingTemplate.evenement]} (
            {CANAL_LABEL[editingTemplate.canal]})
          </span>

          {editingTemplate.canal === 'EMAIL' && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="editSujet" className="text-xs font-normal">
                Sujet
              </Label>
              <Input
                id="editSujet"
                value={draft.sujet}
                onChange={(e) => setDraft({ ...draft, sujet: e.target.value })}
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label htmlFor="editCorps" className="text-xs font-normal">
              Corps du message
            </Label>
            <textarea
              id="editCorps"
              value={draft.corps}
              onChange={(e) => setDraft({ ...draft, corps: e.target.value })}
              rows={3}
              className={TEXTAREA_CLASS}
            />
          </div>

          <div className="grid grid-cols-[1fr_2fr_auto] items-end gap-2.5">
            <label className="flex items-center gap-2 pt-5 text-sm">
              <input
                type="checkbox"
                checked={draft.actif}
                onChange={(e) =>
                  setDraft({ ...draft, actif: e.target.checked })
                }
              />
              Modèle actif
            </label>
            <div className="flex flex-col gap-1">
              <Label htmlFor="editMotif" className="text-xs font-normal">
                Motif (≥ 10 caractères, obligatoire)
              </Label>
              <Input
                id="editMotif"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex. Ajout du lien direct pour réduire les appels réception"
              />
            </div>
            <Button
              size="sm"
              disabled={saving || motif.length < 10}
              onClick={() => void handleSave()}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
          {rowError && <p className="text-destructive text-sm">{rowError}</p>}
          <p className="text-muted-foreground text-[11px]">
            L'événement et le canal restent immuables une fois le modèle créé —
            seuls sujet, corps et activation peuvent être modifiés, avec motif
            tracé dans l'audit.
          </p>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => !next && setDialogOpen(false)}
      >
        <DialogContent>
          {dialogOpen && (
            <CreateTemplateForm
              onClose={() => setDialogOpen(false)}
              onConfirm={handleCreate}
              submitting={submitting}
              error={formError}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CreateTemplateFormProps {
  onClose: () => void;
  onConfirm: (input: CreateNotificationTemplateInput) => void;
  submitting: boolean;
  error: string | null;
}

function CreateTemplateForm({
  onClose,
  onConfirm,
  submitting,
  error,
}: CreateTemplateFormProps) {
  const [evenement, setEvenement] = useState<EvenementNotification>(
    'RESERVATION_CONFIRMEE',
  );
  const [canal, setCanal] = useState<CanalNotification>('EMAIL');
  const [sujet, setSujet] = useState('');
  const [corps, setCorps] = useState('');
  const [motif, setMotif] = useState('');

  const canSubmit = corps.trim().length > 0 && motif.length >= 10;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nouveau template</DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          onConfirm({
            evenement,
            canal,
            sujet: canal === 'EMAIL' ? sujet || undefined : undefined,
            corps,
            motif,
          });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="evenement">Évènement</Label>
          <Select
            value={evenement}
            onValueChange={(v) => v && setEvenement(v as EvenementNotification)}
            items={Object.entries(EVENEMENT_LABEL).map(([value, label]) => ({
              value,
              label,
            }))}
          >
            <SelectTrigger id="evenement" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EVENEMENT_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="canal">Canal</Label>
          <Select
            value={canal}
            onValueChange={(v) => v && setCanal(v as CanalNotification)}
            items={Object.entries(CANAL_LABEL).map(([value, label]) => ({
              value,
              label,
            }))}
          >
            <SelectTrigger id="canal" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CANAL_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canal === 'EMAIL' && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sujet">Sujet</Label>
            <Input
              id="sujet"
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              placeholder="Ex. Confirmation de votre réservation"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="corps">Corps</Label>
          <textarea
            id="corps"
            value={corps}
            onChange={(e) => setCorps(e.target.value)}
            rows={4}
            required
            placeholder="Ex. Bonjour {{prenom}}, votre réservation est confirmée…"
            className={TEXTAREA_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="motif">Motif (≥ 10 caractères)</Label>
          <Input
            id="motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. Activation du canal SMS pour les rappels J-1"
            required
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? 'Création…' : 'Créer'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function JournalSection({ logs }: { logs: NotificationLog[] }) {
  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <div className="border-b px-4.5 py-3.5">
        <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
          Journal d'envoi
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="bg-muted/60 text-muted-foreground grid min-w-[700px] grid-cols-[130px_170px_90px_1fr_100px] gap-2 px-4.5 py-2 text-[11px] font-bold">
          <span>Horodatage</span>
          <span>Événement</span>
          <span>Canal</span>
          <span>Destinataire</span>
          <span>Statut</span>
        </div>
        {logs.length === 0 ? (
          <p className="text-muted-foreground px-4.5 py-3 text-sm">
            Aucun envoi enregistré.
          </p>
        ) : (
          logs.map((log) => {
            const badge = STATUT_BADGE[log.statut];
            return (
              <div
                key={log.id}
                className="grid min-w-[700px] grid-cols-[130px_170px_90px_1fr_100px] items-center gap-2 border-t px-4.5 py-2.5 text-sm"
              >
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString('fr-FR')}
                </span>
                <span>{EVENEMENT_LABEL[log.evenement]}</span>
                <span className="text-muted-foreground text-xs">
                  {CANAL_LABEL[log.canal]}
                </span>
                <span className="truncate">{log.destinataire || '—'}</span>
                <Badge variant={badge.variant} className="w-fit">
                  {badge.label}
                </Badge>
              </div>
            );
          })
        )}
      </div>
      <p className="text-muted-foreground px-4.5 py-3 text-[11px]">
        "Ignoré" couvre le consentement refusé, le modèle inactif ou l'absence
        de destinataire — journal en ajout seul, jamais modifié après coup.
      </p>
    </div>
  );
}
