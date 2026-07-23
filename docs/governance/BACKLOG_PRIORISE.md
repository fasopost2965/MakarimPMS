# Backlog priorisé — Makarim PMS v1

Vue condensée et actionnable de `REGISTRE_CHANTIERS.md`, triée pour piloter l'exécution. Pour le détail complet de chaque ligne (impacts, critères de validation, dépendances), toujours se référer au registre — ce document est une vue de pilotage, pas une source de vérité indépendante.

## Ordre d'exécution recommandé

### Vague 1 — Bloquants (avant go-live)
Peuvent être menés en parallèle par des développeurs différents — aucune dépendance croisée entre eux à l'exception de CH-012 (Vague 2) qui attendait CH-001 (dépendance levée, CH-012 également terminé depuis).

1. **CH-002** — ✅ **Terminé** (session courante). Sécuriser le reset password *(le plus rapide, traité en premier pour fermer une faille active)* — voir `REGISTRE_CHANTIERS.md` pour le détail (l'implémentation a nécessité un ajustement frontend non anticipé dans la fiche initiale, traité dans le même chantier).
2. **CH-001** — ✅ **Terminé** (session courante). Implémenter CreditNote (avoir total) *(le plus structurant, débloque CH-012 et une partie de CH-023)* — voir `REGISTRE_CHANTIERS.md` pour le détail (garde de régénération de facture + correctif d'un bug latent de double-matérialisation de taxe, non anticipés dans la fiche initiale, traités dans le même chantier).
3. **CH-004** — ✅ **Terminé** (session courante). Chiffrement AES-256-GCM de `Guest.pieceIdentite` — voir `REGISTRE_CHANTIERS.md` pour le détail (implémenté au niveau du client Prisma plutôt qu'en wrapper de service, pour couvrir les lectures imbriquées depuis d'autres modules).
4. **CH-003** — ✅ **Terminé** (session courante). UI registre de police (onglet « Police » dans `StayDetailsDialog.tsx`) — voir `REGISTRE_CHANTIERS.md` pour le détail (badge d'avertissement ajouté dans les listes de séjours, non explicitement prévu par la fiche initiale mais nécessaire pour donner une vraie visibilité).

### Vague 2 — Importants
5. **CH-005** — ✅ **Terminé** (session courante). Blocage checkout solde impayé — voir `REGISTRE_CHANTIERS.md` pour le détail (blocage dur + échappatoire de check-out forcé réservée à `checkin:force-checkout`, RD-008).
6. **CH-011** — ✅ **Terminé** (session courante). Gating RBAC frontend (granularité onglet entier) — voir `REGISTRE_CHANTIERS.md` pour le détail (`GET /auth/me` + filtrage de `NAV_ITEMS`, RD-009 ; correctif connexe sur `lib/api-client.ts`, `/auth/me` n'est plus traité à tort comme public).
7. **CH-010** — Déduplication client
8. **CH-006** — ✅ **Terminé** (session courante). Centraliser soft-delete — voir `REGISTRE_CHANTIERS.md` pour le détail (extension Prisma `$extends`, chaînée avec le chiffrement CH-004, RD-010).
9. **CH-012** — ✅ **Terminé** (session courante). Remboursement acompte imputé — voir `REGISTRE_CHANTIERS.md` pour le détail (l'avoir est un préalable au remboursement, pas une action déclenchée par la route elle-même, RD-007).
10. **CH-007 / CH-008 / CH-009** — Interfaces frontend self-checkin / notifications / channel-manager *(indépendantes entre elles, à répartir selon la capacité disponible)*

### Vague 3 — Secondaires (dette technique, à intercaler entre les livraisons fonctionnelles)
11. CH-019 — Renommage `room-transitions.ts` *(quasi gratuit, à faire dès qu'un développeur touche ce module)*
12. CH-013 — Enums morts
13. CH-014 — Consultation `RoomStatusLog`
14. CH-018 — Resynchronisation documentation modules
15. CH-024 / CH-025 — Contraintes DB additionnelles
16. CH-015 — Consultation `AuditLog` frontend
17. CH-022 — UI document-ocr
18. CH-020 — Numérotation facture
19. CH-026 — Durcissement sécurité secondaire
20. CH-021 — City ledger / Company *(à confirmer si prioritaire selon stratégie commerciale entreprise)*
21. CH-023 — Matérialisation financière des pénalités
22. CH-016 — Découpage `ReservationsService`
23. CH-017 — Couverture de tests unitaires *(pratique continue, pas un chantier ponctuel — voir `CRITERES_GO_LIVE.md`)*

## Arbitrages produit à obtenir avant développement (ne pas coder avant tranché)

| Chantier | Arbitrage requis |
|---|---|
| ~~CH-001~~ | ✅ Tranché — avoir total uniquement, voir `REGISTRE_DECISIONS.md` (RD-005). |
| ~~CH-004~~ | ✅ Tranché — implémenter maintenant, voir `REGISTRE_DECISIONS.md` (RD-006). |
| ~~CH-005~~ | ✅ Tranché — blocage dur + échappatoire de check-out forcé à permission dédiée, voir `REGISTRE_DECISIONS.md` (RD-008). |
| ~~CH-011~~ | ✅ Tranché — granularité onglet entier, voir `REGISTRE_DECISIONS.md` (RD-009). *Absent par erreur de cette table lors d'une session précédente alors que la fiche détaillée (`REGISTRE_CHANTIERS.md`) portait bien ce prérequis — corrigé avant tout code, pas après.* |
| CH-010 | Contrainte dure d'unicité, ou détection souple à la création ? |
| CH-020 | La numérotation doit-elle réellement repartir de 1 chaque mois ? |
| CH-021 | La facturation entreprise (city ledger) est-elle une priorité produit, ou un écart assumé ? |
| CH-023 | Le recouvrement de pénalité doit-il être tracé dans le système, ou rester un processus humain hors PMS ? |

## Statut de couverture

Au moment de la création de ce backlog, tous les chantiers étaient au statut **à faire** (session Claude 1, documentation uniquement). **Les 4 chantiers bloquants (CH-001, CH-002, CH-003, CH-004) sont désormais tous terminés** (session de suite, développement effectif) — la Vague 1 du backlog est intégralement close. En Vague 2, CH-005, CH-006, CH-011 et CH-012 sont également terminés — seuls CH-010 (arbitrage requis) et CH-007/CH-008/CH-009 (interfaces frontend) restent ouverts. Le suivi de statut se fait dans `REGISTRE_CHANTIERS.md` (champ *Statut* par fiche, section « Suivi d'avancement ») : mettre à jour ce champ, pas ce backlog, quand un chantier avance — ce document liste l'ordre recommandé, pas l'état courant en détail.
