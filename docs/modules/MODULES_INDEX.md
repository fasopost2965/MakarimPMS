# Index Fonctionnel des Modules — PMS Makarim (MODULES_INDEX.md)

Ce document sert de table des matières officielle et de plan directeur d'architecture fonctionnelle pour l'ensemble des modules du PMS Makarim. Il permet à Claude Code (et à tout développeur futur) d'identifier immédiatement le module responsable d'un sujet, de comprendre les couplages et de s'assurer de la conformité du développement avec les règles de l'art établies dans le projet.

---

## 1. Cartographie des Modules du PMS

Le PMS Makarim est structuré en **13 modules fonctionnels autonomes** rattachés par des événements lâches et respectant les principes d'autorité serveur et de ségrégation des privilèges.

| # | Fichier Spécification | Module Fonctionnel | Entités Clés Gouvernées | Rôle Pivot Responsable |
|---|---|---|---|---|
| 1 | [reservations.md](/docs/modules/reservations.md) | **Réservations** | `Reservation`, `RoomNight` | Réception, Admin |
| 2 | [stay.md](/docs/modules/stay.md) | **Séjours** | `Stay` | Réception, Admin |
| 3 | [guests.md](/docs/modules/guests.md) | **Clients (CRM)** | `Guest`, `Company` | Réception, Admin |
| 4 | [rooms.md](/docs/modules/rooms.md) | **Chambres** | `Room`, `RoomType`, `RoomStatusLog` | Réception, Gouvernante |
| 5 | [housekeeping.md](/docs/modules/housekeeping.md) | **Ménage (Housekeeping)** | `HousekeepingTask` | Équipier, Gouvernante |
| 6 | [maintenance.md](/docs/modules/maintenance.md) | **Maintenance** | `MaintenanceTicket` | Technicien, Gouvernante |
| 7 | [billing.md](/docs/modules/billing.md) | **Facturation (Billing)** | `Folio`, `FolioLine`, `Invoice` | Comptable, Admin |
| 8 | [payments.md](/docs/modules/payments.md) | **Paiements** | `Payment` | Comptable, Admin |
| 9 | [accounting.md](/docs/modules/accounting.md) | **Comptabilité** | `Invoice`, `Payment` (Rapprochement) | Comptable, Admin |
| 10| [hr.md](/docs/modules/hr.md) | **RH & Pointage** | `User`, `TimeShift`, `TimeShiftSegment` | Gestionnaire RH, Admin |
| 11| [stock.md](/docs/modules/stock.md) | **Stocks & Consommables** | `StockItem`, `StockMovement` | Gouvernante, Maintenance |
| 12| [reporting.md](/docs/modules/reporting.md) | **Reporting & Analyses** | *Lecture-Seule analytique* | Comptable, Admin |
| 13| [audit.md](/docs/modules/audit.md) | **Audit & Sécurité** | `AuditLog` | Administrateur, Système |
| 14| [parameters.md](/docs/modules/parameters.md) | **Paramètres & Config** | `HotelConfig`, `TaxRateConfig`, `SeasonRate` | Administrateur, Comptable |

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
* **Modules Feuilles (Sans dépendances descendantes) :** `guests` (CRM de base), `audit` (Append-Only), `rooms` (Configuration physique).
* **Modules de Supervision Analytique :** `reporting` (Lecture seule sur tous les modules opérationnels, aucune dépendance d'écriture autorisée).
* **Flux de Liaison Métier Inter-Modules :**
  * `reservations` ➔ dépend de `guests` et `rooms`.
  * `stay` ➔ dépend de `guests`, `rooms` et `billing` (vérification de solde).
  * `housekeeping` / `maintenance` ➔ dépendent uniquement de `rooms`.
  * `billing` ➔ dépend de `stay` et `audit` (ajustements).
  * `payments` ➔ dépend exclusivement de `billing` (injection créditrice).
  * `accounting` ➔ dépend de `billing` et `payments`.
  * `hr` ➔ dépend de `auth` et `audit`.
  * `stock` ➔ dépend de `rooms` (lieu de consommation).
