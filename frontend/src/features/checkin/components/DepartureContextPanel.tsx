import type { Stay } from '../types';
import { computeSoldeDuClient } from '../utils/solde';
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

// DESIGN-009 — panneau contextuel "Départs du jour". Réutilise strictement
// StayDetailsDialog (existant), même remarque que StayContextPanel — seule
// différence : transmet un solde estimé côté client (computeSoldeDuClient,
// voir features/checkin/utils/solde.ts) tant que le solde réel (`soldeDu`,
// renvoyé uniquement après un vrai appel à POST /checkout/:stayId) n'est
// pas encore connu — jamais une seconde formule, jamais utilisé pour
// bloquer quoi que ce soit côté client (StayService.checkout reste seul
// arbitre).
export function DepartureContextPanel(props: Props) {
  return (
    <StayDetailsDialog
      {...props}
      estimatedSoldeDu={props.stay ? computeSoldeDuClient(props.stay) : null}
    />
  );
}
