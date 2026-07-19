# audit-api.md — Contrat d'API du Module Audit & Logs Système

Ce document spécifie le contrat d'API REST officiel et immuable pour le **Module Audit & Logs Système** du Property Management System (PMS) de l'Hôtel Makarim. Il sert de contrat technique de référence pour l'implémentation de la couche de contrôleurs backend et de la couche d'intégration frontend.

---

## 1. Objectif
Le module Audit & Logs Système assure la traçabilité exhaustive, immuable et infalsifiable de toutes les opérations sensibles réalisées au sein du PMS Makarim. Il sert de garde-fou contre la fraude interne, de registre d'intégrité financière et de tableau de contrôle pour l'Administrateur général de l'établissement. Il est couplé à la stratégie globale d'effacement logique (Soft Delete) du système.

---

## 2. Endpoints REST

| Méthode | URI | Description | Rôle Minimum Requis | Version |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/audit/logs` | Consulter et filtrer les traces d'audit système | Administrateur | `v1` |
| **GET** | `/api/v1/audit/logs/{id}` | Consulter le détail d'un événement d'audit spécifique | Administrateur | `v1` |
| **GET** | `/api/v1/audit/logs/export` | Exporter le registre d'audit de sécurité | Administrateur | `v1` |

---

## 3. Permissions RBAC

Chaque requête subit une validation d'accès stricte côté serveur (`BR-TR-004`).

*   **`GET /api/v1/audit/logs`**, **`GET /api/v1/audit/logs/{id}`**, **`GET /api/v1/audit/logs/export`**
    *   **Rôles autorisés :** Administrateur. (Ségrégation totale et absolue : aucun autre rôle de l'établissement — Réception, Gouvernante, Comptable, Maintenance, RH — ne peut appeler ou interroger ces endpoints d'audit).

---

## 4. Request DTO

### `AuditLogsQueryDTO` (GET `/api/v1/audit/logs`)
*   **Query parameters :**
    *   `userId` : `"string (UUID v4, optionnel)"` (Filtrer par l'auteur de l'acte)
    *   `entityName` : `"string (optionnel, ex: 'Reservation', 'FolioLine', 'Guest')"`
    *   `entityId` : `"string (UUID v4, optionnel)"`
    *   `action` : `"string (optionnel, ex: 'ANNULATION_CHARGE', 'BLACKLIST_GUEST')"`
    *   `startDate` : `"YYYY-MM-DD"` (optionnel)
    *   `endDate` : `"YYYY-MM-DD"` (optionnel)
    *   `page` : `"integer (par défaut 1)"`
    *   `limit` : `"integer (par défaut 20)"`

### `AuditExportQueryDTO` (GET `/api/v1/audit/logs/export`)
*   **Query parameters :**
    *   `startDate` : `"YYYY-MM-DD"` (requis)
    *   `endDate` : `"YYYY-MM-DD"` (requis)
    *   `format` : `"PDF"` ou `"EXCEL"` ou `"CSV"` (Enum, requis, `BR-REP-001`)

---

## 5. Response DTO

### `AuditLogDetailDTO`
```json
{
  "id": "a5d8b749-16c2-421d-bf8e-f586e11993cc",
  "timestamp": "2026-07-19T14:35:00Z",
  "userId": "u1a2b3c4-5678-90ab-cdef-1234567890aa",
  "userNom": "El Idrissi",
  "userPrenom": "Fatima",
  "userEmail": "f.elidrissi@makarim.ma",
  "userIp": "196.200.15.42",
  "action": "ANNULATION_CHARGE",
  "entityName": "FolioLine",
  "entityId": "l1a2b3c4-5678-90ab-cdef-1234567890aa",
  "details": "Annulation de la ligne de folio #FOL-2026-0043-A d'un montant de 120.00 MAD. Motif : Saisie erronée, client n'a pas consommé au restaurant.",
  "severity": "SECURITY_WARNING"
}
```

---

## 6. Codes HTTP

*   **`200 OK`** : Listing d'audit, détail ou exportation de registre généré avec succès.
*   **`400 Bad Request`** : Erreur de paramètres de requête (dates incohérentes, filtres incorrects).
*   **`401 Unauthorized`** : Absence de jeton d'authentification ou jeton expiré.
*   **`403 Forbidden`** : Accès strictement refusé (tentative d'accès par tout utilisateur non administrateur).
*   **`404 Not Found`** : Identifiant d'audit log inconnu.

---

## 7. Règles métier appelées

*   **`BR-AUD-001` : Interdiction de Suppression Physique (Soft Delete)**
    *   Le module d'audit suit et certifie que toute désactivation ou effacement logique de données (comme la suppression d'une réservation ou d'un client) a uniquement modifié la colonne `deletedAt` en conservant l'enregistrement physique de base.
*   **`BR-AUD-002` : Journalisation des Opérations Sensibles (Audit Logs)**
    *   Ce module expose les enregistrements créés automatiquement lors du déclenchement des actions identifiées comme sensibles :
        - Annulation d'une charge ou ligne de folio (`BR-FAC-003`).
        - Transfert d'une charge entre folios (`BR-FAC-004`).
        - Réouverture d'un dossier client ou d'un séjour clos.
        - Annulation d'un séjour ou d'une réservation (`BR-RES-002`).
        - Override manuel de tarification de chambre (`BR-CHA-003`).
        - Ajout d'un client en liste noire (`BR-CLI-002`).

---

## 8. ADR concernées

*   **`ADR-005` : Audit & Soft Delete**
    *   Ce module certifie l'adhérence stricte aux invariants de traçabilité et d'immutabilité des journaux de logs d'audit (les lignes d'audit elles-mêmes ne peuvent subir ni modification, ni effacement).
*   **`ADR-006` : RBAC Enforcement**
    *   Sécurisation serveur impénétrable de l'API d'audit.

---

## 9. Transactions

Les lectures et écritures de logs s'exécutent de façon asynchrone par rapport au flux métier principal afin de ne pas ralentir l'expérience utilisateur ou bloquer les transactions financières.
*   **Écriture de log (Asynchrone) :**
    *   Toute opération sensible métier émet un événement.
    *   Le module d'audit capte l'événement de manière non bloquante et l'écrit dans l'entité `AuditLog` dans une transaction isolée de niveau `READ COMMITTED`.
    *   Il est techniquement impossible pour l'application de modifier ou supprimer un enregistrement d'audit (les requêtes `UPDATE` et `DELETE` sur la table `AuditLog` lèvent systématiquement une exception fatale en base de données).

---

## 10. Idempotence

Les endpoints d'audit sont passifs et en lecture seule (`GET`). Ils ne requièrent pas de clé d'idempotence.

---

## 11. Audit

Le module d'audit journalise ses propres événements de haute sécurité :
*   **Consultation d'audit :** `"Accès au registre d'audit système par l'administrateur [ADMIN_ID]"` (Log de niveau sécurité).
*   **Exportation d'audit :** `"Exportation intégrale du registre d'audit système par l'administrateur [ADMIN_ID] au format [FORMAT]"` (Log de niveau sécurité).

---

## 12. Événements émis

Aucun (il s'agit du récepteur universel de logs de l'application).

---

## 13. Performance

*   **Écritures asynchrones :** Les écritures d'audit logs sont découplées des transactions de bases de données principales par un système de file d'attente en mémoire ou de processus légers en arrière-plan.
*   **Indexation obligatoire :** Index physiques sur `AuditLog(timestamp)`, `AuditLog(userId)`, et `AuditLog(entityName, entityId)` pour optimiser le filtrage rapide.

---

## 14. Sécurité

*   **Immutabilité physique :** L'impossibilité de modifier ou d'effacer des lignes de log est sécurisée par des privilèges de base de données (pas de permission `UPDATE` ni `DELETE` accordée au compte applicatif standard sur la table `AuditLog`).
*   **Données masquées :** Enregistrement des adresses IP des auteurs d'actes pour la sécurité informatique, en masquant les données de cartes bancaires et les mots de passe.

---

## 15. Checklist PR

- [ ] La table `AuditLog` est strictement protégée contre l'effacement logique ou physique. Aucun endpoint de modification/suppression n'existe.
- [ ] Tout déclenchement d'une opération sensible (règles `BR-AUD-002`) génère de manière vérifiée une ligne de log détaillée contenant l'utilisateur, l'action, l'entité, l'identifiant et une justification.
- [ ] Le filtrage des logs d'audit supporte la recherche rapide par utilisateur ou par entité d'origine.
- [ ] L'extraction d'audit est exclusivement restreinte à l'Administrateur général et couverte par un test de rôle.
- [ ] Les adresses IP d'origine sont capturées, nettoyées et validées côté serveur lors de l'écriture du log.
