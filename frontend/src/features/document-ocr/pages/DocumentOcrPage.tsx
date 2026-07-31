import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FileUpload } from '@/components/ui/file-upload';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PoliceRecordForm } from '@/features/police/components/PoliceRecordForm';
import type { OcrPrefill } from '@/features/police/components/PoliceRecordForm';
import { listStaysEnCours } from '@/features/checkin/api';
import type { Stay } from '@/features/checkin/types';
import { scanDocument } from '../api';
import type { DocumentOcrResult, TypeDocumentScan } from '../types';

// Sentinelle : base-ui Select n'accepte pas une valeur vide comme option
// "Détection automatique" — traduite en `undefined` (le parseur détecte le
// format tout seul) avant l'appel API, même convention que features/audit.
const AUTO = '__AUTO__';

const CHAMPS: { cle: keyof DocumentOcrResult; label: string }[] = [
  { cle: 'numeroPiece', label: 'Numéro de pièce' },
  { cle: 'nom', label: 'Nom' },
  { cle: 'prenom', label: 'Prénom' },
  { cle: 'nationalite', label: 'Nationalité' },
  { cle: 'dateNaissance', label: 'Date de naissance' },
  { cle: 'sexe', label: 'Sexe' },
  { cle: 'dateExpiration', label: "Date d'expiration" },
];

// Mapping du format MRZ détecté (document-ocr) vers TypePiece (police) —
// deux énumérations volontairement distinctes (features/document-ocr/types.ts
// vs features/police/types.ts) puisque seuls CIN/PASSEPORT portent une zone
// MRZ lisible par ce scanner, alors que TypePiece couvre aussi SEJOUR/AUTRE.
function typePieceFromFormat(
  format: DocumentOcrResult['formatDetecte'],
): 'CIN' | 'PASSEPORT' | null {
  if (format === 'TD1_CIN') return 'CIN';
  if (format === 'TD3_PASSEPORT') return 'PASSEPORT';
  return null;
}

// Barrière explicite avant affichage (défense en profondeur, au-delà du
// simple commentaire explicatif déjà présent avant CH-068 — insuffisant
// pour CodeQL js/xss-through-dom, qui a re-signalé l'alerte "nouvelle" dès
// que ce fichier a été retouché) : previewUrl vient exclusivement de
// URL.createObjectURL(fichier) juste au-dessus, jamais du contenu ni du nom
// du fichier choisi, mais on le revalide quand même ici — seul un blob:
// généré par le navigateur est jamais rendu, n'importe quelle autre valeur
// (même hypothétique) est rejetée.
function toSafeBlobUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'blob:' ? parsed.href : null;
  } catch {
    return null;
  }
}

// CH-068 (batch 3 design handoff, ScanIdentite.dc.html) — combine le scan
// OCR (F5, déjà existant) et la fiche de police (CH-003, déjà existante,
// jusqu'ici uniquement accessible séjour par séjour depuis
// StayDetailsDialog) en un seul écran de réception : scanner → relire →
// reporter dans la fiche du séjour choisi → enregistrer. Écran purement
// consultatif côté scan : l'image n'est jamais enregistrée, aucun champ
// n'est écrit automatiquement — seul un clic explicite sur « Reporter »
// pré-remplit le formulaire, et seul l'enregistrement de la fiche (bouton
// dédié, PoliceRecordForm) écrit réellement (upsertPoliceRecord inchangé,
// seul point d'écriture).
export function DocumentOcrPage() {
  const [fichier, setFichier] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [typeDocument, setTypeDocument] = useState<string>(AUTO);
  const [result, setResult] = useState<DocumentOcrResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBrut, setShowBrut] = useState(false);

  const [stays, setStays] = useState<Stay[]>([]);
  const [staysLoading, setStaysLoading] = useState(true);
  const [staysError, setStaysError] = useState<string | null>(null);
  const [selectedStayId, setSelectedStayId] = useState<string>('');
  const [ocrPrefill, setOcrPrefill] = useState<OcrPrefill | null>(null);

  const refetchStays = useCallback(async () => {
    setStaysLoading(true);
    setStaysError(null);
    try {
      const data = await listStaysEnCours();
      setStays(data);
    } catch (err) {
      setStaysError(
        err instanceof Error ? err.message : 'Erreur de chargement',
      );
    } finally {
      setStaysLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetchStays();
  }, [refetchStays]);

  const selectedStay = useMemo(
    () => stays.find((s) => String(s.id) === selectedStayId) ?? null,
    [stays, selectedStayId],
  );

  const safePreviewUrl = useMemo(
    () => (previewUrl ? toSafeBlobUrl(previewUrl) : null),
    [previewUrl],
  );

  function handleFileChange(f: File | null) {
    setFichier(f);
    setResult(null);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  async function handleScan() {
    if (!fichier) return;
    setLoading(true);
    setError(null);
    try {
      const res = await scanDocument(
        fichier,
        typeDocument === AUTO ? undefined : (typeDocument as TypeDocumentScan),
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du scan');
    } finally {
      setLoading(false);
    }
  }

  function handleReport() {
    if (!result) return;
    setOcrPrefill({
      numeroPiece: result.numeroPiece,
      typePiece: typePieceFromFormat(result.formatDetecte),
      nationalite: result.nationalite,
      dateNaissance: result.dateNaissance,
    });
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-auto p-6">
      <div className="bg-muted/40 rounded-md border p-3">
        <p className="text-muted-foreground text-xs">
          Écran purement consultatif — le scan lit et prévalide la pièce (zone
          MRZ), mais n'écrit rien automatiquement. La réception relit et
          enregistre la fiche de police manuellement ci-dessous.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
            1. Scanner la pièce
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={typeDocument === 'CIN' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setTypeDocument('CIN')}
            >
              CNIE
            </Button>
            <Button
              type="button"
              size="sm"
              variant={typeDocument === 'PASSEPORT' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setTypeDocument('PASSEPORT')}
            >
              Passeport
            </Button>
            <Button
              type="button"
              size="sm"
              variant={typeDocument === AUTO ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setTypeDocument(AUTO)}
            >
              Auto
            </Button>
          </div>

          <FileUpload
            id="ocr-fichier"
            accept="image/jpeg,image/png,image/webp"
            value={fichier}
            onChange={handleFileChange}
            hint="JPEG/PNG/WebP, 8 Mo max — zone MRZ visible et nette"
          />
          {safePreviewUrl && (
            <img
              src={safePreviewUrl}
              alt="Aperçu du document"
              className="max-h-48 w-fit rounded-md border object-contain"
            />
          )}
          <Button
            size="sm"
            className="w-fit"
            disabled={!fichier || loading}
            onClick={handleScan}
          >
            {loading ? 'Analyse…' : 'Scanner'}
          </Button>
          <p className="text-muted-foreground text-[11px]">
            Seuls CNIE et Passeport portent une zone MRZ lisible par ce scanner.
          </p>
          {error && (
            <ErrorState
              title="Échec du scan"
              description={error}
              onRetry={fichier ? handleScan : undefined}
              retryLabel="Reprendre le scan"
            />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
            2. Résultat de la lecture
          </span>

          {!result ? (
            <p className="text-muted-foreground rounded-md border p-4 text-sm">
              Aucun document scanné pour l'instant.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-3 rounded-md border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {result.formatDetecte && (
                    <span className="text-sm font-medium">
                      Format détecté :{' '}
                      {result.formatDetecte === 'TD1_CIN'
                        ? 'CNIE (TD1)'
                        : 'Passeport (TD3)'}
                    </span>
                  )}
                  <Badge
                    variant={result.checksumValide ? 'success' : 'outline'}
                  >
                    {result.checksumValide
                      ? 'Checksum valide'
                      : 'Checksum invalide ou absent'}
                  </Badge>
                </div>

                {result.avertissement && (
                  <p className="border-warning/40 bg-warning/10 text-warning rounded-md border p-2 text-sm">
                    {result.avertissement}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {CHAMPS.map(({ cle, label }) => (
                    <div key={cle} className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground text-xs">
                        {label}
                      </span>
                      <span className="text-sm font-medium">
                        {(result[cle] as string | null) ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>

                {result.lignesMrz.length > 0 && (
                  <div>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => setShowBrut(!showBrut)}
                    >
                      {showBrut
                        ? 'Masquer la zone MRZ brute'
                        : 'Voir la zone MRZ brute'}
                    </Button>
                    {showBrut && (
                      <pre className="bg-muted mt-2 overflow-x-auto rounded p-2 font-mono text-xs">
                        {result.lignesMrz.join('\n')}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={!selectedStayId}
                onClick={handleReport}
              >
                ↓ Reporter dans la fiche de police
              </Button>
              {!selectedStayId && (
                <p className="text-muted-foreground text-[11px]">
                  Choisissez d'abord un séjour ci-dessous pour activer le
                  report.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="bg-card overflow-hidden rounded-lg border">
        <div className="border-b px-4.5 py-3.5">
          <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
            3. Fiche de police
            {selectedStay
              ? ` — ${selectedStay.guest.prenom} ${selectedStay.guest.nom}, chambre ${selectedStay.room.numero}`
              : ''}
          </span>
        </div>
        <div className="flex flex-col gap-4 p-4.5">
          <div className="flex max-w-sm flex-col gap-1.5">
            <Label htmlFor="stay-picker">Séjour en cours</Label>
            {staysLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : staysError ? (
              <p className="text-destructive text-sm">{staysError}</p>
            ) : stays.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Aucun séjour en cours.
              </p>
            ) : (
              <Select
                value={selectedStayId}
                onValueChange={(v) => v && setSelectedStayId(v)}
                items={stays.map((s) => ({
                  value: String(s.id),
                  label: `${s.guest.prenom} ${s.guest.nom} — chambre ${s.room.numero}${s.policeRecord ? ' ✓' : ''}`,
                }))}
              >
                <SelectTrigger id="stay-picker" className="w-full">
                  <SelectValue placeholder="Choisir un séjour" />
                </SelectTrigger>
                <SelectContent>
                  {stays.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.guest.prenom} {s.guest.nom} — chambre {s.room.numero}
                      {s.policeRecord ? ' ✓' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedStay ? (
            <PoliceRecordForm
              stayId={selectedStay.id}
              reservationId={selectedStay.reservationId}
              onSaved={refetchStays}
              ocrPrefill={ocrPrefill}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              Sélectionnez un séjour pour afficher sa fiche de police.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
