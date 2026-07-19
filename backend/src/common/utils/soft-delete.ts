// Filtre standard pour exclure les enregistrements soft-deleted (ADR-005
// §3.1) sur les entités qui possèdent une colonne `deletedAt` (Reservation,
// Stay, Payment, Guest, Room, User). Point d'entrée unique à réutiliser une
// fois qu'une fonctionnalité commence réellement à écrire `deletedAt` — le
// futur middleware Prisma d'auto-filtrage global n'aura qu'à remplacer cet
// import, jamais chaque requête individuellement.
export const NOT_DELETED = { deletedAt: null } as const;
