import { Lock } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

// DESIGN-006 (mission §11) — l'accès à la grille "État des chambres" ne
// signifie pas l'accès aux données des autres modules : chaque panneau
// contextuel vérifie sa propre permission et affiche cet état plutôt
// qu'une erreur 403 brute si elle manque.
export function AccessDenied() {
  return (
    <EmptyState
      icon={<Lock className="size-5" />}
      title="Vous n'avez pas accès à ces informations."
    />
  );
}
