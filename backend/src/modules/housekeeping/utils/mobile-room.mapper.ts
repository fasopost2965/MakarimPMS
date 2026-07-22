import { Room, RoomType, StatutChambre } from '@prisma/client';

// F9 — contrat de réponse plat pour l'app mobile housekeeping : pas
// d'arbre `include` imbriqué (roomType complet, capacite, prix...), ne
// garde que ce qu'un écran de liste de chambres à nettoyer affiche
// réellement, pour garder les payloads mobiles légers.
export interface MobileRoomSummary {
  id: number;
  numero: string;
  statut: StatutChambre;
  typeChambre: string;
}

export function toMobileRoomSummary(
  room: Room & { roomType: RoomType },
): MobileRoomSummary {
  return {
    id: room.id,
    numero: room.numero,
    statut: room.statut,
    typeChambre: room.roomType.nom,
  };
}
