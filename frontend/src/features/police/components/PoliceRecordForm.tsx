import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  downloadPoliceRecordPdf,
  getPoliceRecord,
  getSelfCheckinPending,
  upsertPoliceRecord,
} from '../api';
import type { PoliceRecord, TypePiece } from '../types';

const TYPE_PIECE_LABEL: Record<TypePiece, string> = {
  CIN: 'CIN',
  PASSEPORT: 'Passeport',
  SEJOUR: 'Titre de séjour',
  AUTRE: 'Autre',
};

interface Props {
  stayId: number;
  reservationId: number | null;
  onSaved?: () => void;
}

interface FormState {
  numeroPiece: string;
  typePiece: TypePiece | '';
  nationalite: string;
  dateNaissance: string;
  paysProvenance: string;
  villeProvenance: string;
  paysDestination: string;
  villeDestination: string;
}

const EMPTY_FORM: FormState = {
  numeroPiece: '',
  typePiece: '',
  nationalite: '',
  dateNaissance: '',
  paysProvenance: '',
  villeProvenance: '',
  paysDestination: '',
  villeDestination: '',
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const REQUIRED_FIELD_LABEL: Record<string, string> = {
  numeroPiece: 'Le numéro de pièce',
  typePiece: 'Le type de pièce',
  nationalite: 'La nationalité',
  dateNaissance: 'La date de naissance',
};

function validateForm(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of Object.keys(
    REQUIRED_FIELD_LABEL,
  ) as (keyof FormState)[]) {
    if (!form[field]) {
      errors[field] = `${REQUIRED_FIELD_LABEL[field]} est obligatoire.`;
    }
  }
  return errors;
}

function formFromRecord(record: PoliceRecord): FormState {
  return {
    numeroPiece: record.numeroPiece,
    typePiece: record.typePiece,
    nationalite: record.nationalite,
    dateNaissance: record.dateNaissance.slice(0, 10),
    paysProvenance: record.paysProvenance ?? '',
    villeProvenance: record.villeProvenance ?? '',
    paysDestination: record.paysDestination ?? '',
    villeDestination: record.villeDestination ?? '',
  };
}

// CH-003 (docs/governance/REGISTRE_CHANTIERS.md) — permet la saisie réelle
// du registre légal de police (obligation DGSN) depuis l'interface. Une
// seule route POST fait à la fois création et mise à jour (contrainte
// @unique(stayId) côté backend), donc ce composant n'a pas de distinction
// explicite "créer" vs "modifier" au niveau de l'appel — seulement au niveau
// de l'affichage (bouton, message).
export function PoliceRecordForm({ stayId, reservationId, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<PoliceRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [prefilledFromSelfCheckin, setPrefilledFromSelfCheckin] =
    useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const existing = await getPoliceRecord(stayId);
      if (existing) {
        setRecord(existing);
        setForm(formFromRecord(existing));
        setPrefilledFromSelfCheckin(false);
        return;
      }

      setRecord(null);
      // Pré-remplissage F6 uniquement quand rien n'a encore été saisi côté
      // réception, et seulement pour un séjour issu d'une réservation (un
      // walk-in n'a jamais de lien self check-in).
      if (reservationId !== null) {
        const pending = await getSelfCheckinPending(reservationId);
        if (pending) {
          setForm({
            numeroPiece: pending.numeroPiece ?? '',
            typePiece: pending.typePiece ?? '',
            nationalite: '',
            dateNaissance: pending.dateNaissance?.slice(0, 10) ?? '',
            paysProvenance: pending.paysProvenance ?? '',
            villeProvenance: pending.villeProvenance ?? '',
            paysDestination: pending.paysDestination ?? '',
            villeDestination: pending.villeDestination ?? '',
          });
          setPrefilledFromSelfCheckin(true);
          return;
        }
      }
      setForm(EMPTY_FORM);
      setPrefilledFromSelfCheckin(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [stayId, reservationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await upsertPoliceRecord(stayId, {
        numeroPiece: form.numeroPiece,
        // validateForm() ci-dessus garantit déjà typePiece non vide (sinon
        // early return) — TS ne peut pas suivre cette garantie à travers
        // l'appel de fonction, d'où le cast plutôt qu'un vrai risque runtime.
        typePiece: form.typePiece as TypePiece,
        nationalite: form.nationalite,
        dateNaissance: form.dateNaissance,
        paysProvenance: form.paysProvenance || undefined,
        villeProvenance: form.villeProvenance || undefined,
        paysDestination: form.paysDestination || undefined,
        villeDestination: form.villeDestination || undefined,
      });
      setRecord(saved);
      setForm(formFromRecord(saved));
      setPrefilledFromSelfCheckin(false);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    setDownloading(true);
    setError(null);
    try {
      await downloadPoliceRecordPdf(stayId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de téléchargement');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {!record && (
        <p className="text-sm text-amber-600">
          Aucune fiche de police enregistrée pour ce séjour — obligation légale
          DGSN.
        </p>
      )}
      {prefilledFromSelfCheckin && (
        <p className="text-muted-foreground text-xs">
          Champs pré-remplis depuis les informations soumises par le client
          (self check-in) — à vérifier avant enregistrement.
        </p>
      )}

      <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            id="numeroPiece"
            label="Numéro de pièce"
            required
            error={fieldErrors.numeroPiece}
          >
            <Input
              id="numeroPiece"
              value={form.numeroPiece}
              onChange={(e) => updateField('numeroPiece', e.target.value)}
              aria-invalid={Boolean(fieldErrors.numeroPiece)}
              aria-describedby={
                fieldErrors.numeroPiece ? 'numeroPiece-error' : undefined
              }
            />
          </FormField>

          <FormField
            id="typePiece"
            label="Type de pièce"
            required
            error={fieldErrors.typePiece}
          >
            <Select
              value={form.typePiece}
              onValueChange={(v) =>
                updateField('typePiece', (v as TypePiece) ?? '')
              }
              items={Object.entries(TYPE_PIECE_LABEL).map(([value, label]) => ({
                value,
                label,
              }))}
            >
              <SelectTrigger
                id="typePiece"
                className="w-full"
                aria-invalid={Boolean(fieldErrors.typePiece)}
                aria-describedby={
                  fieldErrors.typePiece ? 'typePiece-error' : undefined
                }
              >
                <SelectValue placeholder="Choisir un type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_PIECE_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            id="nationalite"
            label="Nationalité"
            required
            error={fieldErrors.nationalite}
          >
            <Input
              id="nationalite"
              value={form.nationalite}
              onChange={(e) => updateField('nationalite', e.target.value)}
              aria-invalid={Boolean(fieldErrors.nationalite)}
              aria-describedby={
                fieldErrors.nationalite ? 'nationalite-error' : undefined
              }
            />
          </FormField>

          <FormField
            id="dateNaissance"
            label="Date de naissance"
            required
            error={fieldErrors.dateNaissance}
          >
            <Input
              id="dateNaissance"
              type="date"
              value={form.dateNaissance}
              onChange={(e) => updateField('dateNaissance', e.target.value)}
              aria-invalid={Boolean(fieldErrors.dateNaissance)}
              aria-describedby={
                fieldErrors.dateNaissance ? 'dateNaissance-error' : undefined
              }
            />
          </FormField>

          <FormField id="paysProvenance" label="Pays de provenance">
            <Input
              id="paysProvenance"
              value={form.paysProvenance}
              onChange={(e) => updateField('paysProvenance', e.target.value)}
            />
          </FormField>

          <FormField id="villeProvenance" label="Ville de provenance">
            <Input
              id="villeProvenance"
              value={form.villeProvenance}
              onChange={(e) => updateField('villeProvenance', e.target.value)}
            />
          </FormField>

          <FormField id="paysDestination" label="Pays de destination">
            <Input
              id="paysDestination"
              value={form.paysDestination}
              onChange={(e) => updateField('paysDestination', e.target.value)}
            />
          </FormField>

          <FormField id="villeDestination" label="Ville de destination">
            <Input
              id="villeDestination"
              value={form.villeDestination}
              onChange={(e) => updateField('villeDestination', e.target.value)}
            />
          </FormField>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={saving}>
            {saving
              ? 'Enregistrement…'
              : record
                ? 'Mettre à jour la fiche'
                : 'Enregistrer la fiche'}
          </Button>
          {record && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={downloading}
            >
              {downloading ? 'Génération…' : 'Télécharger le PDF'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
