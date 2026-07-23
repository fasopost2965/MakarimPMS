import { Prisma } from '@prisma/client';

// CH-006 — filtrage soft-delete centralisé (ADR-005 §3.1) : 12 modèles
// portent `deletedAt`, mais avant ce chantier seuls 8 fichiers de service
// filtraient manuellement (`{ deletedAt: null }` inline), 4 modèles
// (Room, Reservation, Payment, TimeShift) n'étaient filtrés nulle part.
// Recherche exhaustive avant implémentation : aucun code du projet n'écrit
// jamais `deletedAt` à ce jour (ADR-005 promis mais encore jamais exercé,
// voir docs/governance/DETTE_TECHNIQUE.md) — ce mécanisme est donc un
// filet de sécurité tourné vers l'avenir, pas un changement de comportement
// observable aujourd'hui (chaque ligne a `deletedAt = NULL` en pratique).
//
// Limite Prisma documentée, pas un oubli : ce mécanisme intercepte les
// opérations top-level sur ces modèles (`prisma.guest.findMany(...)`), pas
// les lectures imbriquées via `include`/`select` depuis un autre modèle
// (même limite que constatée pour l'extension `result` de CH-004, dans
// l'autre sens — `query` ne se propage jamais aux relations imbriquées).
// Aucune parade générique n'existe côté Prisma sur MySQL (pas de RLS native
// contrairement à Postgres) — un futur code lisant une entité soft-deleted
// uniquement via une relation imbriquée resterait un risque résiduel à
// vérifier au cas par cas, pas couvert ici.
const SOFT_DELETE_MODELS = new Set<Prisma.ModelName>([
  'Room',
  'Guest',
  'Reservation',
  'ReservationDeposit',
  'Stay',
  'Payment',
  'User',
  'Employee',
  'TimeShift',
  'TimeShiftSegment',
  'PaySlip',
  'StockItem',
]);

function withNotDeleted(where: Record<string, unknown> | undefined) {
  return { ...where, deletedAt: null };
}

export function softDeleteExtension() {
  return Prisma.defineExtension({
    name: 'soft-delete-filter',
    query: {
      $allModels: {
        findMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = withNotDeleted(args.where);
          }
          return query(args);
        },
        findFirst({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = withNotDeleted(args.where);
          }
          return query(args);
        },
        findFirstOrThrow({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = withNotDeleted(args.where);
          }
          return query(args);
        },
        // Valide au runtime grâce à `extendedWhereUnique` (GA depuis
        // Prisma 5, actif par défaut) : `findUnique`/`findUniqueOrThrow`
        // acceptent un champ non-unique en plus de l'identifiant unique dans
        // `where` — fonctionnalité ajoutée par Prisma précisément pour ce
        // cas d'usage (recette officielle de filtrage soft-delete par
        // extension). Le type `$allModels` généré reste l'union stricte de
        // 40+ `WhereUniqueInput` par modèle (aucun ne déclare `deletedAt`
        // comme champ extensible) — TypeScript ne peut pas suivre le
        // narrowing runtime `SOFT_DELETE_MODELS.has(model)`, d'où le cast
        // ciblé sur ces deux seules opérations.
        findUnique({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            (args as { where: Record<string, unknown> }).where = withNotDeleted(
              args.where,
            );
          }
          return query(args);
        },
        findUniqueOrThrow({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            (args as { where: Record<string, unknown> }).where = withNotDeleted(
              args.where,
            );
          }
          return query(args);
        },
        count({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = withNotDeleted(args.where);
          }
          return query(args);
        },
        aggregate({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = withNotDeleted(args.where);
          }
          return query(args);
        },
        groupBy({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = withNotDeleted(args.where);
          }
          return query(args);
        },
      },
    },
  });
}
