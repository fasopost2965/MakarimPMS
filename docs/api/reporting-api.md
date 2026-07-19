# reporting-api.md — Contrat d'API du Module Reporting (Rapports)

Ce document spécifie le contrat d'API REST officiel et immuable pour le **Module Reporting (Rapports)** du Property Management System (PMS) de l'Hôtel Makarim. Il sert de contrat technique de référence pour l'implémentation de la couche de contrôleurs backend et de la couche d'intégration frontend.

---

## 1. Objectif
Le module Reporting extrait, compile et formalise les indicateurs de performance commerciale, d'exploitation hôtelière et de présence RH de l'Hôtel Makarim. Il offre des indicateurs en temps réel pour alimenter le Dashboard d'exploitation de la direction et génère les fichiers réglementaires de police exigés par la législation marocaine sur l'hébergement hôtelier.

---

## 2. Endpoints REST

| Méthode | URI | Description | Rôle Minimum Requis | Version |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/reporting/dashboard-metrics` | Récupérer les KPIs consolidés du jour pour le Dashboard | Réception | `v1` |
| **GET** | `/api/v1/reporting/occupancy-rates` | Analyser l'évolution historique des taux d'occupation | Comptable | `v1` |
| **GET** | `/api/v1/reporting/revenue-by-channel` | Récupérer le volume du CA ventilé par canal d'origine | Comptable | `v1` |
| **GET** | `/api/v1/reporting/police-report` | Exporter les fiches de police du jour (Réglementation Marocaine) | Réception | `v1` |

---

## 3. Permissions RBAC

Chaque requête subit une validation d'accès stricte côté serveur (`BR-TR-004`).

*   **`GET /api/v1/reporting/dashboard-metrics`**
    *   **Rôles autorisés :** Administrateur, Réception, Comptable. (La réception consulte cet écran pour suivre le flux quotidien d'arrivées et départs).
*   **`GET /api/v1/reporting/occupancy-rates`** et **`GET /api/v1/reporting/revenue-by-channel`**
    *   **Rôles autorisés :** Administrateur, Comptable. (Données analytiques stratégiques confidentielles).
*   **`GET /api/v1/reporting/police-report`**
    *   **Rôles autorisés :** Administrateur, Réception. (La Réception doit obligatoirement pouvoir extraire le relevé des clients présents pour transmission quotidienne aux autorités territoriales de Tétouan).

---

## 4. Request DTO

### `MetricsQueryDTO` (GET `/api/v1/reporting/occupancy-rates` et `/revenue-by-channel`)
*   **Query parameters :**
    *   `startDate` : `"YYYY-MM-DD"` (requis)
    *   `endDate` : `"YYYY-MM-DD"` (requis)
    *   `format` : `"PDF"` ou `"EXCEL"` ou `"CSV"` (Enum, optionnel. Si présent, déclenche l'exportation formelle, `BR-REP-001`).

### `PoliceReportQueryDTO` (GET `/api/v1/reporting/police-report`)
*   **Query parameters :**
    *   `date` : `"YYYY-MM-DD"` (requis)
    *   `format` : `"PDF"` ou `"CSV"` (requis)

---

## 5. Response DTO

### `DashboardMetricsDTO`
```json
{
  "date": "2026-07-19",
  "tauxOccupationPourcentage": 85.71,
  "mouvements": {
    "arriveesPrevuesNombre": 8,
    "arriveesRealiseesNombre": 6,
    "departsPrevusNombre": 4,
    "departsRealisesNombre": 4
  },
  "chambresEtats": {
    "librePropreNombre": 12,
    "occupeeNombre": 24,
    "aNettoyerNombre": 3,
    "enMaintenanceNombre": 1
  },
  "chiffreAffairesEstimeAujourdhui": {
    "montantTTC": 31200.00,
    "devise": "MAD"
  }
}
```

### `RevenueByChannelDTO`
```json
{
  "periode": {
    "debut": "2026-07-01",
    "fin": "2026-07-19"
  },
  "caTotalHT": 230000.00,
  "partitionCanaux": [
    {
      "canal": "DIRECT",
      "montantHT": 138000.00,
      "pourcentage": 60.00
    },
    {
      "canal": "BOOKING_COM",
      "montantHT": 69000.00,
      "pourcentage": 30.00
    },
    {
      "canal": "WALK_IN",
      "montantHT": 23000.00,
      "pourcentage": 10.00
    }
  ]
}
```

---

## 6. Codes HTTP

*   **`200 OK`** : Compilation des indicateurs ou export de fichier complété avec succès.
*   **`400 Bad Request`** : Paramètres de filtre temporels incohérents (dates inversées).
*   **`403 Forbidden`** : Rôle non autorisé à extraire des rapports sensibles d'exploitation.
*   **`422 Unprocessable Entity`** : Erreur de compilation car des fiches d'identité sont incomplètes pour la transmission de police réglementaire (`BR-CLI-003`).

---

## 7. Règles métier appelées

*   **`BR-RES-003` : Origine de Réservation Obligatoire**
    *   La ventilation analytique des revenus s'appuie rigoureusement sur le champ `canal` stocké en base de données.
*   **`BR-REP-001` : Diversité des Formats d'Exportation**
    *   Prise en charge obligatoire des sorties PDF, Excel / XLSX et CSV pour l'ensemble des données d'extraction du module.
*   **`BR-REP-002` : Métriques Clés du Dashboard d'Exploitation**
    *   Exigence d'affichage en temps réel du taux d'occupation, des volumes d'arrivées/départs programmés et du CA cumulé par canal de vente.
*   **`BR-CLI-003` : Enregistrement Obligatoire des Pièces d'Identité**
    *   Le rapport de police quotidienne requiert l'exhaustivité des noms, prénoms, nationalités, types et numéros de pièces d'identité de l'ensemble des clients physiques hébergés à la date spécifiée.

---

## 8. ADR concernées

*   **`ADR-001` : Stay-Centric Architecture**
    *   Les statistiques d'occupation se calculent à partir de l'entité active `Stay` (Séjour) et de la table d'occupation `RoomNight`, et non à partir des simples planifications de réservations.
*   **`ADR-004` : Payment & Financial Integrity**
    *   Tous les indicateurs financiers d'agrégation utilisent des calculs décimaux de haute performance.

---

## 9. Transactions

Les lectures analytiques s'exécutent en mode non bloquant sous isolation **`READ COMMITTED`** avec l'attribut de transaction en lecture seule (`ReadOnly`) pour optimiser la réactivité du moteur SQL.

---

## 10. Idempotence

Les endpoints d'exportation de rapports statiques passés tirent parti de la mise en cache HTTP (E-Tag ou cache CDN/Redis) pour accélérer le chargement des données figées déjà calculées historiquement.

---

## 11. Audit

Toute extraction de données CRM ou d'exports légaux de police est enregistrée dans les traces de sécurité (`BR-AUD-002`) :
*   **Export police :** `"Exportation réglementaire des fiches de police du [DATE] par l'utilisateur [USER_ID] au format [FORMAT]."`
*   **Rapports financiers :** `"Consultation des ratios de CA de l'établissement par l'utilisateur [USER_ID]."`

---

## 12. Événements émis

Aucun événement de domaine n'est émis par ce module de consultation passive (il s'agit d'un récepteur asynchrone des faits générateurs survenus dans les autres domaines du PMS).

---

## 13. Performance

*   **Vues matérialisées / Index composites :** Pour éviter le ralentissement du système lors d'extractions sur de longues périodes, des index composites physiques sont implémentés sur les dates d'arrivées et départs.
*   **Pagination obligatoire** sur les listings bruts d'indicateurs de séjours historiques.

---

## 14. Sécurité

*   **Masquage des informations d'identité :** L'exportation de police est soumise à des protocoles de transmission étanches (pas d'exposition publique des listes d'identités).
*   **Protection contre le scraping :** Rate limiting strict imposé sur l'ensemble des endpoints analytiques.

---

## 15. Checklist PR

- [ ] L'affichage du Dashboard d'exploitation correspond exactement aux 3 métriques obligatoires de la règle `BR-REP-002`.
- [ ] L'extraction de fiches de police s'assure de l'exhaustivité des données d'identité marocaines requises (`BR-CLI-003`).
- [ ] Les exports analytiques de ventes supportent sans bug les formats PDF, Excel, et CSV (`BR-REP-001`).
- [ ] Toutes les requêtes d'agrégation financière du Reporting sont optimisées pour s'exécuter en moins de **50ms** en base de données.
- [ ] Les requêtes de reporting s'effectuent en transaction de lecture seule (`ReadOnly`).
