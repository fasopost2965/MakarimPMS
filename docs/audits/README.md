# Index des audits techniques — Makarim PMS v1

Cet index recense les 10 phases de l'audit technique complet mené sur le code réel du projet (pas sur ses intentions documentées). **Règle de lecture** : en cas de désaccord entre `docs/` (spécification cible pré-implémentation) et un rapport ci-dessous, le rapport d'audit fait foi pour l'état réel du code au moment de l'audit — c'est tout l'objet de cet audit d'avoir vérifié le code plutôt que de le supposer conforme à la doc.

**Méthode** : chaque phase a été menée par lecture directe du code (schéma Prisma intégral, services/controllers intégraux, recherche exhaustive par `grep` pour confirmer/infirmer une hypothèse), jamais par supposition à partir de la documentation seule. Aucune modification de code n'a été effectuée pendant l'audit (Phases 1 à 10) — c'est un travail de constat, pas de correction. Les corrections font l'objet du registre des chantiers (`docs/governance/REGISTRE_CHANTIERS.md`), phase de suite distincte.

**Statut des sources** : les rapports des Phases 3 à 10 sont reproduits **verbatim** (texte intégral produit pendant la session d'audit). Les rapports des Phases 1 et 2 ont dû être **reconstitués à partir du résumé de session** (compaction survenue avant que le versement documentaire ne soit demandé) — un avertissement explicite figure en tête de ces deux fichiers ; leurs constats restent fidèles aux faits conservés dans le résumé, mais la formulation phrase à phrase n'est pas garantie identique à l'original.

---

## Table des phases

| # | Phase | Périmètre | Note /10 | Risques majeurs | Fichier |
|---|---|---|---|---|---|
| 1 | Architecture générale | Structure racine, `docs/`, backend (modules/guards/config), frontend (routing/pages/état), cohérence mono-hôtel | 7/10 *(reconstitué)* | `MODULES_INDEX.md` désynchronisé du code dès cette phase | [PHASE_01_ARCHITECTURE_GENERALE.md](./PHASE_01_ARCHITECTURE_GENERALE.md) |
| 2 | Modèle métier | Chambres, réservations, clients, séjours, housekeeping, maintenance, paiements, facturation, reporting | *(non chiffrée — par domaine, non conservée)* | Folio singulier vs ADR-002 ; `Company` déconnectée ; PII en clair | [PHASE_02_MODELE_METIER.md](./PHASE_02_MODELE_METIER.md) |
| 3 | Base de données | Schéma Prisma intégral : 43 modèles, relations, contraintes, index, statuts | 7/10 | Invariants métier non contraints en base (folio unique, facture unique, singleton config) ; pas de déduplication `Guest` | [PHASE_03_BASE_DE_DONNEES.md](./PHASE_03_BASE_DE_DONNEES.md) |
| 4 | Backend | Structure NestJS, 28 controllers/services, DTO, transactions, erreurs, guards | 7,5/10 | Soft-delete non centralisé ; zéro test unitaire de service | [PHASE_04_BACKEND.md](./PHASE_04_BACKEND.md) |
| 5 | Sécurité | Authentification, JWT, RBAC, secrets, CORS, rate limiting, webhooks, PII | 6,5/10 | Token de reset password exposé en clair ; aucun RBAC client ; PII non chiffrée | [PHASE_05_SECURITE.md](./PHASE_05_SECURITE.md) |
| 6 | Finance | Folios, taxes, factures, avoirs, paiements, acomptes, annulations | 6/10 | `CreditNote` totalement absent ; checkout sans blocage sur solde impayé | [PHASE_06_FINANCE.md](./PHASE_06_FINANCE.md) |
| 7 | Housekeeping / Maintenance | Machine à états chambres, tickets, événements, traçabilité | 7,5/10 | `RoomStatusLog` jamais consultable ; blocage silencieux sur ticket | [PHASE_07_HOUSEKEEPING_MAINTENANCE.md](./PHASE_07_HOUSEKEEPING_MAINTENANCE.md) |
| 8 | Frontend | Architecture React, navigation, pages, état, RBAC client | 6,5/10 | 6 modules backend sans UI (dont police, légalement critique) ; aucun deep linking | [PHASE_08_FRONTEND.md](./PHASE_08_FRONTEND.md) |
| 9 | Qualité du code | Cohérence, duplication, taille des fichiers, transactions, dette | 7,5/10 | `ReservationsService` surchargé ; motif récurrent d'intentions inachevées | [PHASE_09_QUALITE_CODE.md](./PHASE_09_QUALITE_CODE.md) |
| 10 | Synthèse et roadmap | Consolidation transversale, priorités, recommandation finale | 7/10 (moyenne pondérée) | Synthèse des risques ci-dessus | [PHASE_10_SYNTHESE_ROADMAP.md](./PHASE_10_SYNTHESE_ROADMAP.md) |

---

## Lecture rapide pour un nouveau développeur (ou une autre IA)

**Ce qui est fiable** (audité, éprouvé, sans écart critique détecté) :
- La chaîne réservation → check-in → séjour → housekeeping → check-out (Phases 2, 6, 7).
- Le RBAC serveur (`PermissionsGuard`, `JwtAuthGuard`) — Phase 5.
- La machine à états des chambres (`ROOM_TRANSITIONS`) — Phase 7.
- L'idempotence des paiements et acomptes — Phase 6.
- La discipline de chemin d'écriture unique par champ sensible — Phases 2, 4, 9.

**Ce qui ne l'est pas / ce qui manque** (voir `docs/governance/REGISTRE_CHANTIERS.md` pour le détail actionnable) :
- Correction de facture (`CreditNote`) — inexistante, Phase 6.
- Sécurité de la réinitialisation de mot de passe — token exposé en clair, Phase 5.
- Saisie du registre de police — aucune UI, Phases 6/8.
- Chiffrement au repos des données d'identité — jamais implémenté malgré exigence documentée, Phase 5.
- RBAC côté frontend — inexistant, Phases 5/8.
- Six modules backend sans interface frontend (self-checkin, police, notifications, document-ocr, channel-manager, audit) — Phase 8.

**Ce qui doit être traité en premier** : les 4 chantiers bloquants listés dans `docs/audits/PHASE_10_SYNTHESE_ROADMAP.md` (§ Priorités de suite) et repris avec fiche complète dans `docs/governance/REGISTRE_CHANTIERS.md`.

---

## Liens vers la suite

- Chantiers dérivés de ces constats, avec fiche complète (priorité, criticité, impacts, statut) : [`../governance/REGISTRE_CHANTIERS.md`](../governance/REGISTRE_CHANTIERS.md)
- Backlog priorisé condensé : [`../governance/BACKLOG_PRIORISE.md`](../governance/BACKLOG_PRIORISE.md)
- Matrice de traçabilité exigence ↔ code ↔ audit ↔ test ↔ doc : [`../governance/MATRICE_TRACABILITE.md`](../governance/MATRICE_TRACABILITE.md)
- État actuel du projet (vision non commerciale) : [`../governance/ETAT_ACTUEL_PROJET.md`](../governance/ETAT_ACTUEL_PROJET.md)
- Plan backend « 100 % réel » : [`../backend-plan/PLAN_BACKEND_100_REEL.md`](../backend-plan/PLAN_BACKEND_100_REEL.md)
- Cartographie fonctionnelle frontend : [`../frontend-plan/CARTOGRAPHIE_ECRANS.md`](../frontend-plan/CARTOGRAPHIE_ECRANS.md)
