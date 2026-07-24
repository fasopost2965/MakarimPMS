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
7. **CH-010** — ✅ **Terminé** (session courante). Déduplication client — voir `REGISTRE_CHANTIERS.md` pour le détail (index aveugle `pieceIdentiteHash` pour la contrainte dure, `GET /guests/check-duplicate` pour la détection souple, RD-011).
8. **CH-006** — ✅ **Terminé** (session courante). Centraliser soft-delete — voir `REGISTRE_CHANTIERS.md` pour le détail (extension Prisma `$extends`, chaînée avec le chiffrement CH-004, RD-010).
9. **CH-012** — ✅ **Terminé** (session courante). Remboursement acompte imputé — voir `REGISTRE_CHANTIERS.md` pour le détail (l'avoir est un préalable au remboursement, pas une action déclenchée par la route elle-même, RD-007).
10. **CH-007** — ✅ **Terminé** (session courante). Interface frontend self-checkin (staff) — voir `REGISTRE_CHANTIERS.md` pour le détail (`SelfCheckinPanel.tsx`, corrige au passage un bug latent de `lib/api-client.ts` et la dette technique #6 de `seed.ts`). **CH-009** — ✅ **Terminé** (session courante). Interface frontend channel-manager (mappings OTA) — voir `REGISTRE_CHANTIERS.md` pour le détail (4e onglet `ParametersPage.tsx`, vérifié par un appel webhook réel bout-en-bout). **CH-008** — ✅ **Terminé** (session courante). Interface frontend notifications (templates/journal) — voir `REGISTRE_CHANTIERS.md` pour le détail (nouvel onglet dédié `features/notifications/`, preuve RBAC serveur 403 réelle)

### Vague 3 — Secondaires (dette technique, à intercaler entre les livraisons fonctionnelles)
11. ~~CH-019~~ — ✅ **Terminé** (session courante). Renommage `housekeeping/utils/room-transitions.ts` → `manual-status-targets.ts` — voir `REGISTRE_CHANTIERS.md` pour le détail (deux imports mis à jour, aucune logique modifiée).
12. ~~CH-013~~ — ✅ **Terminé** (session courante). Enum mort `StatutSejour.ANNULE` retiré — voir `REGISTRE_CHANTIERS.md` (RD-012).
13. ~~CH-014~~ — ✅ **Terminé** (session courante). Consultation `RoomStatusLog` — voir `REGISTRE_CHANTIERS.md` pour le détail (`GET /rooms/:id/historique-statuts`, `RoomHistoryDialog.tsx`).
14. CH-018 — Resynchronisation documentation modules
15. ~~CH-024~~ — ✅ **Fermé** (session courante). Contrainte d'exclusivité `RoomNight` — `CHECK` techniquement impossible sous MySQL (`onDelete: Cascade`) et XOR strict aurait cassé `StayService.checkin()` ; fermé sans code, invariant vérifié par audit du code, voir `REGISTRE_CHANTIERS.md` (RD-019). ~~CH-025~~ — ✅ **Terminé** (session courante). 4 contraintes `CHECK` MySQL (dates, montants) — voir `REGISTRE_CHANTIERS.md` pour le détail (écart avec la formulation initiale de l'audit sur `FolioLine`, régression détectée/corrigée sur `billing.e2e-spec.ts` avant clôture).
16. ~~CH-015~~ — ✅ **Terminé** (session courante). Consultation `AuditLog` frontend — voir `REGISTRE_CHANTIERS.md` pour le détail (backend déjà complet, nouvel écran `features/audit/`).
17. CH-022 — UI document-ocr
18. ~~CH-020~~ — ✅ **Fermé** (session courante). Numérotation facture — statu quo acté, aucun développement (RD-013, EA-003).
19. ⚙️ **CH-026** — **Partiellement terminé (5/6)** (session courante). Durcissement sécurité secondaire — voir `REGISTRE_CHANTIERS.md` pour le détail (helmet, comparaison à temps constant du secret webhook, verrouillage de compte, complexité mot de passe, rotation/révocation refresh token ; (e) cookie httpOnly explicitement différé, RD-016).
20. ~~CH-021~~ — ✅ **Fermé** (session courante). City ledger / Company — dépriorisé formellement, écart assumé (RD-014, EA-001).
21. ~~CH-023~~ — ✅ **Fermé** (session courante). Matérialisation financière des pénalités — reste hors PMS, écart assumé (RD-015, EA-002).
22. CH-016 — Découpage `ReservationsService`
23. CH-017 — Couverture de tests unitaires *(pratique continue, pas un chantier ponctuel — voir `CRITERES_GO_LIVE.md`)*

### Chantiers cadrés en attente de priorisation (hors ordre d'exécution ci-dessus)

Ces chantiers ne sont **pas** issus de l'audit initial (Phases 1-9) — ils naissent d'un cadrage produit distinct, validé en principe par l'utilisateur, mais dont le timing d'insertion dans la file de développement a été explicitement laissé ouvert. Ne pas les commencer sans confirmation explicite de timing.

- **CH-027** — Personnel, Planning des shifts & Pointage (« Planning & Attendance ») — cadrage `docs/planning/CADRAGE_PLANNING_ATTENDANCE_STAFF.md`, validé en principe (`REGISTRE_DECISIONS.md`, RD-017), fiche complète dans `REGISTRE_CHANTIERS.md`. Découpage en 8 sous-lots (A. modèle de données → H. reporting), ~11–13,5 j développeur seul (~15,5–19,5 j combiné avec le socle portail de connexion `CADRAGE_SESSION_TRAVAIL_STAFF.md`, lui aussi cadré mais non planifié). Proposition d'ordre si retenu, une fois le reste du backlog Vague 3 clos ou en parallèle sur un autre développeur (aucune dépendance croisée avec CH-018/019/022/024/025) :
  1. **Lot B — provisioning composite** (`User`+`Employee` en un geste) : débloque le vrai chaînon manquant du référentiel personnel (aujourd'hui, ajouter un employé réel nécessite un accès base directe) — le plus autonome et le plus immédiatement utile, indépendant du reste.
  2. **Lot A + C — modèle `ShiftPlan` + CRUD backend planning** : dépend des arbitrages encore ouverts (`CADRAGE_PLANNING_ATTENDANCE_STAFF.md` §13.3 — confirmation employé, granularité RBAC).
  3. **Lot D + E — écrans référentiel enrichi + agenda planning** : le plus volumineux (2,5–3 j pour l'agenda seul), à ne démarrer qu'une fois B/C stabilisés.
  4. **Lot F + G — rapprochement prévu/réel + enrichissement du portail de pointage** : dépend de C, peut être livré après E sans bloquer le reste.
  5. **Lot H — résumé reporting attendance** : dépend de F, peut suivre en dernier (`GET /hr/attendance-summary`, pas `reporting`, voir `docs/modules/reporting.md` §16).
  Ne pas insérer ce chantier dans l'ordre d'exécution numéroté ci-dessus tant que l'utilisateur n'a pas explicitement arbitré son timing par rapport au reste du backlog.

## Arbitrages produit à obtenir avant développement (ne pas coder avant tranché)

| Chantier | Arbitrage requis |
|---|---|
| ~~CH-001~~ | ✅ Tranché — avoir total uniquement, voir `REGISTRE_DECISIONS.md` (RD-005). |
| ~~CH-004~~ | ✅ Tranché — implémenter maintenant, voir `REGISTRE_DECISIONS.md` (RD-006). |
| ~~CH-005~~ | ✅ Tranché — blocage dur + échappatoire de check-out forcé à permission dédiée, voir `REGISTRE_DECISIONS.md` (RD-008). |
| ~~CH-011~~ | ✅ Tranché — granularité onglet entier, voir `REGISTRE_DECISIONS.md` (RD-009). *Absent par erreur de cette table lors d'une session précédente alors que la fiche détaillée (`REGISTRE_CHANTIERS.md`) portait bien ce prérequis — corrigé avant tout code, pas après.* |
| ~~CH-010~~ | ✅ Tranché — approche hybride (contrainte dure sur `pieceIdentite`, détection souple sur email/téléphone), voir `REGISTRE_DECISIONS.md` (RD-011). Conflit technique avec le chiffrement CH-004 détecté et résolu (index aveugle `pieceIdentiteHash`) avant tout code. Terminé. |
| ~~CH-013~~ | ✅ Tranché — `StatutSejour.ANNULE` retiré (aucun cas d'usage réel défini), voir `REGISTRE_DECISIONS.md` (RD-012). Terminé. |
| ~~CH-020~~ | ✅ Tranché — séquence continue conservée, voir `REGISTRE_DECISIONS.md` (RD-013) et `ECARTS_ASSUMES.md` (EA-003). Fermé sans développement. |
| ~~CH-021~~ | ✅ Tranché — dépriorisé formellement (écart assumé), voir `REGISTRE_DECISIONS.md` (RD-014) et `ECARTS_ASSUMES.md` (EA-001). Fermé sans développement. |
| ~~CH-023~~ | ✅ Tranché — reste hors PMS (écart assumé), voir `REGISTRE_DECISIONS.md` (RD-015) et `ECARTS_ASSUMES.md` (EA-002). Fermé sans développement. |

## Statut de couverture

Au moment de la création de ce backlog, tous les chantiers étaient au statut **à faire** (session Claude 1, documentation uniquement). **Les 4 chantiers bloquants (CH-001, CH-002, CH-003, CH-004) sont désormais tous terminés** (session de suite, développement effectif) — la Vague 1 du backlog est intégralement close. **La Vague 2 est désormais intégralement close** : CH-005, CH-006, CH-007, CH-008, CH-009, CH-010, CH-011 et CH-012 sont tous terminés (CH-010, le dernier restant, implémenté cette session — index aveugle `pieceIdentiteHash` + détection souple par email/téléphone, RD-011). En Vague 3, CH-013/CH-020/CH-021/CH-023 sont clos (un terminé avec code, trois fermés sans développement — écarts assumés ou statu quo actés, voir `ECARTS_ASSUMES.md`). Le suivi de statut se fait dans `REGISTRE_CHANTIERS.md` (champ *Statut* par fiche, section « Suivi d'avancement ») : mettre à jour ce champ, pas ce backlog, quand un chantier avance — ce document liste l'ordre recommandé, pas l'état courant en détail.
