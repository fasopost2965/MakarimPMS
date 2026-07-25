# rooms-api.md — Contrat d'API du Module Chambres (Rooms)

Ce document spécifie le contrat d'API REST officiel et immuable pour le **Module Chambres (Rooms)** du Property Management System (PMS) de l'Hôtel Makarim. Il sert de contrat technique de référence pour l'implémentation de la couche de contrôleurs backend et de la couche d'intégration frontend.

---

## 1. Objectif
Le module Chambres gère l'inventaire physique des chambres de l'Hôtel Makarim. Il maintient en temps réel la machine à états stricte régissant la disponibilité commerciale, l'occupation opérationnelle, et l'état technique de chaque chambre physique. Il assure que seuls les espaces certifiés « Propres » (`LIBRE_PROPRE`) puissent être mis en vente ou attribués aux clients.

---

## 2. Endpoints REST

| Méthode | URI | Description | Rôle Minimum Requis | Version |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/rooms` | Lister les chambres physiques et filtrer par statut ou type | Réception | `v1` |
| **GET** | `/api/v1/rooms/{id}` | Consulter le détail et les caractéristiques d'une chambre | Réception | `v1` |
| **PATCH** | `/api/v1/rooms/{id}/status` | Muter manuellement le statut d'une chambre | Gouvernante | `v1` |
| **GET** | `/api/v1/rooms/{id}/history` | Consulter l'historique des changements de statut d'une chambre | Réception | `v1` |
| **GET** | `/api/v1/room-types` | Lister et consulter les catégories de chambres de l'hôtel | Réception | `v1` |

---

## 3. Permissions RBAC

Chaque requête subit une validation d'accès stricte côté serveur (`BR-TR-004`).

*   **`GET /api/v1/rooms`**, **`GET /api/v1/rooms/{id}`**, **`GET /api/v1/room-types`**
    *   **Rôles autorisés :** Administrateur, Réception, Gouvernante, Maintenance (Lecture uniquement).
*   **`GET /api/v1/rooms/{id}/history`**
    *   **Rôles autorisés :** Administrateur, Réception, Gouvernante.
*   **`PATCH /api/v1/rooms/{id}/status`**
    *   **Rôles autorisés :** Administrateur, Réception, Gouvernante.
    *   **Contrôle contextuel :**
        *   La *Réception* ne peut forcer un statut qu'en cas de besoin exceptionnel et justifié au comptoir (`BR-CHA-003`).
        *   La *Gouvernante* possède les pleins droits opérationnels de modification d'état (validation des nettoyages).
        *   Le personnel de *Maintenance* n'utilise pas cet endpoint directement ; le statut `EN_MAINTENANCE` est géré automatiquement par le module de tickets.

---

## 4. Request DTO

### `UpdateRoomStatusDTO` (PATCH `/api/v1/rooms/{id}/status`)
```json
{
  "status": "string (Enum: 'LIBRE_PROPRE', 'A_NETTOYER', 'EN_NETTOYAGE', 'EN_MAINTENANCE', requis)",
  "reason": "string (min: 10, max: 250, requis)"
}
```

---

## 5. Response DTO

### `RoomDetailDTO`
```json
{
  "id": "a5d8b749-16c2-421d-bf8e-f586e11993cc",
  "numero": "104",
  "etage": 1,
  "roomType": {
    "id": "f5b8a147-86c2-431d-bf8e-c586e11995aa",
    "nom": "Chambre Double Standard",
    "capaciteMax": 2
  },
  "status": "LIBRE_PROPRE",
  "notes": "Près de l'ascenseur",
  "createdAt": "2026-07-19T04:30:00Z"
}
```

### `RoomStatusLogDTO`
```json
{
  "id": "e4b1a457-37fb-497d-bb92-0b89f8174abc",
  "roomId": "a5d8b749-16c2-421d-bf8e-f586e11993cc",
  "oldStatus": "A_NETTOYER",
  "newStatus": "EN_NETTOYAGE",
  "userId": "u1a2b3c4-5678-90ab-cdef-1234567890aa",
  "userNom": "El Idrissi",
  "userPrenom": "Fatima",
  "reason": "Début nettoyage quotidien",
  "timestamp": "2026-07-19T09:15:00Z"
}
```

---

## 6. Codes HTTP

*   **`200 OK`** : Statut modifié avec succès ou données d'inventaire récupérées.
*   **`400 Bad Request`** : Statut demandé invalide ou non conforme à la machine à états.
*   **`403 Forbidden`** : Utilisateur non autorisé à modifier l'état physique de la chambre.
*   **`404 Not Found`** : Identifiant de chambre inconnu.
*   **`409 Conflict`** : Blocage car une chambre ne peut pas passer manuellement en `LIBRE_PROPRE` si une tâche de ménage ou de maintenance est en cours et non validée.

---

## 7. Règles métier appelées

*   **`BR-CHA-001` : Unicité des Numéros de Chambre**
    *   Validée lors de la configuration initiale de l'inventaire.
*   **`BR-CHA-002` : Invariant des États de Chambre**
    *   La chambre est rigoureusement et exclusivement assignée à l'un des 7 états autorisés (`LIBRE_PROPRE`, `RESERVEE`, `OCCUPEE`, `DEPART_PREVU`, `A_NETTOYER`, `EN_NETTOYAGE`, `EN_MAINTENANCE`).
*   **`BR-CHA-003` : Vente Interdite hors Disponible Propre**
    *   L'infrastructure d'allocation de chambres au check-in requiert impérativement l'état `LIBRE_PROPRE` (ou `RESERVEE` pour l'arrivée assignée).
*   **`BR-CHA-004` : Historique Obligatoire des Changements d'État**
    *   Tout changement d'état via `PATCH` doit automatiquement engendrer une ligne dans `RoomStatusLog`.

---

## 8. ADR concernées

*   **`ADR-003` : Room State Machine**
    *   Le changement d'état de chambre est strictement balisé par une machine à états logicielle interdisant les transitions aberrantes (ex: passage direct d'`OCCUPEE` à `LIBRE_PROPRE` sans passer par `A_NETTOYER`).
*   **`ADR-005` : Audit & Soft Delete**
    *   Aucune suppression physique de chambre n'est autorisée.

---

## 9. Transactions

La mutation de statut d'une chambre physique doit être atomique et s'exécuter dans une transaction isolée de niveau **`READ COMMITTED`** dotée d'un verrouillage d'écriture sur la ligne de chambre (`SELECT FOR UPDATE`).
*   **Portée de la transaction :**
    1.  Sélection et verrouillage de la chambre.
    2.  Validation de la transition demandée contre la machine à états.
    3.  Mise à jour de la colonne `status` de la table `Room`.
    4.  Insertion immédiate de la ligne d'historique `RoomStatusLog`.
    5.  Émission de l'événement de domaine.

---

## 10. Idempotence

Les requêtes `PATCH /api/v1/rooms/{id}/status` sont intrinsèquement idempotentes si la valeur cible demandée est identique à la valeur actuelle en base de données (le système renverra `200 OK` sans générer de log doublonné d'historique).

---

## 11. Audit

*   Tout changement d'état de chambre écrit une trace technique de traçabilité dans la table d'historique `RoomStatusLog`.
*   Les transitions forcées par la Réception ou l'Administrateur génèrent en outre un log de niveau sécurité dans `AuditLog` : `"Override manuel du statut de la chambre [NUM] vers [STATUS] par l'utilisateur [USER_ID]. Justification : [REASON]"`.

---

## 12. Événements émis

*   `RoomStatusChangedEvent` : Diffusé aux modules Réservations (pour débloquer la vente), Housekeeping (pour adapter le plan de ménage) et Dashboard.

---

## 13. Performance

*   **Indexation :** Index composite sur `Room(numero)` et `Room(status)`.
*   **Cache :** L'endpoint `GET /api/v1/room-types` (statique) est mis en cache applicatif pendant 1 heure pour soulager la base de données.

---

## 14. Sécurité

*   **Sanitization :** Nettoyage obligatoire du champ textuel `reason` contre les injections de scripts (XSS).
*   **Validation de la machine à états :** Validation logicielle implémentant un garde-fou inviolable côté serveur pour empêcher la désactivation d'alertes de sécurité ou de chambres en maintenance technique.

---

## 15. Checklist PR

- [ ] Tout changement de statut de chambre via l'API génère systématiquement et de manière transactionnelle un enregistrement dans la table `RoomStatusLog`.
- [ ] La transition de statut est contrôlée côté serveur et rejette les états inexistants dans l'énumération officielle.
- [ ] Un test d'intégration confirme qu'une chambre au statut `A_NETTOYER` ou `EN_MAINTENANCE` est refusée pour un processus de Check-in.
- [ ] Le motif de changement de statut est requis et validé en longueur (10+ caractères).
- [ ] Les endpoints de listing supportent un filtre de statut rapide.
