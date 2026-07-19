# stock-api.md — Contrat d'API du Module Gestion des Stocks

Ce document spécifie le contrat d'API REST officiel et immuable pour le **Module Gestion des Stocks** du Property Management System (PMS) de l'Hôtel Makarim. Il sert de contrat technique de référence pour l'implémentation de la couche de contrôleurs backend et de la couche d'intégration frontend.

---

## 1. Objectif
Le module Gestion des Stocks supervise l'inventaire physique des consommables de l'Hôtel Makarim (linges de lit, serviettes, kits d'accueil, produits de ménage). Il permet de suivre les mouvements de stock (entrées fournisseurs, pertes, consommations réelles), d'administrer les fiches fournisseurs partenaires et de lever des alertes automatisées d'approvisionnement dès que les stocks passent sous un seuil critique de sécurité.

---

## 2. Endpoints REST

| Méthode | URI | Description | Rôle Minimum Requis | Version |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/stock` | Lister et filtrer l'ensemble des articles de stock | Gouvernante | `v1` |
| **GET** | `/api/v1/stock/{id}` | Consulter la fiche complète d'un article de stock | Gouvernante | `v1` |
| **POST** | `/api/v1/stock` | Déclarer un nouvel article en inventaire | Gouvernante | `v1` |
| **POST** | `/api/v1/stock/movements` | Enregistrer un mouvement manuel (Ajustement, Perte, Achat) | Gouvernante | `v1` |
| **GET** | `/api/v1/stock/alerts` | Consulter les articles en rupture ou sous le seuil d'alerte | Gouvernante | `v1` |
| **GET** | `/api/v1/suppliers` | Lister les fournisseurs enregistrés | Gouvernante | `v1` |
| **POST** | `/api/v1/suppliers` | Enregistrer une nouvelle fiche de fournisseur | Gouvernante | `v1` |

---

## 3. Permissions RBAC

Chaque requête subit une validation d'accès stricte côté serveur (`BR-TR-004`).

*   **`GET /api/v1/stock`**, **`GET /api/v1/stock/{id}`**, **`GET /api/v1/stock/alerts`**, **`GET /api/v1/suppliers`**
    *   **Rôles autorisés :** Administrateur, Gouvernante. (Les réceptionnistes et techniciens n'ont aucun accès à l'inventaire).
*   **`POST /api/v1/stock`**, **`POST /api/v1/stock/movements`**, **`POST /api/v1/suppliers`**
    *   **Rôles autorisés :** Administrateur, Gouvernante. (La Gouvernante générale de l'hôtel orchestre le réapprovisionnement quotidien).

---

## 4. Request DTO

### `CreateStockItemDTO` (POST `/api/v1/stock`)
```json
{
  "codeArticle": "string (requis, unique, max: 50, ex: 'AMEN-SHAMP-01')",
  "nom": "string (requis, max: 100)",
  "categorie": "string (Enum: 'produits_accueil', 'linge_lit', 'produits_entretien', requis)",
  "quantitePhysique": "number (Decimal, requis, min: 0.00)",
  "seuilAlerte": "number (Decimal, requis, min: 0.00)",
  "unite": "string (requis, ex: 'unité', 'litre', 'boite')"
}
```

### `RegisterStockMovementDTO` (POST `/api/v1/stock/movements`)
```json
{
  "stockItemId": "string (UUID v4, requis)",
  "typeMouvement": "string (Enum: 'ENTREE_ACHAT', 'SORTIE_PERTE', 'AJUSTEMENT', requis)",
  "quantite": "number (Decimal, requis, min: 0.01)",
  "supplierId": "string (UUID v4, optionnel, requis si ENTREE_ACHAT)",
  "reason": "string (requis, min: 10, max: 250)"
}
```

### `CreateSupplierDTO` (POST `/api/v1/suppliers`)
```json
{
  "nom": "string (requis, max: 100, unique)",
  "contactEmail": "string (format email, requis)",
  "contactTelephone": "string (requis)",
  "adresse": "string (requis)",
  "identifiantFiscal": "string (IF marocain, requis, max: 20)"
}
```

---

## 5. Response DTO

### `StockItemDTO`
```json
{
  "id": "s5b8a147-16c2-421d-bf8e-c586e11995aa",
  "codeArticle": "AMEN-SHAMP-01",
  "nom": "Mini Shampoing Makarim 30ml",
  "categorie": "produits_accueil",
  "quantitePhysique": 120.00,
  "seuilAlerte": 150.00,
  "unite": "unité",
  "sousSeuilSecurite": true,
  "updatedAt": "2026-07-19T11:00:00Z"
}
```

---

## 6. Codes HTTP

*   **`200 OK`** : Consultation de l'inventaire ou alertes récupérées avec succès.
*   **`201 Created`** : Nouvel article de stock, fournisseur ou mouvement enregistré avec succès.
*   **`400 Bad Request`** : Erreur d'entrée de données (quantités négatives, codes incorrects).
*   **`403 Forbidden`** : Rôle insuffisant pour modifier l'inventaire.
*   **`404 Not Found`** : Code d'article ou identifiant de fournisseur inconnu.
*   **`409 Conflict`** : Doublon de `codeArticle` ou d'identifiant fiscal de fournisseur.

---

## 7. Règles métier appelées

*   **`BR-STK-001` : Sortie de Stock Automatique basée sur l'Activité**
    *   La validation d'une tâche de nettoyage (`HousekeepingTask` basculée à `CONTROLEE`) appelle de manière asynchrone ou synchrone le service d'inventaire pour décrémenter automatiquement les produits d'accueil (ex : savons, draps jetables) selon une grille d'utilisation indexée sur la capacité théorique de la chambre nettoyée.
*   **`BR-STK-002` : Alerte de Seuil Critique**
    *   Tout mouvement de stock (manuel ou automatique) qui fait descendre `quantitePhysique` en dessous ou au niveau de la valeur de `seuilAlerte` doit obligatoirement basculer l'indicateur `sousSeuilSecurite` à `true` et notifier les responsables pour réapprovisionnement.

---

## 8. ADR concernées

*   **`ADR-004` : Payment & Financial Integrity**
    *   Les comptabilisations d'inventaire physiques utilisent des types décimaux précis de haute performance.
*   **`ADR-005` : Audit & Soft Delete**
    *   Aucun article de stock ni fournisseur ne peut être physiquement effacé de la base de données.

---

## 9. Transactions

L'enregistrement de mouvements de stocks (`POST /api/v1/stock/movements`) requiert l'isolation **`READ COMMITTED`** avec verrouillage d'écriture exclusif (`SELECT FOR UPDATE`) sur l'article d'inventaire visé pour pallier les race conditions d'achats ou de consommations simultanées.
*   **Portée de la transaction :**
    1.  Sélection et verrouillage de la ligne `StockItem`.
    2.  Application de la modification algébrique sur la colonne `quantitePhysique`.
    3.  Vérification du franchissement de seuil (`BR-STK-002`).
    4.  Écriture de la ligne de log historique de mouvement `StockMovement`.
    5.  Émission de l'événement.

---

## 10. Idempotence

Les endpoints de création de mouvements (`POST /api/v1/stock/movements`) acceptent l'en-tête `Idempotency-Key` (obligatoire) afin d'éviter d'additionner ou soustraire à deux reprises la même marchandise en cas de perturbation de la liaison réseau internet.

---

## 11. Audit

Toute modification manuelle d'inventaire ou correction de stock physique est soumise à traçabilité stricte (`BR-AUD-002`) :
*   **Correction :** `"Ajustement d'inventaire manuel de l'article [CODE] par l'utilisateur [USER_ID]. Quantité ajustée : [QTE], Motif : [REASON]"`
*   **Création fournisseur :** `"Création du fournisseur de consommables [NOM] par l'utilisateur [USER_ID]"`

---

## 12. Événements émis

*   `StockLevelUpdatedEvent` : Notifie le dashboard d'inventaire.
*   `StockThresholdAlertEvent` : Déclenché dès le franchissement d'un seuil critique pour inscrire l'article dans la liste d'achats prioritaires.

---

## 13. Performance

*   **Indexation :** Index sur `StockItem(codeArticle)` et `StockMovement(stockItemId, createdAt)`.
*   **Calculs optimisés :** Le calcul automatique du déstockage lié à l'entretien est mutualisé pour s'exécuter en un seul lot d'écritures SQL (Bulk Insert de mouvements de stock).

---

## 14. Sécurité

*   **Sanitization :** Nettoyage obligatoire des motifs et descriptions de mouvements d'ajustement.
*   **Contrôle fiscal des fournisseurs :** L'identifiant fiscal des fiches de fournisseurs est soumis à des règles de validation de format.

---

## 15. Checklist PR

- [ ] Tout mouvement de stock physique de consommables est rigoureusement enregistré via l'entité `StockMovement` de manière transactionnelle.
- [ ] Le calcul d'inventaire descend en-dessous du seuil d'alerte et lève automatiquement l'indicateur d'alerte (`BR-STK-002`).
- [ ] L'en-tête `Idempotency-Key` est exigé et testé lors de la saisie d'un mouvement d'ajustement manuel.
- [ ] Les suppressions physiques (`DELETE` SQL) de fiches fournisseurs ou d'articles de stocks sont totalement proscrites.
- [ ] Un test unitaire confirme la décrémentation automatique basée sur l'activité d'entretien de chambres (`BR-STK-001`).
