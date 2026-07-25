# Index Fonctionnel des Modules — PMS Makarim (MODULES_INDEX.md)

Ce document sert de table des matières officielle et de plan directeur d'architecture fonctionnelle pour l'ensemble des modules du PMS Makarim. Il permet à Claude Code (et à tout développeur futur) d'identifier immédiatement le module responsable d'un sujet, de comprendre les couplages et de s'assurer de la conformité du développement avec les règles de l'art établies dans le projet.

---

## 1. Cartographie des Modules du PMS

Le PMS Makarim est structuré en **21 modules fonctionnels réels** (`backend/src/modules/`), rattachés par des événements lâches et respectant les principes d'autorité serveur et de ségrégation des privilèges — voir `CLAUDE.md` pour la liste faisant foi. Le tableau ci-dessous inclut aussi `accounting`, une **22ᵉ ligne qui n'est pas un module réel** (voir note en bas de tableau).

CH-018 (`docs/governance/REGISTRE_CHANTIERS.md`) a resynchronisé ce tableau (auparavant 14 lignes, désynchronisé depuis plusieurs itérations F1-F10) et créé les 8 fiches manquantes ci-dessous.

| # | Fichier Spécification | Module Fonctionnel | Entités Clés Gouvernées | Rôle Pivot Responsable |
|---|---|---|---|---|
| 1 | [auth.md](/docs/modules/auth.md) | **Authentification & RBAC** | `User`, `Role`, `Permission`, `RolePermission`, `RefreshToken`, `LoginLog` | Tous rôles (authentification), Administrateur (gestion) |
| 2 | [reservations.md](/docs/modules/reservations.md) | **Réservations** | `Reservation`, `RoomNight` | Réception, Admin |
| 3 | [stay.md](/docs/modules/stay.md) | **Séjours** | `Stay` | Réception, Admin |
| 4 | [guests.md](/docs/modules/guests.md) | **Clients (CRM)** | `Guest`, `Company` | Réception, Admin |
| 5 | [rooms.md](/docs/modules/rooms.md) | **Chambres** | `Room`, `RoomType`, `RoomStatusLog` | Réception, Gouvernante |
| 6 | [housekeeping.md](/docs/modules/housekeeping.md) | **Ménage (Housekeeping)** | `HousekeepingTask` | Équipier, Gouvernante |
| 7 | [maintenance.md](/docs/modules/maintenance.md) | **Maintenance** | `MaintenanceTicket` | Technicien, Gouvernante |
| 8 | [billing.md](/docs/modules/billing.md) | **Facturation (Billing)** | `Folio`, `FolioLine`, `Invoice` | Comptable, Admin |
| 9 | [payments.md](/docs/modules/payments.md) | **Paiements** | `Payment` | Comptable, Admin |
| 10 | [hr.md](/docs/modules/hr.md) | **RH & Pointage** | `User` (fiche salarié), `TimeShift`, `TimeShiftSegment`, `PaySlip` | Gestionnaire RH, Admin |
| 11 | [stock.md](/docs/modules/stock.md) | **Stocks & Consommables** | `StockItem`, `StockMovement` | Gouvernante, Maintenance |
| 12 | [reporting.md](/docs/modules/reporting.md) | **Reporting & Analyses** | *Lecture-Seule analytique* | Comptable, Admin |
| 13 | [audit.md](/docs/modules/audit.md) | **Audit & Sécurité** | `AuditLog` | Administrateur, Système |
| 14 | [parameters.md](/docs/modules/parameters.md) | **Paramètres** | `HotelConfig`, `TaxRateConfig`, `SeasonRate`, `CnssRateConfig` | Administrateur |
| 15 | [police.md](/docs/modules/police.md) | **Registre de police (DGSN)** | `PoliceRecord` | Réception, Admin |
| 16 | [self-checkin.md](/docs/modules/self-checkin.md) | **Self check-in (F6)** | `SelfCheckinToken` | Client (public), Réception |
| 17 | [notifications.md](/docs/modules/notifications.md) | **Notifications (F7)** | `NotificationTemplate`, `NotificationLog` | Réception, Admin |
| 18 | [booking-engine.md](/docs/modules/booking-engine.md) | **Moteur de réservation public (F4)** | *aucune (façade pure de `reservations`)* | Client (public) |
| 19 | [document-ocr.md](/docs/modules/document-ocr.md) | **Scan OCR pièce d'identité (F5)** | *aucune (consultatif, aucune écriture)* | Réception |
| 20 | [channel-manager.md](/docs/modules/channel-manager.md) | **Channel Manager / OTA (F10)** | `ChannelRoomTypeMapping`, `ChannelReservationImport` | Administrateur (mappings), OTA (webhooks) |
| 21 | [dashboard.md](/docs/modules/dashboard.md) | **Tableau de bord** | *aucune (agrégation lecture seule)* | Tous rôles authentifiés |
| — | [accounting.md](/docs/modules/accounting.md) | ~~Comptabilité~~ **⚠️ non implémenté** | *(aucun code — spec pré-implémentation jamais construite)* | — |

**Note sur `accounting`** : ce spec décrit une clôture comptable journalière, un rapprochement de caisse et un suivi de City Ledger qui n'ont jamais été construits (aucun dossier `backend/src/modules/accounting/`) — écart déjà connu (`docs/governance/ECARTS_DOC_VS_CODE.md`). Le suivi des comptes entreprises (`Company`/City Ledger) qu'il décrit est le même périmètre que `CH-021`/`EA-001` (dépriorisé formellement, `docs/governance/ECARTS_ASSUMES.md`). Le reste (clôture journalière, rapprochement de caisse physique) n'a jamais été demandé par un chantier ni un audit distinct — reste une fonctionnalité potentielle non planifiée, pas une dette active. Ce fichier est conservé pour référence historique, pas comme une spec à implémenter telle quelle.

---

## 2. Principes Fondamentaux d'Intégration des Modules

Lors du développement d'un nouveau flux métier ou d'un composant, vous devez impérativement respecter les règles de conception croisées suivantes :

### A. Primauté du Séjour (ADR-001)
Toute opération physique d'un client dans l'hôtel (consommation d'extras, occupation physique d'une chambre, facturation d'hébergement, check-in, check-out) est rattachée opérationnellement à l'entité centrale **`Stay`** (Séjour) et non à la réservation prospective.

### B. Indépendance Financière (ADR-002, ADR-004)
Le cycle financier est régi par des **Folios** rattachés au séjour. Les lignes de débit (`FolioLine` de charges) sont gérées exclusivement par le module `billing`, tandis que les lignes de crédit (`Payment`) sont contrôlées de manière étanche par le module `payments`. Les factures émises (`Invoice`) sont strictement **immuables** (INV-FAC-001).

### C. Inviolabilité de l'État Physique des Chambres (ADR-003)
La transition d'état d'une chambre physique est régulée par une machine à états stricte (`StatutChambre`) s'accompagnant d'une écriture simultanée de log dans `RoomStatusLog`. Le module `housekeeping` (par son contrôle final de Gouvernante) et le module `maintenance` (par sa résolution d'incident) sont les seuls habilités à débloquer et libérer des chambres pour la vente.

### D. Absolutisme de l'Horloge Serveur & Pointage Inviolable (ADR-007)
Le module `hr` impose un système de pointage de présence en temps réel basé exclusivement sur l'horloge interne du serveur backend. La déconnexion d'un utilisateur possédant un shift actif est bloquée par un dispositif de sécurité (`Logout Guard`).

### E. Traçabilité et Audit d'Anomalie (ADR-005)
Chaque écart, ajustement rétroactif de tarif, correction d'heures de salariés ou suppression logique d'extras exige la saisie d'un motif textuel d'au moins **10 caractères** et l'écriture immédiate et immuable d'un log de sécurité dans la table `AuditLog` par le module `audit`.

---

## 3. Matrice des Dépendances Inter-Modules

Afin de préserver un couplage lâche, d'éviter les dépendances circulaires critiques et de parer aux risques d'effets de bord, veuillez vous conformer à la charte d'autorisations et d'interdictions de dépendances documentée au sein de chaque module.

### Synthèse des Couplages Inter-Modules :
* **Modules Feuilles (Sans dépendances descendantes) :** `guests` (CRM de base), `audit` (Append-Only), `rooms` (Configuration physique), `parameters` (Configuration/taux — dépend uniquement de `audit` pour la traçabilité des modifications).
* **Modules de Supervision Analytique :** `reporting` (Lecture seule sur tous les modules opérationnels, aucune dépendance d'écriture autorisée).
* **Flux de Liaison Métier Inter-Modules :**
  * `reservations` ➔ dépend de `guests`, `rooms` et `parameters` (grille tarifaire saisonnière).
  * `stay` ➔ dépend de `guests`, `rooms` et `billing` (vérification de solde).
  * `housekeeping` / `maintenance` ➔ dépendent uniquement de `rooms`.
  * `billing` ➔ dépend de `stay`, `audit` (ajustements) et `parameters` (taux de TVA/taxe de séjour).
  * `payments` ➔ dépend exclusivement de `billing` (injection créditrice).
  * `hr` ➔ dépend de `auth`, `audit` et `parameters` (taux CNSS).
  * `stock` ➔ dépend de `rooms` (lieu de consommation).
  * `police` ➔ dépend de `stay` (façade lecture seule) et `audit`.
  * `self-checkin` ➔ dépend de `reservations`, `guests` et `notifications` (façades).
  * `notifications` ➔ dépend de `guests`, `reservations`, `stay` (façades) et `audit`.
  * `booking-engine` ➔ dépend exclusivement de `reservations` (façade publique pure, aucune table propre).
  * `document-ocr` ➔ module feuille, aucune dépendance (aucune table propre, consultatif uniquement).
  * `channel-manager` ➔ dépend de `reservations` (façade) et `audit`.
  * `dashboard` ➔ lecture agrégée cross-modules (mêmes conventions que `reporting`, pas de dépendance de service).
  * `auth` ➔ dépend de `notifications` (façade `MailerService` uniquement, email de réinitialisation de mot de passe) ; consommé par tous les autres modules pour l'authentification/RBAC, jamais l'inverse.
