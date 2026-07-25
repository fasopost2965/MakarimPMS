# EVENT_CATALOG.md — Catalogue des Événements Métier (Event-Driven Architecture)

Ce document répertorie l'ensemble des événements de domaine (Domain Events) émis au sein du PMS de l'Hôtel Makarim. L'architecture orientée événements permet de découpler les modules, d'alimenter les tableaux de bord analytiques en temps réel et de déclencher des processus asynchrones d'automatisation (comme la décrémentation automatique des stocks ou les notifications mobiles).

---

## 📋 Table des Matières
1. [Garanties Architecturales d'Échange d'Événements](#1-garanties-architecturales-déchange-dévénements)
2. [Index des Événements de Domaine](#2-index-des-événements-de-domaine)
3. [Spécification Détaillée des Événements](#3-spécification-détaillée-des-événements)

---

## 1. Garanties Architecturales d'Échange d'Événements

Pour préserver l'intégrité absolue des opérations financières et logistiques, le courtier d'événements (Event Broker) local ou asynchrone respecte les standards techniques suivants :

1. **Garantie de Délivrance : At-Least-Once (Au moins une fois)**
   * Chaque événement émis doit être reçu par ses consommateurs abonnés. En cas de coupure réseau ou d'échec de traitement temporaire d'un consommateur, l'événement est retransmis automatiquement (Retry Policy avec Backoff exponentiel).
2. **Idempotence Obligatoire chez les Consommateurs**
   * En raison de la délivrance *At-Least-Once*, un même événement peut être reçu plusieurs fois. Chaque consommateur doit s'assurer de l'idempotence de ses traitements en traquant l'identifiant unique `eventId` de l'événement en base de données.
3. **Ordre Chronologique Strict**
   * Les événements concernant un même agrégat (ex: un séjour `Stay` ou une facture `Invoice`) doivent impérativement être sérialisés et traités dans leur ordre d'émission réel, garantissant la cohérence finale du système.
4. **Transactions Outbox Pattern**
   * Pour éviter les désynchronisations (ex: validation de check-in réussie en base de données mais échec d'émission d'événement), les événements sont écrits de manière transactionnelle dans une table temporaire d'Outbox SQL dans la même transaction que les données métier d'origine. Un démon d'arrière-plan lit cette table et dépile les événements vers le broker.

---

## 2. Index des Événements de Domaine

| Code de l'Événement | Module Producteur | Modules Consommateurs | Niveau de Priorité |
| :--- | :--- | :--- | :--- |
| **`ReservationConfirmedEvent`** | `reservations` | `reporting` | MOYENNE |
| **`ReservationCancelledEvent`** | `reservations` | `reporting`, `audit` | HAUTE |
| **`StayCheckedInEvent`** | `stay` | `housekeeping`, `reporting`, `audit` | URGENTE |
| **`StayCheckedOutEvent`** | `stay` | `housekeeping`, `reporting`, `audit` | URGENTE |
| **`FolioLineAddedEvent`** | `billing` | `reporting` | MOYENNE |
| **`PaymentReceivedEvent`** | `billing` | `accounting`, `reporting`, `audit` | URGENTE |
| **`InvoiceIssuedEvent`** | `billing` | `accounting`, `reporting`, `audit` | URGENTE |
| **`HousekeepingTaskCompletedEvent`** | `housekeeping` | `stock`, `reporting` | MOYENNE |
| **`MaintenanceTicketCreatedEvent`** | `maintenance` | `reporting`, `audit` | HAUTE |
| **`EmployeeClockedInEvent`** | `hr` | `reporting`, `audit` | MOYENNE |
| **`EmployeeClockedOutEvent`** | `hr` | `reporting`, `audit` | MOYENNE |
| **`ShiftExchangeValidatedEvent`** | `hr` | `reporting`, `audit` | MOYENNE |
| **`ExpenseRegisteredEvent`** | `accounting` | `reporting`, `audit` | HAUTE |
| **`StockThresholdAlertEvent`** | `stock` | `reporting`, `audit` | HAUTE |

---

## 3. Spécification Détaillée des Événements

### 3.1. Module Réservations & Séjours

#### `ReservationCancelledEvent`
* **Émis lors de :** L'annulation officielle d'une réservation confirmée par l'un des réceptionnistes ou l'administrateur.
* **Payload :**
```json
{
  "eventId": "a5d8b749-36c2-411d-bf8e-f586e1199a01",
  "eventType": "ReservationCancelledEvent",
  "timestamp": "2026-07-19T11:45:30Z",
  "userId": "u1a2b3c4-5678-90ab-cdef-1234567890aa",
  "data": {
    "reservationId": "r5b8a147-16c2-421d-bf8e-c586e11995aa",
    "guestId": "g5b8a147-16c2-421d-bf8e-c586e11995bb",
    "roomTypeId": "rt5b8a147-16c2-421d-bf8e-c586e11995cc",
    "dateArrivee": "2026-07-20",
    "dateDepart": "2026-07-25",
    "acompteMontant": 1200.00,
    "motif": "Changement de plans familiaux du client."
  }
}
```

#### `StayCheckedInEvent`
* **Émis lors de :** L'enregistrement d'arrivée effectif d'un client dans l'établissement (Check-In).
* **Payload :**
```json
{
  "eventId": "a5d8b749-36c2-411d-bf8e-f586e1199a02",
  "eventType": "StayCheckedInEvent",
  "timestamp": "2026-07-19T14:10:00Z",
  "userId": "u1a2b3c4-5678-90ab-cdef-1234567890aa",
  "data": {
    "stayId": "s5b8a147-16c2-421d-bf8e-c586e11995aa",
    "roomId": "rm5b8a147-16c2-421d-bf8e-c586e11995dd",
    "roomNumero": "104",
    "guestId": "g5b8a147-16c2-421d-bf8e-c586e11995bb",
    "dateDepartPrevue": "2026-07-24",
    "masterFolioId": "f5b8a147-16c2-421d-bf8e-c586e11995ee"
  }
}
```

---

### 3.2. Module Facturation & Paiements

#### `PaymentReceivedEvent`
* **Émis lors de :** La saisie validée d'un règlement financier d'un client sur un folio.
* **Payload :**
```json
{
  "eventId": "a5d8b749-36c2-411d-bf8e-f586e1199a03",
  "eventType": "PaymentReceivedEvent",
  "timestamp": "2026-07-19T15:30:22Z",
  "userId": "u1a2b3c4-5678-90ab-cdef-1234567890aa",
  "data": {
    "paymentId": "p5b8a147-16c2-421d-bf8e-c586e11995ff",
    "idempotencyKey": "9f848243-7f2a-4dfa-8260-bc84293f7da2",
    "folioId": "f5b8a147-16c2-421d-bf8e-c586e11995ee",
    "stayId": "s5b8a147-16c2-421d-bf8e-c586e11995aa",
    "montant": 1500.00,
    "moyenPaiement": "CARTE",
    "referenceTransaction": "TPE-9283742"
  }
}
```

#### `InvoiceIssuedEvent`
* **Émis lors de :** L'émission comptable finale et immuable d'une facture client lors du check-out.
* **Payload :**
```json
{
  "eventId": "a5d8b749-36c2-411d-bf8e-f586e1199a04",
  "eventType": "InvoiceIssuedEvent",
  "timestamp": "2026-07-19T16:00:00Z",
  "userId": "u1a2b3c4-5678-90ab-cdef-1234567890aa",
  "data": {
    "invoiceId": "inv5b8a147-16c2-421d-bf8e-c586e1199501",
    "numeroFacture": "FAC-2026-07-0024",
    "folioId": "f5b8a147-16c2-421d-bf8e-c586e11995ee",
    "guestId": "g5b8a147-16c2-421d-bf8e-c586e11995bb",
    "montantHT": 4500.00,
    "montantTVA": 450.00,
    "taxeSejour": 120.00,
    "montantTTC": 5070.00
  }
}
```

---

### 3.3. Module Housekeeping & Maintenance

#### `HousekeepingTaskCompletedEvent`
* **Émis lors de :** La validation finale d'un nettoyage de chambre par la Gouvernante générale (`BR-HK-001`).
* **Payload :**
```json
{
  "eventId": "a5d8b749-36c2-411d-bf8e-f586e1199a05",
  "eventType": "HousekeepingTaskCompletedEvent",
  "timestamp": "2026-07-19T11:00:00Z",
  "userId": "g1a2b3c4-5678-90ab-cdef-1234567890bb", -- ID Gouvernante
  "data": {
    "taskId": "hk5b8a147-16c2-421d-bf8e-c586e1199502",
    "roomId": "rm5b8a147-16c2-421d-bf8e-c586e11995dd",
    "roomNumero": "104",
    "roomTypeNom": "Chambre Double Standard",
    "cleanerId": "u1a2b3c4-5678-90ab-cdef-1234567890cc" -- ID Équipier de ménage
  }
}
```
* **Effet de bord principal (Consommateur `stock`) :** Ce message déclenche immédiatement le déstockage automatique des produits d'accueil (2 mini savons, 2 shampoings, kit d'accueil) de la base d'inventaire (`BR-STK-001`).

---

### 3.4. Module Ressources Humaines & Stocks

#### `EmployeeClockedInEvent`
* **Émis lors de :** L'enregistrement inviolable de début de service d'un collaborateur (Clock-In).
* **Payload :**
```json
{
  "eventId": "a5d8b749-36c2-411d-bf8e-f586e1199a06",
  "eventType": "EmployeeClockedInEvent",
  "timestamp": "2026-07-19T06:58:34Z",
  "userId": "u1a2b3c4-5678-90ab-cdef-1234567890cc", -- ID Collaborateur
  "data": {
    "attendanceId": "att5b8a147-16c2-421d-bf8e-c586e1199503",
    "employeeId": "emp5b8a147-16c2-421d-bf8e-c586e1199504",
    "startedAt": "2026-07-19T06:58:34Z"
  }
}
```

#### `StockThresholdAlertEvent`
* **Émis lors de :** Le passage d'un article de consommables sous son seuil critique d'alerte de sécurité (`BR-STK-002`).
* **Payload :**
```json
{
  "eventId": "a5d8b749-36c2-411d-bf8e-f586e1199a07",
  "eventType": "StockThresholdAlertEvent",
  "timestamp": "2026-07-19T11:00:05Z",
  "userId": "systeme_stock_daemon",
  "data": {
    "stockItemId": "stk5b8a147-16c2-421d-bf8e-c586e1199505",
    "codeArticle": "AMEN-SOAP-01",
    "nomArticle": "Mini Savon Makarim 15g",
    "quantitePhysiqueRestante": 48.00,
    "seuilAlerteConfigure": 50.00,
    "unite": "unité"
  }
}
```
* **Consommateur associé :** Dashboard de la Gouvernante (mise en relief visuelle rouge) et Module de Comptabilité (pré-génération d'une demande d'achat fournisseur).
