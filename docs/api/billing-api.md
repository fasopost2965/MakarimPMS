# billing-api.md — Contrat d'API du Module Facturation (Billing & Invoicing)

Ce document spécifie le contrat d'API REST officiel et immuable pour le **Module Facturation (Billing & Invoicing)** du Property Management System (PMS) de l'Hôtel Makarim. Il sert de contrat technique de référence pour l'implémentation de la couche de contrôleurs backend et de la couche d'intégration frontend.

---

## 1. Objectif
Le module Facturation administre la santé financière de l'établissement. Il gère la création des Folios (comptes temporaires de séjours), l'imputation de charges (hébergement, taxes de séjour, consommations extras), le transfert sécurisé de frais, et l'émission solennelle des Factures d'Hébergement et des Avoirs comptables immuables.

---

## 2. Endpoints REST

| Méthode | URI | Description | Rôle Minimum Requis | Version |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/folios/{id}` | Consulter le détail et les lignes de charges d'un Folio | Comptable | `v1` |
| **POST** | `/api/v1/stays/{stayId}/folios` | Créer un Folio supplémentaire (Extras) pour un séjour | Comptable | `v1` |
| **POST** | `/api/v1/folios/{id}/charges` | Imputer une charge (HEBERGEMENT, EXTRA, TAXE_SEJOUR) sur un folio | Comptable | `v1` |
| **PATCH** | `/api/v1/folios/{id}/charges/{lineId}/cancel` | Annuler logiquement une charge non facturée | Comptable | `v1` |
| **POST** | `/api/v1/folios/transfer-charge` | Transférer une charge d'un folio A vers un folio B | Comptable | `v1` |
| **POST** | `/api/v1/folios/{id}/invoice` | Émettre la facture définitive (Clôture du Folio) | Comptable | `v1` |
| **POST** | `/api/v1/invoices/{id}/credit-note` | Émettre un Avoir rectificatif (partiel ou total) pour une facture | Comptable | `v1` |
| **GET** | `/api/v1/invoices/{id}` | Consulter une facture émise | Comptable | `v1` |

---

## 3. Permissions RBAC

Chaque requête subit une validation d'accès stricte côté serveur (`BR-TR-004`).

*   **`GET /api/v1/folios/{id}`**
    *   **Rôles autorisés :** Administrateur, Comptable. (La réception a un droit de lecture restreint en lecture seule uniquement lors de l'acte de check-out).
*   **`POST /api/v1/stays/{stayId}/folios`**, **`POST /api/v1/folios/{id}/charges`**, **`PATCH /api/v1/folios/{id}/charges/{lineId}/cancel`**, **`POST /api/v1/folios/transfer-charge`**
    *   **Rôles autorisés :** Administrateur, Comptable. (Les points de vente externes comme le SPA ou le Restaurant utilisent des jetons d'API dotés du rôle Comptable restreint pour imputer des charges).
*   **`POST /api/v1/folios/{id}/invoice`**, **`POST /api/v1/invoices/{id}/credit-note`**
    *   **Rôles autorisés :** Administrateur, Comptable. (Interdiction absolue d'émettre des factures ou avoirs sans rôle financier).

---

## 4. Request DTO

### `ImputeChargeDTO` (POST `/api/v1/folios/{id}/charges`)
```json
{
  "type": "string (Enum: 'HEBERGEMENT', 'EXTRA', 'TAXE_SEJOUR', requis)",
  "libelle": "string (requis, max: 150)",
  "montantHT": "number (Decimal, min: 0.00, requis)",
  "tvaTaux": "number (Decimal, requis, ex: 10.00 ou 20.00)"
}
```

### `CancelChargeDTO` (PATCH `/api/v1/folios/{id}/charges/{lineId}/cancel`)
```json
{
  "reason": "string (min: 10, max: 250, requis)"
}
```

### `TransferChargeDTO` (POST `/api/v1/folios/transfer-charge`)
```json
{
  "sourceFolioId": "string (UUID v4, requis)",
  "targetFolioId": "string (UUID v4, requis)",
  "folioLineId": "string (UUID v4, requis)",
  "reason": "string (min: 10, max: 250, requis)"
}
```

### `IssueCreditNoteDTO` (POST `/api/v1/invoices/{id}/credit-note`)
```json
{
  "type": "string (Enum: 'PARTIEL', 'TOTAL', requis)",
  "montantAvoirHT": "number (Decimal, requis, min: 0.01)",
  "reason": "string (min: 10, max: 500, requis)"
}
```

---

## 5. Response DTO

### `FolioDetailDTO`
```json
{
  "id": "d5b8a147-16c2-421d-bf8e-c586e11995bb",
  "stayId": "b8a5d147-36c2-411d-bf8e-f586e11993aa",
  "reference": "FOL-2026-0043-A",
  "estPrincipal": true,
  "lines": [
    {
      "id": "l1a2b3c4-5678-90ab-cdef-1234567890aa",
      "type": "HEBERGEMENT",
      "libelle": "Nuitée du 2026-07-19 (Chambre 104)",
      "montantHT": 1090.91,
      "tvaTaux": 10.00,
      "tvaMontant": 109.09,
      "montantTTC": 1200.00,
      "annulee": false,
      "createdAt": "2026-07-19T14:30:00Z"
    }
  ],
  "solde": 1200.00,
  "isClosed": false
}
```

### `InvoiceDetailDTO`
```json
{
  "id": "i1b2c3d4-5678-90ab-cdef-1234567890aa",
  "numeroFacture": "FAC-2026-0034",
  "folioId": "d5b8a147-16c2-421d-bf8e-c586e11995bb",
  "iceClient": "001234567890123",
  "nomClient": "Société Marocaine de Logistique S.A.",
  "totalHT": 1090.91,
  "totalTVA": 109.09,
  "totalTTC": 1200.00,
  "devise": "MAD",
  "status": "EMISE",
  "creditNotes": [],
  "issuedAt": "2026-07-23T12:00:00Z"
}
```

---

## 6. Codes HTTP

*   **`200 OK`** : Consultation ou transfert traité avec succès.
*   **`201 Created`** : Charge imputée, facture ou avoir généré avec succès.
*   **`400 Bad Request`** : Données d'entrée erronées ou TVA non conforme.
*   **`403 Forbidden`** : Utilisateur non autorisé à manipuler des écritures financières.
*   **`404 Not Found`** : Folio ou ligne de charge inconnu.
*   **`409 Conflict`** : Tentative d'imputation ou de modification sur un Folio déjà clos et facturé.
*   **`422 Unprocessable Entity`** : Solde insuffisant ou non concordant pour la clôture légale de facturation.

---

## 7. Règles métier appelées

*   **`BR-TR-002` : Immutabilité Fiscale**
    *   Toute facture émise (`Invoice`) est strictement verrouillée en écriture (`PATCH` et `UPDATE` bloqués au niveau applicatif). Toute correction s'effectue par la création d'une entité de type `CreditNote` (Avoir).
*   **`BR-TR-003` : Interdiction du Codage en Dur**
    *   Les montants de taxe de séjour et taux de TVA applicables sont obligatoirement extraits de la table `TaxRateConfig`.
*   **`BR-FAC-001` : Capacité Multi-Folios**
    *   Autorisation de lier plusieurs folios à un séjour.
*   **`BR-FAC-002` : Typologie des Charges de Folio**
    *   Les types admis sont exclusivement limités à `HEBERGEMENT`, `EXTRA`, `TAXE_SEJOUR` et `PAIEMENT`.
*   **`BR-FAC-003` : Interdiction de Suppression Physique**
    *   Rejet de tout appel de méthode SQL `DELETE` sur `FolioLine`. L'annulation s'opère en injectant `annulee = true` et en consignant un motif d'annulation explicite.
*   **`BR-FAC-004` : Transferabilité des Charges**
    *   Seules les charges non encore rattachées à une facture émise peuvent être transférées.

---

## 8. ADR concernées

*   **`ADR-002` : Folio & Billing Model**
    *   Définit le cycle comptable et l'isolation financière des lignes de folios.
*   **`ADR-004` : Payment & Financial Integrity**
    *   Toutes les valeurs monétaires sont traitées en types décimaux de haute précision. La devise de transaction est obligatoirement le Dirham Marocain (`MAD`).
*   **`ADR-005` : Audit & Soft Delete**
    *   Consignation immuable de toutes les actions correctives sur l'audit log.

---

## 9. Transactions

La facturation finale (`POST .../invoice`) exige l'isolation la plus stricte de niveau **`SERIALIZABLE`**.
*   **Portée de la transaction (Facturation) :**
    1.  Sélection et verrouillage exclusif du Folio (`SELECT FOR UPDATE`).
    2.  Vérification que le Folio n'est pas déjà clos (`isClosed = false`).
    3.  Agréger et sommer toutes les lignes non annulées pour valider le solde.
    4.  Vérifier l'imputation correspondante de paiement pour que le solde total soit égal à `0.00` MAD (ou transfert City Ledger validé).
    5.  Créer l'entité `Invoice` immuable avec calcul exact des taxes et ventilations de TVA.
    6.  Muter le statut du `Folio` à `isClosed = true`.
    7.  Émettre l'événement de domaine.

---

## 10. Idempotence

L'endpoint d'émission de factures et d'avoirs prend en charge un mécanisme d'idempotence strict s'appuyant sur l'en-tête `Idempotency-Key` pour parer à toute double soumission réseau.

---

## 11. Audit

Toute modification financière génère un log d'audit immuable (`BR-AUD-002`) :
*   **Annulation de charge :** `"Annulation de la ligne de folio [LINE_ID] pour le motif : [REASON]"`
*   **Transfert de charge :** `"Transfert de charge [LINE_ID] du Folio [FOLIO_A] vers le Folio [FOLIO_B]. Motif : [REASON]"`
*   **Émission d'avoir :** `"Génération d'un Avoir [REF] rattaché à la Facture [FAC_REF]. Motif : [REASON]"`

---

## 12. Événements émis

*   `FolioChargeImputedEvent` : Notifie les outils analytiques et les pointages.
*   `FolioLineCancelledEvent` : Ajuste immédiatement les équilibres comptables.
*   `InvoiceIssuedEvent` : Diffusé aux modules Comptabilité et Reporting (archivage légal).
*   `CreditNoteIssuedEvent` : Déclenche les écritures rectificatives dans le journal de vente.

---

## 13. Performance

*   **Decimal Handling :** Utilisation d'un middleware convertissant les montants décimaux de la base en chaînes de caractères précises (ou objets Big) lors du transit JSON pour éviter toute dérive de virgule flottante JavaScript.
*   **Indexation :** Index sur `FolioLine(folioId, annulee)`.

---

## 14. Sécurité

*   **Plafonds d'autorisation :** Le système de facturation empêche les corrections ou avoirs d'un montant supérieur à la facture d'origine.
*   **Sanitization :** Neutralisation systématique de scripts XSS sur tous les libellés de charges manuelles saisis au comptoir.

---

## 15. Checklist PR

- [ ] L'écriture d'une facture (`Invoice`) est immuable ; aucun contrôleur ne propose d'endpoint de modification/mise à jour directe.
- [ ] L'annulation d'une charge de folio s'effectue via une annulation logique (`annulee = true`) et exige un motif textuel de 10+ caractères.
- [ ] Le transfert de charges d'un folio à un autre est tracé de manière exhaustive dans l'entité `AuditLog` avec motif obligatoire.
- [ ] Toutes les opérations monétaires utilisent des champs décimaux précis. Aucun calcul monétaire n'est confié à des types flottants standards (`number`).
- [ ] Un test d'intégration vérifie la cohérence du calcul de la TVA et de la taxe de séjour extraites dynamiquement de la base de données.
