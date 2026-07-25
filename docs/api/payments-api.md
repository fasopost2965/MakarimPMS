# payments-api.md — Contrat d'API du Module Paiements

Ce document spécifie le contrat d'API REST officiel et immuable pour le **Module Paiements** du Property Management System (PMS) de l'Hôtel Makarim. Il sert de contrat technique de référence pour l'implémentation de la couche de contrôleurs backend et de la couche d'intégration frontend.

---

## 1. Objectif
Le module Paiements est chargé de l'enregistrement, de la sécurisation, de la validation, et de l'intégration des flux d'encaissement de l'Hôtel Makarim. Il s'assure que chaque paiement reçu est rattaché de manière unique et infalsifiable à un folio de séjour, tout en veillant à la conformité réglementaire de la législation fiscale marocaine sur les espèces et à la prévention absolue des doubles transactions financières.

---

## 2. Endpoints REST

| Méthode | URI | Description | Rôle Minimum Requis | Version |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/payments` | Lister et filtrer l'ensemble des encaissements enregistrés | Comptable | `v1` |
| **GET** | `/api/v1/payments/{id}` | Consulter le détail transactionnel d'un paiement | Comptable | `v1` |
| **POST** | `/api/v1/payments` | Enregistrer un nouvel encaissement (Paiement client) | Comptable | `v1` |
| **PATCH** | `/api/v1/payments/{id}/cancel` | Annuler logiquement un paiement enregistré accidentellement | Administrateur | `v1` |

---

## 3. Permissions RBAC

Chaque requête subit une validation d'accès stricte côté serveur (`BR-TR-004`).

*   **`GET /api/v1/payments`** et **`GET /api/v1/payments/{id}`**
    *   **Rôles autorisés :** Administrateur, Comptable. (La réception peut consulter le résumé des règlements rattachés à un folio, mais pas interroger directement le journal global de trésorerie).
*   **`POST /api/v1/payments`**
    *   **Rôles autorisés :** Administrateur, Comptable. (La réception, lorsqu'elle opère des règlements au comptoir lors de l'arrivée ou du départ, utilise un sous-rôle Comptable restreint pour cet endpoint).
*   **`PATCH /api/v1/payments/{id}/cancel`**
    *   **Rôles autorisés :** Administrateur. (Seul l'administrateur peut procéder à l'annulation d'une écriture comptable d'encaissement).

---

## 4. Request DTO

### `RegisterPaymentDTO` (POST `/api/v1/payments`)
```json
{
  "folioId": "string (UUID v4, requis)",
  "moyenPaiement": "string (Enum: 'ESPECES', 'CARTE', 'VIREMENT', 'ACOMPTE', requis)",
  "montant": "number (Decimal, requis, min: 0.01)",
  "referenceTransaction": "string (max: 100, optionnel, requis si VIREMENT ou CARTE)",
  "notes": "string (max: 250, optionnel)"
}
```

### `CancelPaymentDTO` (PATCH `/api/v1/payments/{id}/cancel`)
```json
{
  "reason": "string (min: 10, max: 250, requis)"
}
```

---

## 5. Response DTO

### `PaymentDetailDTO`
```json
{
  "id": "p5b8a147-16c2-421d-bf8e-c586e11995bb",
  "referenceInterne": "PAY-2026-0098",
  "folioId": "d5b8a147-16c2-421d-bf8e-c586e11995bb",
  "moyenPaiement": "CARTE",
  "montant": 1200.00,
  "devise": "MAD",
  "referenceTransaction": "CB-9876543210",
  "status": "VALIDATED",
  "cancelled": false,
  "cancelledAt": null,
  "cancelledById": null,
  "notes": "Règlement par carte bancaire au desk",
  "processedAt": "2026-07-19T14:35:00Z"
}
```

---

## 6. Codes HTTP

*   **`201 Created`** : Paiement enregistré avec succès. Injecte automatiquement une ligne créditrice de type `PAIEMENT` sur le Folio associé.
*   **`400 Bad Request`** : Erreur de format des données, montant négatif ou mode de paiement invalide.
*   **`403 Forbidden`** : Rôle insuffisant pour exécuter ou annuler un paiement.
*   **`404 Not Found`** : Folio ou Paiement non trouvé.
*   **`409 Conflict`** : Clé d'idempotence déjà consommée (`BR-PAI-001`).
*   **`422 Unprocessable Entity`** : Avertissement de dépassement du plafond légal de paiement en espèces marocain (`BR-PAI-003`).

---

## 7. Règles métier appelées

*   **`BR-PAI-001` : Protection contre les Doubles Paiements (Idempotence)**
    *   Le serveur exige la présence de l'en-tête HTTP `Idempotency-Key` dans les requêtes `POST`. Toute duplication d'UUID dans un délai de 24h est rejetée par une erreur de conflit (`409`).
*   **`BR-PAI-002` : Modes de Paiement Autorisés**
    *   Les modes sont restreints exclusivement à l'énumération : `ESPECES`, `CARTE`, `VIREMENT`, `ACOMPTE`.
*   **`BR-PAI-003` : Plafonnement des Paiements en Espèces (Maroc)**
    *   *Décision métier à confirmer / Validée :* L'application intercepte tout encaissement en `ESPECES` supérieur à **10 000 MAD** cumulé par client et par jour. Le système lève un avertissement strict ou requiert un code de validation managériale avant de poursuivre l'enregistrement.
*   **`BR-FAC-002` : Typologie des Charges de Folio**
    *   L'enregistrement d'un paiement valide génère de manière transactionnelle une ligne de folio de type `PAIEMENT` déduite algébriquement du solde global.

---

## 8. ADR concernées

*   **`ADR-004` : Payment & Financial Integrity**
    *   Précision décimale stricte, devise unique en Dirhams Marocains (`MAD`).
*   **`ADR-005` : Audit & Soft Delete**
    *   Aucun paiement ne peut faire l'objet d'un `DELETE` physique en base de données. L'annulation d'un paiement passe son champ `cancelled` à `true`, et requiert un motif de traçabilité.

---

## 9. Transactions

L'enregistrement de paiement (`POST /api/v1/payments`) s'exécute au sein d'une transaction de base de données à haut niveau d'isolation **`SERIALIZABLE`**.
*   **Portée de la transaction :**
    1.  Vérification de l'idempotence via interrogation du cache (Redis/DB).
    2.  Sélection et verrouillage exclusif du Folio (`SELECT FOR UPDATE`).
    3.  Vérification que le Folio n'est pas clos (`isClosed = false`).
    4.  Écriture de l'entité `Payment`.
    5.  Écriture de l'entité `FolioLine` créditrice de type `PAIEMENT` pour un montant équivalent.
    6.  Recalcul du solde de Folio.
    7.  Émission de l'événement de domaine.

---

## 10. Idempotence

*   L'en-tête HTTP **`Idempotency-Key`** est **obligatoire** sur le endpoint `POST /api/v1/payments`.
*   Si le serveur détecte une clé déjà enregistrée, il retourne la réponse originale (avec le même UUID de paiement) sans réexécuter l'écriture ou altérer à nouveau le solde du Folio.

---

## 11. Audit

Toute modification de flux financier ou annulation de paiement fait l'objet d'un log d'audit immuable (`BR-AUD-002`) :
*   **Enregistrement :** `"Encaissement du paiement [REF] d'un montant de [MONTANT] MAD sur le Folio [FOL_ID] (Mode : [MODE])"`
*   **Annulation :** `"ANNULATION DU PAIEMENT [REF] par l'administrateur [ADMIN_ID]. Motif de correction : [REASON]"`

---

## 12. Événements émis

*   `PaymentReceivedEvent` : Diffusé aux modules Facturation, Comptabilité et Dashboard. Déclenche la mise à jour des rapports journaliers de caisse.
*   `PaymentCancelledEvent` : Notifie le contrôleur de gestion d'une correction de trésorerie.

---

## 13. Performance

*   **Verrouillage pessimiste :** Obligatoire sur les lignes de Folio pour interdire toute mise à jour simultanée des soldes qui pourrait contourner l'invariant de solde de check-out.
*   **Indexation :** Index sur `Payment(folioId)` et `Payment(referenceInterne)`.

---

## 14. Sécurité

*   **Validation du format de transaction :** Pour les paiements par carte bancaire ou virement, les numéros d'autorisation font l'objet d'un contrôle strict de structure (pas d'injection SQL possible).
*   **Garde-fou Espèces :** Barrière de sécurité pour la conformité fiscale marocaine (`BR-PAI-003`).

---

## 15. Checklist PR

- [ ] L'en-tête `Idempotency-Key` est exigé et validé sur le endpoint `POST /api/v1/payments`.
- [ ] Tout paiement enregistré ajoute une ligne de folio correspondante de type `PAIEMENT` au sein de la même transaction SQL.
- [ ] Un test unitaire s'assure qu'un paiement d'espèces supérieur à 10 000 MAD lève un blocage ou un avertissement.
- [ ] Seul le rôle d'Administrateur peut appeler avec succès le endpoint d'annulation de paiement.
- [ ] Aucun appel de méthode SQL `DELETE` n'est codé dans ce module.
- [ ] Les calculs monétaires s'effectuent tous avec un haut niveau de précision décimale (Types Decimal/Big).
