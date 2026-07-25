import { useEffect, useState } from 'react';
import { checkGuestDuplicate } from './api';
import type { Guest } from './types';

// CH-010 (RD-011) — détection souple par email/téléphone, partagée entre
// GuestPicker (réservation/walk-in) et CreateGuestForm (GuestsPage) : un
// simple avertissement, jamais un blocage (la contrainte dure porte
// uniquement sur pieceIdentite, côté serveur). Même pattern de debounce que
// searchGuests dans GuestPicker.
export function useDuplicateWarning(email: string, telephone: string) {
  const [matches, setMatches] = useState<Guest[]>([]);

  useEffect(() => {
    const trimmedEmail = email.trim();
    const trimmedTelephone = telephone.trim();
    if (!trimmedEmail && !trimmedTelephone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMatches([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      checkGuestDuplicate({
        email: trimmedEmail || undefined,
        telephone: trimmedTelephone || undefined,
      })
        .then((data) => {
          if (!cancelled) setMatches(data);
        })
        .catch(() => {
          if (!cancelled) setMatches([]);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [email, telephone]);

  return matches;
}
