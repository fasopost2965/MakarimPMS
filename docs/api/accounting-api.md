# accounting-api.md — Contrat d'API du Module Comptabilité

Ce document spécifie le contrat d'API REST officiel et immuable pour le **Module Comptabilité** du Property Management System (PMS) de l'Hôtel Makarim. Il sert de contrat technique de référence pour l'implémentation de la couche de contrôleurs backend et de la couche d'intégration frontend.

---

## 1. Objectif
Le module Comptabilité consolide les écritures de ventes (factures et avoirs), gère le journal des charges d'exploitation (dépenses) et prépare les exports fiscaux nécessaires aux déclarations réglementaires de l'Hôtel Makarim. Il assure une séparation stricte entre les activités d'accueil (réception) et la gestion des comptes financiers, garantissant l'exactitude des calculs de TVA et de taxes hôtelières.

---

## 2. Endpoints REST

| Méthode | URI | Description | Rôle Minimum Requis | Version |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/accounting/expenses` | Lister et filtrer les dépenses de fonctionnement | Comptable | `v1` |
| **POST** | `/api/v1/accounting/expenses` | Enregistrer une nouvelle dépense | Comptable | `v1` |
| **GET** | `/api/v1/accounting/revenue-consolidation` | Récupérer la ventilation fiscale du CA sur une période | Comptable | `v1` |
| **GET** | `/api/v1/accounting/export` | Exporter les journaux comptables de ventes ou d'achats | Comptable | `v1` |

---

## 3. Permissions RBAC

Chaque requête subit une validation d'accès stricte côté serveur (`BR-TR-004`).

*   **`GET /api/v1/accounting/expenses`**, **`POST /api/v1/accounting/expenses`**, **`GET /api/v1/accounting/revenue-consolidation`**, **`GET /api/v1/accounting/export`**
    *   **Rôles autorisés :** Administrateur, Comptable. (Isolement total : les rôles Réception, Gouvernante, Maintenance, RH n'ont aucun accès à ces endpoints financiers).

---

## 4. Request DTO

### `CreateExpenseDTO` (POST `/api/v1/accounting/expenses`)
```json
{
  "categorie": "string (Enum: 'fournisseurs', 'salaires', 'énergie', 'maintenance', 'abonnements', requis)",
  "libelle": "string (requis, max: 200)",
  "montantHT": "number (Decimal, requis, min: 0.01)",
  "tvaMontant": "number (Decimal, requis, min: 0.00)",
  "montantTTC": "number (Decimal, requis, min: 0.01)",
  "dateDépense": "string (Date ISO-8601 YYYY-MM-DD, requis)",
  "justificatifRef": "string (max: 100, optionnel)"
}
```

### `RevenueConsolidationQueryDTO` (GET `/api/v1/accounting/revenue-consolidation`)
*   **Query parameters :**
    *   `startDate` : `"YYYY-MM-DD"` (requis)
    *   `endDate` : `"YYYY-MM-DD"` (requis)

### `AccountingExportQueryDTO` (GET `/api/v1/accounting/export`)
*   **Query parameters :**
    *   `startDate` : `"YYYY-MM-DD"` (requis)
    *   `endDate` : `"YYYY-MM-DD"` (requis)
    *   `journal` : `"ventes"` ou `"achats"` (requis)
    *   `format` : `"PDF"` ou `"EXCEL"` ou `"CSV"` (Enum, requis, `BR-REP-001`)

---

## 5. Response DTO

### `ExpenseDetailDTO`
```json
{
  "id": "e5d8b749-36c2-411d-bf8e-f586e11995bb",
  "categorie": "énergie",
  "libelle": "Facture électricité RADEEF - Juillet 2026",
  "montantHT": 12500.00,
  "tvaMontant": 1750.00,
  "montantTTC": 14250.00,
  "dateDépense": "2026-07-15",
  "justificatifRef": "RAD-2026-07-009",
  "createdAt": "2026-07-19T04:30:00Z"
}
```

### `RevenueConsolidationDTO`
```json
{
  "periode": {
    "debut": "2026-07-01",
    "fin": "2026-07-31"
  },
  "caBrutTTC": 254200.00,
  "caNetHT": 230000.00,
  "ventilationHT": {
    "hebergementHT": 200000.00,
    "extrasHT": 30000.00
  },
  "ventilationTVA": {
    "tvaHebergement10": 20000.00,
    "tvaExtras20": 6000.00
  },
  "collectes": {
    "taxeSejourTotal": 4200.00
  },
  "facturesEmisesNombre": 120,
  "avoirsEmisNombre": 2,
  "avoirsTotalTTC": 2400.00
}
```

---

## 6. Codes HTTP

*   **`200 OK`** : Consolidation ou export de fichier traité avec succès.
*   **`201 Created`** : Écriture de dépense enregistrée avec succès.
*   **`400 Bad Request`** : Données d'entrée erronées (catégorie invalide, dates incohérentes).
*   **`403 Forbidden`** : Accès refusé pour rôle insuffisant (ex. tentative d'export par la Réception).
*   **`404 Not Found`** : Justificatif ou ressource non trouvé.

---

## 7. Règles métier appelées

*   **`BR-COM-001` : Consolidation des Dépenses par Catégorie**
    *   Toute charge enregistrée (`Expense`) doit être affectée exclusivement à l'une des catégories : `fournisseurs`, `salaires`, `énergie`, `maintenance`, ou `abonnements`.
*   **`BR-COM-002` : Imputation Fiscale du Chiffre d'Affaires**
    *   La consolidation comptable filtre uniquement les factures officiellement émises (`EMISE`) et déduit les avoirs associés, en ventilant de façon étanche le HT, la TVA Hébergement (10%), la TVA Extras (20%), et la taxe de séjour (collectée à part).
*   **`BR-REP-001` : Diversité des Formats d'Exportation**
    *   Le backend doit être capable de compiler le flux de sortie en PDF, Excel / XLSX, et CSV selon le paramètre `format`.

---

## 8. ADR concernées

*   **`ADR-004` : Payment & Financial Integrity**
    *   Calculs en types décimaux de haute précision. Devise impérativement en MAD.
*   **`ADR-005` : Audit & Soft Delete**
    *   Aucun enregistrement comptable de vente ou d'achat ne peut être physiquement effacé.

---

## 9. Transactions

La création de dépenses s'exécute dans des transactions standard de niveau d'isolation **`READ COMMITTED`**. L'extraction de données à des fins de consolidation fiscale s'effectue en lecture seule (`ReadOnly`) avec un niveau d'isolation garantissant la stabilité des données.

---

## 10. Idempotence

Les exports de fichiers comptables (`GET /api/v1/accounting/export`) utilisent des en-têtes HTTP de mise en cache pour éviter la régénération redondante et coûteuse de gros volumes de données si les dates de période ciblée n'ont pas enregistré de nouvelles écritures.

---

## 11. Audit

Toute modification de la configuration fiscale ou tout export massif de données comptables sensibles génère une écriture d'audit (`BR-AUD-002`) :
*   **Export :** `"Exportation comptable du Journal [JOURNAL] au format [FORMAT] pour la période [DEBUT] au [FIN] par l'utilisateur [USER_ID]"` (Log de niveau sécurité).
*   **Enregistrement de charge :** `"Enregistrement d'une dépense d'exploitation de catégorie [CATEGORIE] pour un montant de [MONTANT] TTC. Réf: [JUSTIFICATIF]"`

---

## 12. Événements émis

*   `ExpenseRegisteredEvent` : Publié pour rajustement instantané des bilans d'exploitation et de trésorerie sur le tableau de bord de gestion.

---

## 13. Performance

*   **Aggregation Performance :** Le calcul de consolidation du CA s'appuie sur des requêtes SQL optimisées contenant des agrégations natives (`SUM`, `COUNT`) plutôt que de charger les objets individuels en mémoire backend.
*   **Indexation :** Index indispensables sur `Invoice(issuedAt, status)` et `Expense(dateDépense, categorie)`.

---

## 14. Sécurité

*   **Sécurisation des fichiers générés :** Les exports PDF et Excel temporaires créés sur le serveur sont stockés dans des dossiers sécurisés à accès restreint et purgés automatiquement après téléchargement.
*   **Isolement réseau :** Les endpoints de consolidation ne transmettent aucun identifiant personnel d'employés ou d'informations d'identité de clients non requis par le fisc.

---

## 15. Checklist PR

- [ ] L'insertion de dépense rejette toute catégorie non présente dans l'énumération officielle de la règle `BR-COM-001`.
- [ ] Les calculs d'agrégation de TVA (10% et 20%) et de taxes de séjour sont mathématiquement exacts, s'appuient sur des types Décimaux et sont couverts par des tests unitaires d'intégrité.
- [ ] Les flux d'exportation de journaux comptables gèrent proprement les trois formats obligatoires : PDF, Excel, et CSV.
- [ ] Aucun endpoint de mise à jour ou de suppression physique n'est exposé pour les factures ou écritures fiscales consolidées.
