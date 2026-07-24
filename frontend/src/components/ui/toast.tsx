import { Toast as ToastPrimitive } from '@base-ui/react/toast';
import { XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

// Notification transverse (dette Lot 0, docs/frontend-plan/
// COMPOSANTS_PARTAGES_MANQUANTS.md — "toast"). Jusqu'ici, une action
// réussie (réassort de stock, création de tarif...) se traduisait
// uniquement par la fermeture d'un dialogue et le rafraîchissement
// silencieux d'une liste — aucune confirmation explicite, alors que
// EXIGENCES_UX.md pose déjà la règle « un contrôle nomme ce qu'il fait,
// une confirmation dit ce qui s'est passé ». `toastManager` est un
// singleton (créé une seule fois via createToastManager()) : n'importe
// quel composant peut appeler `toastManager.add({...})` sans passer par
// un hook local — <Toaster /> (montée une seule fois dans App.tsx) est
// la seule chose qui a besoin d'être dans l'arbre React.
export const toastManager = ToastPrimitive.createToastManager();

export function Toaster() {
  return (
    <ToastPrimitive.Provider toastManager={toastManager}>
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport className="fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2 outline-none">
          <ToastList />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  );
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager();

  return toasts.map((toast) => (
    <ToastPrimitive.Root
      key={toast.id}
      toast={toast}
      className={cn(
        'bg-popover text-popover-foreground ring-foreground/10 relative rounded-lg border-l-4 p-3 pr-8 text-sm shadow-md ring-1',
        toast.type === 'error'
          ? 'border-l-destructive'
          : toast.type === 'success'
            ? 'border-l-emerald-500'
            : 'border-l-border',
      )}
    >
      {toast.title && <ToastPrimitive.Title className="font-medium" />}
      {toast.description && (
        <ToastPrimitive.Description className="text-muted-foreground text-xs" />
      )}
      <ToastPrimitive.Close
        aria-label="Fermer la notification"
        className="text-muted-foreground hover:text-foreground absolute top-2 right-2"
      >
        <XIcon className="size-3.5" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  ));
}
