import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  id?: string;
  accept?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  hint?: string;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

// Zone de dépôt de fichier (dette Lot 0, docs/frontend-plan/
// COMPOSANTS_PARTAGES_MANQUANTS.md — "file-upload"). Remplace l'<input
// type="file"> natif utilisé jusqu'ici par document-ocr (CH-022, premier
// et jusqu'ici seul upload de ce projet) : ajoute un vrai glisser-déposer
// en plus du clic — comportement natif du navigateur (drag events),
// jamais câblé jusqu'ici.
export function FileUpload({
  id,
  accept,
  value,
  onChange,
  hint,
  className,
  ...ariaProps
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onChange(e.dataTransfer.files?.[0] ?? null);
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-4 text-center transition-colors',
        dragOver ? 'border-ring bg-accent' : 'border-input hover:bg-accent/50',
        className,
      )}
      {...ariaProps}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {value ? (
        <p className="text-sm font-medium">{value.name}</p>
      ) : (
        <>
          <p className="text-sm">
            Glissez un fichier ici, ou cliquez pour parcourir
          </p>
          {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
        </>
      )}
    </div>
  );
}
