# Backlog priorisé — Makarim PMS v1

Vue condensée et actionnable de `REGISTRE_CHANTIERS.md`, triée pour piloter l'exécution. Pour le détail complet de chaque ligne (impacts, critères de validation, dépendances), toujours se référer au registre — ce document est une vue de pilotage, pas une source de vérité indépendante.

## Ordre d'exécution recommandé

### Vague 1 — Bloquants (avant go-live)
Peuvent être menés en parallèle par des développeurs différents — aucune dépendance croisée entre eux à l'exception de CH-012 qui attend CH-001.

1. **CH-002** — ✅ **Terminé** (session courante). Sécuriser le reset password *(le plus rapide, traité en premier pour fermer une faille active)* — voir `REGISTRE_CHANTIERS.md` pour le détail (l'implémentation a nécessité un ajustement frontend non anticipé dans la fiche initiale, traité dans le même chantier).
2. **CH-001** — Implémenter CreditNote *(le plus structurant, débloque CH-012 et une partie de CH-023)*
3. **CH-003** — UI registre de police *(indépendant, purement frontend, peut démarrer immédiatement)*
4. **CH-004** — Arbitrage + éventuelle implémentation du chiffrement PII *(commencer par l'arbitrage, qui ne coûte rien et débloque le reste)*

### Vague 2 — Importants
5. **CH-005** — Blocage checkout solde impayé
6. **CH-011** — Gating RBAC frontend *(prérequis technique : route `GET /auth/me` à créer — le plus gros chantier de cette vague)*
7. **CH-010** — Déduplication client
8. **CH-006** — Centraliser soft-delete
9. **CH-012** — Remboursement acompte imputé *(dès que CH-001 est livré)*
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
| CH-001 | Périmètre de l'avoir : total, partiel, impact sur les lignes de taxe déjà matérialisées ? |
| CH-004 | Implémenter le chiffrement maintenant, ou accepter le risque formellement et reporter ? |
| CH-005 | Blocage dur du checkout, ou avertissement avec confirmation ? |
| CH-010 | Contrainte dure d'unicité, ou détection souple à la création ? |
| CH-020 | La numérotation doit-elle réellement repartir de 1 chaque mois ? |
| CH-021 | La facturation entreprise (city ledger) est-elle une priorité produit, ou un écart assumé ? |
| CH-023 | Le recouvrement de pénalité doit-il être tracé dans le système, ou rester un processus humain hors PMS ? |

## Statut de couverture

Au moment de la création de ce backlog, tous les chantiers étaient au statut **à faire** (session Claude 1, documentation uniquement). **CH-002 est désormais terminé** (session de suite, développement effectif). Le suivi de statut se fait dans `REGISTRE_CHANTIERS.md` (champ *Statut* par fiche, section « Suivi d'avancement ») : mettre à jour ce champ, pas ce backlog, quand un chantier avance — ce document liste l'ordre recommandé, pas l'état courant en détail.
