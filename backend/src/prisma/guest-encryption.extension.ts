import { Prisma } from '@prisma/client';
import {
  decryptField,
  encryptField,
  hashField,
  loadEncryptionKey,
} from '../common/crypto/field-encryption';

// CH-004 — chiffrement transparent de Guest.pieceIdentite au niveau du
// client Prisma (docs/governance/REGISTRE_DECISIONS.md, RD-006) : chaque
// service métier continue d'écrire/lire `pieceIdentite` comme un champ
// String ordinaire, le chiffrement/déchiffrement est invisible à l'appelant.
//
// Choix de conception : `result.guest.pieceIdentite` (et non un simple
// wrapper dans GuestsService) parce que `Guest` est lu par relation
// imbriquée (`include: { guest: true }`) depuis plusieurs autres modules en
// façade lecture seule (`PoliceReportService.getDailyReport`,
// `ReservationsService`, `StayService`...), jamais uniquement via
// `prisma.guest.findMany` directement. Une extension `query` (qui
// n'intercepte que les opérations top-level sur le modèle `guest`) laisserait
// ces lectures imbriquées renvoyer le texte chiffré brut. Vérifié
// empiriquement avant implémentation : une extension `result` s'applique
// bien à `Guest` partout où il apparaît dans un résultat, y compris imbriqué
// depuis un autre modèle et à l'intérieur d'une transaction interactive
// (`$transaction(async (tx) => ...)`), contrairement à `query`.
//
// Écrit uniquement via `prisma.guest.create`/`update`/`updateMany`/`upsert`
// (recherche exhaustive : aucun `guest: { create: {...} }` imbriqué dans le
// code base — `reservations.service.ts`/`stay.service.ts` font
// `tx.guest.create` directement, donc top-level, donc bien intercepté ici).
export function guestEncryptionExtension(rawKey: string | undefined) {
  const key = loadEncryptionKey(rawKey);

  // CH-010 — calcule pieceIdentiteHash (index aveugle, @@unique en base) en
  // même temps que le chiffrement, dans la même fonction : les deux dérivent
  // de la même valeur en clair, jamais désynchronisés. Jamais exposé à l'API
  // (voir prisma.module.ts, `omit` global sur ce champ).
  function encryptGuestData<T extends Record<string, unknown>>(data: T): T {
    if (typeof data?.pieceIdentite !== 'string') {
      return data;
    }
    return {
      ...data,
      pieceIdentite: encryptField(data.pieceIdentite, key),
      pieceIdentiteHash: hashField(data.pieceIdentite, key),
    };
  }

  return Prisma.defineExtension({
    name: 'guest-piece-identite-encryption',
    client: {
      // Ajoutés ici (plutôt que dans PrismaService) car le client réellement
      // injecté dans les services (voir prisma.module.ts) est ce client
      // étendu, pas l'instance PrismaClient de base — Nest appelle ces
      // méthodes par duck-typing (OnModuleInit/OnModuleDestroy), sans
      // exiger une instance de la classe PrismaService.
      onModuleInit() {
        return (
          this as unknown as { $connect: () => Promise<void> }
        ).$connect();
      },
      onModuleDestroy() {
        return (
          this as unknown as { $disconnect: () => Promise<void> }
        ).$disconnect();
      },
    },
    query: {
      guest: {
        create({ args, query }) {
          args.data = encryptGuestData(args.data);
          return query(args);
        },
        update({ args, query }) {
          args.data = encryptGuestData(args.data);
          return query(args);
        },
        updateMany({ args, query }) {
          args.data = encryptGuestData(args.data);
          return query(args);
        },
        upsert({ args, query }) {
          args.create = encryptGuestData(args.create);
          args.update = encryptGuestData(args.update);
          return query(args);
        },
      },
    },
    result: {
      guest: {
        pieceIdentite: {
          needs: { pieceIdentite: true },
          compute(guest: { pieceIdentite: string | null }) {
            return guest.pieceIdentite === null
              ? null
              : decryptField(guest.pieceIdentite, key);
          },
        },
      },
    },
  });
}
