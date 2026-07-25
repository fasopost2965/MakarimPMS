# maintenance-api.md — Contrat d'API du Module Maintenance

Ce document spécifie le contrat d'API REST officiel et immuable pour le **Module Maintenance** du Property Management System (PMS) de l'Hôtel Makarim. Il sert de contrat technique de référence pour l'implémentation de la couche de contrôleurs backend et de la couche d'intégration frontend.

---

## 1. Objectif
Le module Maintenance pilote le suivi des dysfonctionnements techniques au sein des infrastructures et des chambres physiques de l'Hôtel Makarim. Il permet de déclarer des incidents, d'affecter des ordres d'intervention, d'automatiser le blocage commercial des chambres sinistrées (`EN_MAINTENANCE`) et de s'assurer de leur nettoyage obligatoire (`A_NETTOYER`) à la suite d'une intervention technique avant leur remise en vente.

---

## 2. Endpoints REST

| Méthode | URI | Description | Rôle Minimum Requis | Version |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/maintenance/tickets` | Lister et filtrer les tickets d'intervention | Maintenance | `v1` |
| **GET** | `/api/v1/maintenance/tickets/{id}` | Consulter le détail technique d'un ticket | Maintenance | `v1` |
| **POST** | `/api/v1/maintenance/tickets` | Créer et ouvrir un nouveau ticket de maintenance | Maintenance | `v1` |
| **PATCH** | `/api/v1/maintenance/tickets/{id}/assign` | Affecter un technicien à un ticket | Maintenance | `v1` |
| **PATCH** | `/api/v1/maintenance/tickets/{id}/resolve` | Déclarer la résolution technique d'un ticket | Maintenance | `v1` |

---

## 3. Permissions RBAC

Chaque requête subit une validation d'accès stricte côté serveur (`BR-TR-004`).

*   **`GET /api/v1/maintenance/tickets`** et **`GET /api/v1/maintenance/tickets/{id}`**
    *   **Rôles autorisés :** Administrateur, Gouvernante, Maintenance. (La réception a un droit de lecture restreint uniquement pour identifier les indisponibilités de chambres).
*   **`POST /api/v1/maintenance/tickets`**
    *   **Rôles autorisés :** Administrateur, Gouvernante, Maintenance. (Permet au personnel d'entretien ou technique de signaler immédiatement une panne).
*   **`PATCH /api/v1/maintenance/tickets/{id}/assign`**
    *   **Rôles autorisés :** Administrateur, Maintenance (Superviseur uniquement).
*   **`PATCH /api/v1/maintenance/tickets/{id}/resolve`**
    *   **Rôles autorisés :** Administrateur, Maintenance. (Le technicien valide la fin des travaux physiques).

---

## 4. Request DTO

### `CreateTicketRequestDTO` (POST `/api/v1/maintenance/tickets`)
```json
{
  "roomId": "string (UUID v4, optionnel si panne hors-chambre)",
  "equipement": "string (requis, max: 100, ex: 'Climatisation')",
  "description": "string (requis, min: 10, max: 1000)",
  "priorite": "string (Enum: 'BASSE', 'MOYENNE', 'HAUTE', 'URGENTE', requis)"
}
```

### `ResolveTicketRequestDTO` (PATCH `/api/v1/maintenance/tickets/{id}/resolve`)
```json
{
  "rapportTechnique": "string (requis, min: 10, max: 1000)",
  "coutMateriel": "number (Decimal, min: 0.00, requis)"
}
```

---

## 5. Response DTO

### `MaintenanceTicketDTO`
```json
{
  "id": "m1b2c3d4-5678-90ab-cdef-1234567890aa",
  "numero": "MNT-2026-0104",
  "room": {
    "id": "a5d8b749-16c2-421d-bf8e-f586e11993cc",
    "numero": "104"
  },
  "equipement": "Climatisation",
  "description": "Fuite de liquide frigorigène au niveau du split mural.",
  "priorite": "URGENTE",
  "status": "EN_COURS",
  "assignee": {
    "id": "e4b1a457-37fb-49d7-bb92-0b89f8174bbc",
    "nom": "El Fassi",
    "prenom": "Mehdi"
  },
  "rapportTechnique": null,
  "coutMateriel": 0.00,
  "startedAt": "2026-07-19T08:00:00Z",
  "resolvedAt": null,
  "createdAt": "2026-07-19T08:00:00Z"
}
```

---

## 6. Codes HTTP

*   **`200 OK`** : Ticket modifié ou résolu avec succès.
*   **`201 Created`** : Ticket d'incident créé avec succès.
*   **`400 Bad Request`** : Erreur de format de données ou description trop courte.
*   **`403 Forbidden`** : Utilisateur non autorisé à modifier les données techniques de maintenance.
*   **`404 Not Found`** : Ticket ou chambre introuvable.
*   **`409 Conflict`** : Tentative d'ouverture de ticket bloquant sur une chambre qui ne peut subir de blocage commercial.

---

## 7. Règles métier appelées

*   **`BR-MNT-001` : Blocage Automatique de Chambre par Ticket**
    *   La création d'un ticket sur une chambre disponible (`LIBRE_PROPRE`, `A_NETTOYER`) doit immédiatement muter son statut en `EN_MAINTENANCE` (si `priorite` est supérieure à `BASSE` et la chambre n'est pas occupée).
*   **`BR-MNT-002` : Libération de Chambre après Résolution**
    *   La résolution d'un ticket de maintenance sur une chambre au statut `EN_MAINTENANCE` doit basculer cette chambre vers le statut **`A_NETTOYER`** (et non directement `LIBRE_PROPRE`), garantissant un passage obligé de désinfection et ménage.
*   **`BR-MNT-003` : Tolérance pour Chambres Occupées**
    *   Si la chambre cible possède un séjour actif (`status = 'OCCUPEE'`), l'ouverture du ticket est validée mais le statut de la chambre **n'est pas** basculé à `EN_MAINTENANCE` afin de préserver l'occupation active en cours.
*   **`BR-MNT-004` : Règle du Ticket Bloquant Majoritaire**
    *   Si une chambre possède 3 tickets actifs ouverts, la résolution de l'un d'eux doit maintenir la chambre en `EN_MAINTENANCE`. Elle ne rebasculera vers `A_NETTOYER` qu'au moment de la résolution du **dernier** ticket actif rattaché.

---

## 8. ADR concernées

*   **`ADR-003` : Room State Machine**
    *   Gestion logicielle robuste et étanche du cycle d'indisponibilité technique des chambres de l'hôtel.
*   **`ADR-006` : RBAC Enforcement**
    *   Isolement et validation serveur des droits du personnel technique de maintenance.

---

## 9. Transactions

La création de ticket et sa résolution s'exécutent au sein de transactions SQL isolées de niveau **`READ COMMITTED`** avec verrouillage de lignes sur les chambres (`SELECT FOR UPDATE`).
*   **Portée de la transaction (Résolution) :**
    1.  Sélection et verrouillage de la ligne `MaintenanceTicket` et de la ligne `Room` cible.
    2.  Validation de la présence d'autres tickets ouverts actifs sur la même chambre.
    3.  Mise à jour du statut du ticket cible à `RESOLU`.
    4.  Si (et seulement si) aucun autre ticket actif n'est ouvert pour cette chambre, mise à jour du statut de la chambre de `EN_MAINTENANCE` vers `A_NETTOYER`.
    5.  Écriture de l'historique dans `RoomStatusLog`.
    6.  Enregistrement éventuel des coûts matériels sous forme de dépense comptable.
    7.  Émission des événements de domaine.

---

## 10. Idempotence

Les résolutions de tickets (`PATCH .../resolve`) sont intrinsèquement idempotentes. Une tentative de résolution sur un ticket déjà résolu retournera immédiatement `200 OK` sans double modification de chambre ou d'historique.

---

## 11. Audit

Toutes les modifications et résolutions de blocages techniques d'infrastructures sont tracées :
*   **Création de ticket bloquant :** `"Ouverture ticket [REF] sur chambre [NUM]. Blocage commercial immédiat de la chambre."`
*   **Résolution finale :** `"Clôture technique ticket [REF]. Chambre [NUM] transmise au Housekeeping pour nettoyage obligatoire."`

---

## 12. Événements émis

*   `MaintenanceTicketCreatedEvent` : Diffusé aux chambres (blocage commercial) et à la Réception (mise à jour des disponibilités).
*   `RoomReleasedFromMaintenanceEvent` : Déclenche immédiatement une tâche de ménage automatique dans le module Housekeeping (`BR-HK-001`).

---

## 13. Performance

*   **Optimisation de requêtes :** Recherche indexée rapide sur les chambres pour identifier les statuts `EN_MAINTENANCE`.
*   **Indexation :** Index sur `MaintenanceTicket(status, roomId)` et `MaintenanceTicket(priorite)`.

---

## 14. Sécurité

*   **Sanitization :** Nettoyage anti-XSS rigoureux sur les descriptions et les rapports de dépannage rédigés par les techniciens.
*   **Plafonds de dépenses :** Le champ `coutMateriel` est borné techniquement en entrée pour empêcher des anomalies de saisie de montants financiers exorbitants.

---

## 15. Checklist PR

- [ ] L'ouverture d'un ticket de priorité supérieure ou égale à `MOYENNE` bascule automatiquement la chambre disponible en `EN_MAINTENANCE`.
- [ ] L'ouverture d'un ticket sur une chambre occupée (`OCCUPEE`) ne modifie pas son statut de chambre (`BR-MNT-003`).
- [ ] La résolution d'un ticket ne libère la chambre vers `A_NETTOYER` que s'il s'agit du tout dernier ticket actif ouvert sur cette chambre (`BR-MNT-004`).
- [ ] La libération d'une chambre après maintenance la bascule en `A_NETTOYER` et non en `LIBRE_PROPRE`.
- [ ] Tous les flux d'écritures de ce module rédigent des traces explicites dans les logs d'historique de chambre (`RoomStatusLog`).
