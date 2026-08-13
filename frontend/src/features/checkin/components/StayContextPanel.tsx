import type { Stay } from '../types';
import { StayDetailsDialog } from './StayDetailsDialog';

interface Props {
  stay: Stay | null;
  onClose: () => void;
  onCheckout: () => void;
  checkingOut: boolean;
  error: string | null;
  soldeDu: string | null;
  onPoliceRecordSaved?: () => void;
  permissions?: string[] | null;
  onExtendClick?: () => void;
  onChangeRoomClick?: () => void;
  canForceCheckout?: boolean;
  onForceCheckout?: (motif: string) => void;
  forcingCheckout?: boolean;
  onViewRoom?: (stay: Stay) => void;
}

// DESIGN-009 — panneau contextuel "Séjours en cours". Réutilise
// strictement StayDetailsDialog (existant, ne jamais dupliquer sa logique
// de billing/police/checkout/extend/changement de chambre — voir
// CLAUDE.md) : ce fichier n'existe que pour matérialiser le point d'entrée
// dédié à la vue Séjours dans la découpe imposée par la mission, sans
// aucune divergence de comportement avec la dialogue existante. Jamais de
// solde estimé ici (un séjour EN_COURS non dû aujourd'hui n'a pas de
// "solde à payer" affiché avant le check-out, voir DepartureContextPanel
// pour la vue Départs).
export function StayContextPanel(props: Props) {
  return <StayDetailsDialog {...props} />;
}
