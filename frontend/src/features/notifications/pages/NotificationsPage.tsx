import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

type Section = 'templates' | 'journal';

const EVENEMENT_LABEL: Record<EvenementNotification, string> = {
  RESERVATION_CONFIRMEE: 'Réservation confirmée',
  RAPPEL_J_MOINS_1: 'Rappel J-1',
  POST_SEJOUR: 'Post-séjour',
  SELF_CHECKIN_LIEN: 'Lien self check-in',
};

const CANAL_LABEL: Record<CanalNotification, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
};

const STATUT_BADGE: Record<
  StatutNotification,
  {
    label: string;
    variant: 'success' | 'destructive' | 'secondary' | 'warning';
  }
> = {
  ENVOYE: { label: 'Envoyé', variant: 'success' },
  ECHEC: { label: 'Échec', variant: 'destructive' },
  IGNORE: { label: 'Ignoré', variant: 'secondary' },
  EN_ATTENTE: { label: 'En attente', variant: 'warning' },
};

const TEXTAREA_CLASS =
  'border-input focus-visible:ring-ring/50 focus-visible:border-ring w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3';

// CH-008 (F7 gestion) — NotificationTemplate/NotificationLog étaient
// pleinement fonctionnels côté backend (F7) sans aucune UI de gestion : les
// templates ne pouvaient être modifiés qu'en base directement. Réservé à
// notifications:write (Administrateur) pour l'écriture, notifications:read
// (Réception incluse) pour la consultation — même logique que parameters.
export function NotificationsPage() {
  const [section, setSection] = useState<Section>('templates');

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex gap-1 border-b pb-2">
        <Button
          variant={section === 'templates' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSection('templates')}
        >
          Templates
        </Button>
        <Button
          variant={section === 'journal' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSection('journal')}
        >
          Journal d'envoi
        </Button>
      </div>

      {section === 'templates' && <TemplatesSection />}
      {section === 'journal' && <JournalSection />}
    </div>
  );
}

interface Draft {
  sujet: string;
  corps: string;
  actif: boolean;
}

function TemplatesSection() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [motifs, setMotifs] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listTemplates();
      setTemplates(data);
      setDrafts(
        Object.fromEntries(
          data.map((t) => [
            t.id,
            { sujet: t.sujet ?? '', corps: t.corps, actif: t.actif },
          ]),
        ),
      );
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

  async function handleSave(id: number, template: NotificationTemplate) {
    const draft = drafts[id];
    const motif = motifs[id] ?? '';
    if (!draft || motif.length < 10) return;
    setSavingId(id);
    setRowError(null);
    try {
      await updateTemplate(id, {
        sujet:
          template.canal === 'EMAIL' ? draft.sujet || undefined : undefined,
        corps: draft.corps,
        actif: draft.actif,
        motif,
      });
      setMotifs({ ...motifs, [id]: '' });
      await refetch();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSavingId(null);
    }
  }

  async function handleCreate(input: CreateNotificationTemplateInput) {
    setFormError(null);
    setSubmitting(true);
    try {
      await createTemplate(input);
      setDialogOpen(false);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return <p className="text-muted-foreground text-sm">Chargement…</p>;
  if (loadError) return <p className="text-destructive text-sm">{loadError}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground max-w-lg text-sm">
          Un template par (évènement, canal) — le contenu ({'{{'}placeholder
          {'}}'}) est substitué à l'envoi. Une modification s'applique dès le
          prochain envoi, sans déploiement.
        </p>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          + Nouveau template
        </Button>
      </div>

      {rowError && <p className="text-destructive text-sm">{rowError}</p>}

      {templates.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun template configuré.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((t) => {
            const draft = drafts[t.id] ?? {
              sujet: t.sujet ?? '',
              corps: t.corps,
              actif: t.actif,
            };
            const motif = motifs[t.id] ?? '';
            const unchanged =
              draft.sujet === (t.sujet ?? '') &&
              draft.corps === t.corps &&
              draft.actif === t.actif;

            return (
              <div
                key={t.id}
                className="flex flex-col gap-2 rounded-md border p-3"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {EVENEMENT_LABEL[t.evenement]} — {CANAL_LABEL[t.canal]}
                  </p>
                  <Badge variant={draft.actif ? 'success' : 'secondary'}>
                    {draft.actif ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>

                {t.canal === 'EMAIL' && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`sujet-${t.id}`}>Sujet</Label>
                    <Input
                      id={`sujet-${t.id}`}
                      value={draft.sujet}
                      onChange={(e) =>
                        setDrafts({
                          ...drafts,
                          [t.id]: { ...draft, sujet: e.target.value },
                        })
                      }
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`corps-${t.id}`}>Corps</Label>
                  <textarea
                    id={`corps-${t.id}`}
                    value={draft.corps}
                    onChange={(e) =>
                      setDrafts({
                        ...drafts,
                        [t.id]: { ...draft, corps: e.target.value },
                      })
                    }
                    rows={3}
                    className={TEXTAREA_CLASS}
                  />
                </div>

                <label className="flex w-fit items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.actif}
                    onChange={(e) =>
                      setDrafts({
                        ...drafts,
                        [t.id]: { ...draft, actif: e.target.checked },
                      })
                    }
                  />
                  Actif
                </label>

                {!unchanged && (
                  <Input
                    value={motif}
                    onChange={(e) =>
                      setMotifs({ ...motifs, [t.id]: e.target.value })
                    }
                    placeholder="Motif de la modification (≥ 10 caractères)"
                  />
                )}

                <Button
                  size="sm"
                  className="w-fit"
                  disabled={savingId === t.id || unchanged || motif.length < 10}
                  onClick={() => handleSave(t.id, t)}
                >
                  {savingId === t.id ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </div>
            );
          })}
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

function JournalSection() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listLogs()
      .then(setLogs)
      .catch((err: unknown) =>
        setLoadError(
          err instanceof Error ? err.message : 'Erreur de chargement',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <p className="text-muted-foreground text-sm">Chargement…</p>;
  if (loadError) return <p className="text-destructive text-sm">{loadError}</p>;
  if (logs.length === 0)
    return (
      <p className="text-muted-foreground text-sm">Aucun envoi enregistré.</p>
    );

  return (
    <div className="flex flex-col gap-2">
      {logs.map((log) => {
        const badge = STATUT_BADGE[log.statut];
        return (
          <div
            key={log.id}
            className="flex items-center justify-between gap-3 rounded-md border p-3"
          >
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">
                {EVENEMENT_LABEL[log.evenement]} — {CANAL_LABEL[log.canal]}
              </p>
              <p className="text-muted-foreground text-xs">
                {log.destinataire || '—'} ·{' '}
                {new Date(log.createdAt).toLocaleString('fr-FR')}
                {log.erreur && ` · ${log.erreur}`}
              </p>
            </div>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
        );
      })}
    </div>
  );
}
