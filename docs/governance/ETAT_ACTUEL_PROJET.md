# État actuel du projet — Makarim PMS v1 (vision post-audit, non commerciale)

*Dernière mise à jour : issue de l'audit technique 10 phases (`docs/audits/`). À maintenir à jour à chaque clôture de chantier significatif.*

## Ce qu'est le projet

PMS interne pour l'Hôtel Makarim (3 étoiles, 24 chambres, Tétouan) — pas de logique SaaS multi-tenant, mono-établissement par conception. Monorepo NestJS + Prisma + MySQL 8 (backend) et React + Vite + TS + Tailwind (frontend), pensé pour un déploiement Docker Compose sur VPS.

## Périmètre réel actuel (backend, 21 modules confirmés par lecture du code)

`auth`, `rooms`, `parameters`, `reservations`, `stay`, `housekeeping`, `maintenance`, `guests` (+ `companies`), `billing`, `payments`, `dashboard`, `audit`, `police`, `notifications`, `self-checkin`, `booking-engine`, `document-ocr`, `reporting`, `hr`, `stock`, `channel-manager`.

*(Note : `docs/modules/MODULES_INDEX.md` en déclare 13-17 selon les documents — désynchronisé du code réel, voir `ECARTS_DOC_VS_CODE.md` et chantier CH-018.)*

## Ce qui est prêt (audité, éprouvé, sans écart critique détecté)

- Chaîne opérationnelle quotidienne : réservation → check-in → séjour → housekeeping → check-out.
- RBAC serveur (vérification fraîche en base à chaque requête, fail-closed par défaut).
- Machine à états des chambres, avec rattrapage automatique à la lecture (pas de cron).
- Paiements et acomptes idempotents, correctement rattachés au folio.
- Écrans desktop principaux : réservations, check-in, housekeeping, maintenance, clients, entreprises, RH, stock, reporting, paramètres.
- Architecture backend (structure modulaire, validation DTO, gestion d'erreurs, transactions systématiques avec audit).

## Ce qui ne l'est pas

- **Deux surfaces backend sans interface** : document-ocr, audit.
- **Facturation entreprise (city ledger)** : `Company` existe mais est totalement déconnectée du flux transactionnel.

Résolu depuis (voir `REGISTRE_CHANTIERS.md` pour le détail de chaque implémentation) : correction de facture par avoir (CH-001), sécurité de la réinitialisation de mot de passe (CH-002), interface de saisie du registre de police (CH-003), chiffrement au repos de `Guest.pieceIdentite` (CH-004), remboursement d'un acompte imputé (CH-012), blocage du check-out sur solde impayé (CH-005), gating RBAC côté interface (CH-011 — un rôle sans permission sur un module ne voit plus son onglet dans la navigation), filtrage soft-delete centralisé (CH-006 — extension Prisma globale, plus de dépendance à une convention manuelle par service), interface frontend self-checkin (CH-007 — génération de lien + statut d'attente sur le détail de réservation), interface frontend channel-manager (CH-009 — CRUD des mappings OTA dans les Paramètres), interface frontend notifications (CH-008 — onglet dédié templates/journal, preuve RBAC serveur réelle), déduplication client (CH-010 — contrainte dure sur `pieceIdentite` via index aveugle, détection souple email/téléphone). **La Vague 2 (chantiers importants) est désormais intégralement close.**

## Risques majeurs (voir `REGISTRE_RISQUES.md` pour le détail)

Aucun risque majeur ouvert au sens de ce registre — le dernier restant (R-05, contournement du blacklist par duplication de fiche client) est fermé depuis CH-010 (session courante).

Fermés depuis (voir `REGISTRE_RISQUES.md`) : prise de contrôle de compte via le token de reset exposé (R-01, CH-002), facture erronée non corrigible (R-02, CH-001), registre de police légal non tenable en usage réel (R-03, CH-003), fuite de revenus par check-out non contrôlé (R-04, CH-005), contournement du blacklist par duplication de fiche client (R-05, CH-010 — contrainte dure sur `pieceIdentite` via index aveugle, détection souple email/téléphone), exposition de données d'identité en cas de compromission de la base (R-06, CH-004), acompte imputé sans chemin de remboursement (R-08, CH-012).

## Conditions minimales pour une mise en production réelle

Voir `CRITERES_GO_LIVE.md` pour la liste complète et vérifiable. En résumé : les 4 chantiers bloquants du registre (CH-001 à CH-004) sont désormais **tous livrés** — plus aucun chantier bloquant ouvert avant une mise en production réelle du seul point de vue de ce registre (les critères importants/secondaires restent, eux, à traiter selon la feuille de route).

## Priorités de suite

Voir `BACKLOG_PRIORISE.md` pour l'ordre d'exécution recommandé, et `../backend-plan/PLAN_BACKEND_100_REEL.md` / `../frontend-plan/` pour les plans de développement détaillés. Environnement de développement local opérationnel et documenté dans `../planning/ENVIRONNEMENT_LOCAL.md` (backend + frontend vérifiés en fonctionnement dans la session ayant produit cette documentation, connexion réelle testée).

## Note globale issue de l'audit

**7/10** — architecture et discipline d'écriture nettement au-dessus de la moyenne pour un projet de cette taille ; complétude fonctionnelle de la chaîne financière et de la sécurité périphérique en retrait par rapport à cette qualité de base. Voir `docs/audits/PHASE_10_SYNTHESE_ROADMAP.md` pour le détail du raisonnement.
