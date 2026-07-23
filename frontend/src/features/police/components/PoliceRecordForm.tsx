import { useCallback, useEffect, useState } from 'react';
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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
    if (
      !form.numeroPiece ||
      !form.typePiece ||
      !form.nationalite ||
      !form.dateNaissance
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await upsertPoliceRecord(stayId, {
        numeroPiece: form.numeroPiece,
        typePiece: form.typePiece,
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

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="numeroPiece">Numéro de pièce</Label>
            <Input
              id="numeroPiece"
              value={form.numeroPiece}
              onChange={(e) =>
                setForm((f) => ({ ...f, numeroPiece: e.target.value }))
              }
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="typePiece">Type de pièce</Label>
            <Select
              value={form.typePiece}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, typePiece: (v as TypePiece) ?? '' }))
              }
              items={Object.entries(TYPE_PIECE_LABEL).map(([value, label]) => ({
                value,
                label,
              }))}
            >
              <SelectTrigger id="typePiece" className="w-full">
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
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nationalite">Nationalité</Label>
            <Input
              id="nationalite"
              value={form.nationalite}
              onChange={(e) =>
                setForm((f) => ({ ...f, nationalite: e.target.value }))
              }
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dateNaissance">Date de naissance</Label>
            <Input
              id="dateNaissance"
              type="date"
              value={form.dateNaissance}
              onChange={(e) =>
                setForm((f) => ({ ...f, dateNaissance: e.target.value }))
              }
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="paysProvenance">Pays de provenance</Label>
            <Input
              id="paysProvenance"
              value={form.paysProvenance}
              onChange={(e) =>
                setForm((f) => ({ ...f, paysProvenance: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="villeProvenance">Ville de provenance</Label>
            <Input
              id="villeProvenance"
              value={form.villeProvenance}
              onChange={(e) =>
                setForm((f) => ({ ...f, villeProvenance: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="paysDestination">Pays de destination</Label>
            <Input
              id="paysDestination"
              value={form.paysDestination}
              onChange={(e) =>
                setForm((f) => ({ ...f, paysDestination: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="villeDestination">Ville de destination</Label>
            <Input
              id="villeDestination"
              value={form.villeDestination}
              onChange={(e) =>
                setForm((f) => ({ ...f, villeDestination: e.target.value }))
              }
            />
          </div>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            disabled={
              saving ||
              !form.numeroPiece ||
              !form.typePiece ||
              !form.nationalite ||
              !form.dateNaissance
            }
          >
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
