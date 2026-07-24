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

export function DocumentOcrPage() {
  const [fichier, setFichier] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [typeDocument, setTypeDocument] = useState<string>(AUTO);
  const [result, setResult] = useState<DocumentOcrResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBrut, setShowBrut] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
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

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <p className="text-muted-foreground text-sm">
        Extraction indicative des champs d'identité (zone MRZ) à partir d'une
        photo de CIN ou passeport. Purement consultatif : l'image n'est jamais
        enregistrée, et aucun champ n'est écrit automatiquement — relisez et
        validez avant d'enregistrer via la fiche client ou le registre de
        police.
      </p>

      <div className="flex flex-wrap items-end gap-3 rounded-md border p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ocr-fichier">Photo (JPEG/PNG/WebP, 8 Mo max)</Label>
          <Input
            id="ocr-fichier"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Type de document</Label>
          <Select
            value={typeDocument}
            onValueChange={(v) => v && setTypeDocument(v)}
            items={[
              { value: AUTO, label: 'Détection automatique' },
              { value: 'CIN', label: 'CIN' },
              { value: 'PASSEPORT', label: 'Passeport' },
            ]}
          >
            <SelectTrigger size="sm" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO}>Détection automatique</SelectItem>
              <SelectItem value="CIN">CIN</SelectItem>
              <SelectItem value="PASSEPORT">Passeport</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button size="sm" disabled={!fichier || loading} onClick={handleScan}>
          {loading ? 'Analyse…' : 'Scanner'}
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {previewUrl && (
        <img
          src={previewUrl}
          alt="Aperçu du document"
          className="max-h-48 w-fit rounded-md border object-contain"
        />
      )}

      {result && (
        <div className="flex flex-col gap-3 rounded-md border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={result.checksumValide ? 'default' : 'outline'}>
              {result.checksumValide
                ? 'Chiffres de contrôle valides'
                : 'Chiffres de contrôle invalides ou absents'}
            </Badge>
            {result.formatDetecte && (
              <span className="text-muted-foreground text-xs">
                Format détecté : {result.formatDetecte}
              </span>
            )}
          </div>

          {result.avertissement && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-700 dark:text-amber-400">
              {result.avertissement}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CHAMPS.map(({ cle, label }) => (
              <div key={cle} className="flex flex-col gap-0.5">
                <span className="text-muted-foreground text-xs">{label}</span>
                <span className="text-sm">
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
      )}
    </div>
  );
}
