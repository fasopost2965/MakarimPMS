# AUDIT CONSOLIDÉ V1
## Projet : MakarimPMS
Version : 1.0
Date : 02 août 2026
Statut : Référence de gouvernance

---

# 1. Objet du document

Ce document constitue la référence technique et fonctionnelle du projet MakarimPMS à compter du 02/08/2026.

Il remplace les multiples notes d'audit réalisées pendant les différentes phases du projet et centralise l'état réel du système.

Ce document devra être mis à jour après chaque fusion importante.

Il constitue la photographie officielle du projet.

---

# 2. Sources utilisées

Les informations de ce document proviennent :

- du code source actuel
- des audits techniques
- des audits frontend
- du registre des chantiers
- du registre des décisions
- de la matrice de traçabilité
- des plans backend
- des plans frontend
- des documents de gouvernance
- des documents Housekeeping
- des documents Maintenance
- des documents Infrastructure
- des workflows GitHub Actions
- des scripts de déploiement
- des scripts de sauvegarde
- des PR fusionnées
- des issues ouvertes

En cas de conflit entre plusieurs documents, les règles suivantes s'appliquent :

1. Code source
2. Schema Prisma
3. Migrations
4. Registre des décisions
5. Registre des chantiers
6. Documentation

---

# 3. Résumé exécutif

Le projet MakarimPMS a atteint un niveau de maturité élevé.

L'architecture générale est stable.

Les principaux domaines métiers sont implémentés.

Le projet ne nécessite plus une refonte.

La stratégie retenue est :

- amélioration progressive
- aucun redéveloppement inutile
- maintien des règles métier
- stabilité avant nouvelles fonctionnalités

Les principaux travaux restants concernent :

- Housekeeping Task Engine
- Historique Maintenance
- Synchronisation documentaire
- Stabilisation CI/CD
- Validation Go Live
- Modernisation UX/UI

---

# 4. Architecture générale

Architecture :

Monorepo

Backend :
NestJS

Frontend :
React

ORM :
Prisma

Base de données :
MySQL

Cache :
Redis

Documentation API :
Swagger/OpenAPI

Authentification :
JWT

Contrôle d'accès :
RBAC

Déploiement :
Docker Compose

Reverse Proxy :
Nginx

CI/CD :
GitHub Actions

---

# 5. Principes d'architecture validés

Les principes suivants sont officiellement retenus.

## 5.1

Le projet ne sera jamais réécrit.

Toutes les évolutions sont incrémentales.

---

## 5.2

La logique métier est prioritaire sur l'interface.

---

## 5.3

Toute évolution doit être compatible avec les données existantes.

---

## 5.4

Aucune duplication volontaire des règles métier.

---

## 5.5

Un seul service est responsable d'une même règle métier.

---

## 5.6

Les modules communiquent uniquement via leurs services.

---

## 5.7

Aucun accès direct à la base pour contourner les services métier.

---

# 6. État général des modules

| Module | État |
|---------|------|
| Auth | Stable |
| RBAC | Stable |
| Rooms | Stable |
| Guests | Stable |
| Reservations | Stable |
| Stay | Stable |
| Billing | Stable |
| Payments | Stable |
| Housekeeping | En évolution |
| Maintenance | Stable |
| Restaurant | Fonctionnel |
| Inventory | Fonctionnel |
| Reporting | Fonctionnel |
| Notifications | Fonctionnel |
| OCR | Fonctionnel |
| Booking Engine | Fonctionnel |
| Self Check-in | Fonctionnel |
| Channel Manager | Partiellement validé |
| HR | Partiellement implémenté |

---

# 7. Niveau de maturité

Backend

★★★★★

Frontend

★★★★☆

Infrastructure

★★★★☆

Documentation

★★★★☆

Tests

★★★★☆

Sécurité

★★★★☆

Architecture

★★★★★
---

# 8. Cartographie des services critiques

Les services ci-dessous sont considérés comme les autorités métier du projet.

Aucun développement futur ne devra contourner ces services sans décision d'architecture.

---

## RoomsService

Responsabilités :

- gestion des chambres
- transitions d'état
- RoomStatusLog
- disponibilité physique

Statut :

Critique

Règle :

Aucun module ne modifie directement le statut d'une chambre.

Toutes les transitions passent par RoomsService.

---

## ReservationsService

Responsabilités :

- création des réservations
- disponibilité
- RoomNight
- annulations
- modifications

Statut :

Critique

Règle :

Le moteur de disponibilité est unique.

Booking Engine et Channel Manager réutilisent ReservationsService.

---

## StayService

Responsabilités :

- check-in
- séjour
- check-out

Statut :

Critique

Règle :

Toute création ou fermeture d'un séjour passe par StayService.

---

## GuestsService

Responsabilités :

- fiche client
- catégories
- blacklist

Statut :

Critique

Règle :

La catégorie client ne doit jamais être modifiée directement.

---

## BillingService

Responsabilités :

- folios
- écritures
- factures
- avoirs

Statut :

Critique

Règle :

Toutes les écritures financières transitent par BillingService.

---

## PaymentsService

Responsabilités :

- paiements
- remboursements

Statut :

Critique

Règle :

PaymentsService ne crée jamais directement des écritures de folio.

---

## MaintenanceService

Responsabilités :

- tickets
- immobilisation
- historique

Statut :

Critique

---

## HousekeepingTaskService

Responsabilités :

- tâches ménage
- affectations
- workflow
- validation

Statut :

En cours d'intégration

Ce service deviendra l'autorité unique des tâches Housekeeping.

---

## AuditService

Responsabilités :

- journalisation
- audit métier
- traçabilité

Statut :

Critique

---

## NotificationService

Responsabilités :

- email
- SMS
- WhatsApp

Statut :

Fonctionnel

---

# 9. Flux métiers validés

## Réservation

Guest

↓

Reservation

↓

RoomNight

↓

Billing

---

## Check-in

Reservation

↓

Stay

↓

Room

↓

Billing

---

## Séjour

Stay

↓

Housekeeping

↓

Maintenance

↓

Restaurant

↓

Billing

---

## Check-out

Stay

↓

Billing

↓

Invoice

↓

Payment

↓

Room

---

## Restaurant

Restaurant

↓

Billing

↓

Folio

↓

Facture

---

## Maintenance

Maintenance

↓

Room

↓

Availability

---

## Housekeeping

Checkout

↓

HousekeepingTask

↓

Room

↓

Dashboard

---

# 10. État documentaire

## Documents de référence

- schema.prisma
- REGISTRE_CHANTIERS
- REGISTRE_DECISIONS
- ETAT_ACTUEL_PROJET
- GO_LIVE_CHECKLIST
- OPERATIONS_RUNBOOK
- PLAN_BACKEND_100_REEL
- CARTOGRAPHIE_ECRANS
- EXIGENCES_UX
- AUDITS TECHNIQUES

---

## Documents à synchroniser

- ETAT_ACTUEL_PROJET
- MATRICE_TRACABILITE
- RELEASE_CHECKLIST

---

## Documents historiques

Les anciennes spécifications restent conservées uniquement comme historique de conception.

Le code actuel fait foi.

---

# 11. Dette technique

## Critique

Aucune.

---

## Haute

- Finaliser HK-P1-03B
- Finaliser HK-P1-03C
- Historique Maintenance
- Synchronisation documentaire

---

## Moyenne

- Planning RH
- UI Avoir
- Tests de concurrence Stock
- Validation OTA
- Validation Notifications

---

## Faible

- Optimisations UX
- Responsive complémentaire
- Améliorations visuelles
---

# 12. Sécurité

## Niveau global

Élevé

L'architecture de sécurité est considérée comme adaptée à une mise en production après validation opérationnelle.

---

## Authentification

Statut :

Stable

Fonctionnalités validées :

- JWT
- Refresh Token
- Cookies HttpOnly
- Token Version
- Logout serveur
- RBAC

---

## Autorisations

Statut :

Stable

Les permissions sont contrôlées côté Backend.

Le Frontend applique également les restrictions d'affichage selon les permissions de l'utilisateur.

---

## Protection HTTP

Implémentée :

- Helmet
- CORS contrôlé
- Cookies Secure
- SameSite
- CSRF (Double Submit)
- Swagger désactivé en production

---

## Chiffrement

Les données sensibles sont chiffrées.

La clé ENCRYPTION_KEY est obligatoire.

Son remplacement nécessite une procédure de migration.

---

## Points restant à vérifier

Ces éléments ne peuvent être validés que sur le VPS :

- rotation réelle des secrets
- permissions des fichiers .env
- configuration SSH
- pare-feu
- renouvellement Certbot
- HSTS
- sauvegarde distante

---

# 13. Infrastructure

Architecture retenue :

VPS Hostinger

Docker Compose

Nginx

MySQL

Redis

GitHub Actions

---

## Déploiement

Le pipeline effectue :

- Build
- Push GHCR
- Migration Prisma
- Redémarrage Backend
- Redémarrage Frontend
- Healthcheck
- Promotion stable
- Rollback

---

## Points restant à améliorer

- sauvegarde automatique avant migration
- premier tag stable
- alignement version Node
- smoke test frontend
- validation HTTPS

---

# 14. Base de données

Référence officielle :

backend/prisma/schema.prisma

---

Le modèle est considéré comme stable.

Les migrations Prisma constituent l'historique officiel du schéma.

Aucune migration appliquée ne doit être modifiée.

Toute correction doit passer par une nouvelle migration.

---

## Politique de migration

Migration additive :

Acceptée.

Migration destructive :

Interdite sans sauvegarde préalable.

---

## Sauvegardes

Scripts disponibles :

- backup-mysql.sh
- restore-mysql.sh

Une sauvegarde externe reste à mettre en œuvre avant le Go Live.

---

# 15. Qualité

## Backend

Tests unitaires :

Présents.

Tests E2E :

Présents.

Base MySQL réelle utilisée.

---

## Frontend

Vitest

Testing Library

Playwright

---

## Playwright

Validation :

- Backend réel
- Frontend réel
- MySQL réel
- Redis réel

---

## Objectif

Toutes les fonctionnalités critiques doivent disposer d'une preuve de fonctionnement.

---

# 16. État fonctionnel

## Réception

Stable

---

## Chambres

Stable

---

## Clients

Stable

---

## Réservations

Stable

---

## Séjours

Stable

---

## Paiements

Stable

---

## Facturation

Stable

---

## Housekeeping

En évolution.

Le moteur HousekeepingTask devient la référence.

---

## Maintenance

Stable.

Historique chambre en attente.

---

## Restaurant

Fonctionnel pour les charges sur chambre.

Le POS complet reste hors périmètre actuel.

---

## Stock

Fonctionnel.

Tests de concurrence à renforcer.

---

## Reporting

Fonctionnel.

Validation métier des états restant à effectuer.

---

## RH

Employés

Présence

Paie

Planning prévisionnel restant à développer.

---

## OCR

Fonctionnel.

Validation humaine obligatoire.

---

## Booking Engine

Fonctionnel.

Réutilise ReservationsService.

---

## Self Check-in

Fonctionnel.

Pré-enregistrement uniquement.

---

## Channel Manager

Architecture validée.

Connecteurs OTA à finaliser selon les canaux.

---

## Notifications

Architecture validée.

Validation des fournisseurs en production restante.
---

# 17. Risques ouverts

Les risques ci-dessous sont identifiés au 02/08/2026.

Ils ne remettent pas en cause la stabilité générale du projet mais devront être traités avant le Go Live.

| ID | Risque | Priorité | Statut |
|----|---------|----------|--------|
| R-001 | Finalisation HousekeepingTask | Haute | En cours |
| R-002 | Historique Maintenance | Haute | À faire |
| R-003 | Synchronisation documentaire | Haute | À faire |
| R-004 | Sauvegarde externe VPS | Haute | À faire |
| R-005 | Validation Go Live | Haute | À faire |
| R-006 | Smoke Test Frontend | Moyenne | À faire |
| R-007 | Validation Notifications | Moyenne | À faire |
| R-008 | Validation OTA | Moyenne | À faire |
| R-009 | Planning RH | Moyenne | À faire |
| R-010 | Tests concurrence Stock | Moyenne | À faire |

---

# 18. Décisions d'architecture validées

Les décisions suivantes sont considérées comme validées.

## DA-001

Le projet MakarimPMS ne sera jamais réécrit.

Toutes les évolutions sont incrémentales.

---

## DA-002

Le Backend reste la source de vérité.

Aucune logique métier critique ne doit être déplacée dans le Frontend.

---

## DA-003

RoomsService est l'unique autorité sur les transitions d'état des chambres.

---

## DA-004

ReservationsService est l'unique moteur de disponibilité.

Booking Engine et Channel Manager doivent le réutiliser.

---

## DA-005

BillingService est l'unique autorité sur les écritures financières.

---

## DA-006

PaymentsService gère les paiements.

BillingService gère les écritures comptables.

---

## DA-007

HousekeepingTaskService devient l'autorité unique des tâches de ménage.

---

## DA-008

MaintenanceService reste responsable de l'immobilisation des chambres.

---

## DA-009

GuestsService est responsable des catégories et de la blacklist.

---

## DA-010

Les règles métier ne doivent jamais être dupliquées dans plusieurs services.

---

# 19. Recommandations

Les développements futurs devront respecter l'ordre suivant.

## Priorité 1

- Finaliser HK-P1-03B
- Finaliser HK-P1-03C
- Fusion et validation
- Historique Maintenance

---

## Priorité 2

- Synchronisation documentaire
- Stabilisation CI/CD
- Validation sécurité VPS
- Validation Go Live

---

## Priorité 3

- Tests complémentaires
- Planning RH
- Interface Avoir
- Validation Reporting

---

## Priorité 4

- Refonte UX/UI
- Responsive
- Accessibilité
- Optimisations visuelles

---

# 20. Conclusion

L'audit consolidé confirme que MakarimPMS est un projet mature.

L'architecture générale est cohérente.

Les principaux flux métiers sont implémentés.

Les services critiques sont clairement identifiés.

Les risques restants sont limités et connus.

Le projet ne nécessite aucune refonte.

La stratégie retenue est :

- stabiliser les chantiers en cours ;
- terminer les fonctionnalités identifiées ;
- synchroniser la documentation ;
- préparer le Go Live ;
- moderniser progressivement l'expérience utilisateur.

---

# 21. Gouvernance

Ce document constitue la référence officielle de l'état technique et fonctionnel du projet.

Toute évolution importante devra entraîner une mise à jour :

- du présent document ;
- de `MASTER_BACKLOG_V1.md` ;
- de `DECISIONS_ARCHITECTURE.md` ;
- de `PROJECT_STATUS.md`.

Aucun développement majeur ne devra être engagé sans vérification de ces documents.

---

**Historique**

| Version | Date | Auteur | Description |
|---------|------|--------|-------------|
| 1.0 | 02/08/2026 | ChatGPT (Lead Architect / QA) | Première consolidation complète des audits, de la gouvernance et de l'état réel du projet. |
