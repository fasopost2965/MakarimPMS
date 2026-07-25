# housekeeping-api.md — Contrat d'API du Module Housekeeping (Ménage)

Ce document spécifie le contrat d'API REST officiel et immuable pour le **Module Housekeeping (Ménage)** du Property Management System (PMS) de l'Hôtel Makarim. Il sert de contrat technique de référence pour l'implémentation de la couche de contrôleurs backend et de la couche d'intégration frontend.

---

## 1. Objectif
Le module Housekeeping coordonne le nettoyage, la remise en état et le contrôle qualité des chambres physiques de l'Hôtel Makarim. Il expose des interfaces hautement simplifiées et mobiles pour les équipiers de ménage, et des tableaux de bord de suivi pour la Gouvernante générale. Il automatise également le déstockage des consommables d'accueil lors de la certification finale de propreté.

---

## 2. Endpoints REST

| Méthode | URI | Description | Rôle Minimum Requis | Version |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/housekeeping/tasks` | Lister et filtrer les tâches de ménage actives | Gouvernante | `v1` |
| **GET** | `/api/v1/housekeeping/my-tasks` | Lister les tâches de l'équipier connecté | Gouvernante | `v1` |
| **POST** | `/api/v1/housekeeping/tasks/{id}/assign` | Assigner une tâche de ménage à un équipier | Gouvernante | `v1` |
| **PATCH** | `/api/v1/housekeeping/tasks/{id}/start` | Démarrer une tâche (A_FAIRE ➔ EN_COURS) | Gouvernante | `v1` |
| **PATCH** | `/api/v1/housekeeping/tasks/{id}/finish` | Finaliser le ménage (EN_COURS ➔ TERMINEE) | Gouvernante | `v1` |
| **PATCH** | `/api/v1/housekeeping/tasks/{id}/validate` | Valider le contrôle qualité (TERMINEE ➔ CONTROLEE) | Gouvernante | `v1` |

---

## 3. Permissions RBAC

Chaque requête subit une validation d'accès stricte côté serveur (`BR-TR-004`).

*   **`GET /api/v1/housekeeping/tasks`** et **`POST /api/v1/housekeeping/tasks/{id}/assign`**
    *   **Rôles autorisés :** Administrateur, Gouvernante. (La réception n'a pas accès à la répartition technique des tâches).
*   **`GET /api/v1/housekeeping/my-tasks`**
    *   **Rôles autorisés :** Administrateur, Gouvernante. (Ce endpoint sert d'interface simplifiée d'extraction des tâches affectées à l'utilisateur connecté).
*   **`PATCH /api/v1/housekeeping/tasks/{id}/start`** et **`PATCH /api/v1/housekeeping/tasks/{id}/finish`**
    *   **Rôles autorisés :** Administrateur, Gouvernante. (Les équipiers de ménage doivent posséder le rôle fonctionnel *Gouvernante* restreint pour exécuter ces actions).
*   **`PATCH /api/v1/housekeeping/tasks/{id}/validate`**
    *   **Rôles autorisés :** Administrateur, Gouvernante. (Seule la Gouvernante générale de l'établissement ou l'Administrateur peut certifier le contrôle de la chambre).

---

## 4. Request DTO

### `AssignTaskDTO` (POST `/api/v1/housekeeping/tasks/{id}/assign`)
```json
{
  "employeeId": "string (UUID v4, requis)",
  "priorite": "string (Enum: 'BASSE', 'MOYENNE', 'HAUTE', requis)"
}
```

---

## 5. Response DTO

### `HousekeepingTaskDTO`
```json
{
  "id": "h5b8a147-36c2-411d-bf8e-f586e11995aa",
  "room": {
    "id": "a5d8b749-16c2-421d-bf8e-f586e11993cc",
    "numero": "104",
    "status": "EN_NETTOYAGE"
  },
  "assignee": {
    "id": "e4b1a457-37fb-49d7-bb92-0b89f8174bbc",
    "nom": "Ait Oufkir",
    "prenom": "Rachid"
  },
  "status": "EN_COURS",
  "priorite": "HAUTE",
  "startedAt": "2026-07-19T09:30:00Z",
  "finishedAt": null,
  "validatedAt": null,
  "validatedById": null,
  "createdAt": "2026-07-19T11:00:00Z"
}
```

---

## 6. Codes HTTP

*   **`200 OK`** : Statut de la tâche modifié avec succès.
*   **`400 Bad Request`** : Transition de tâche invalide ou utilisateur cible non affectable.
*   **`403 Forbidden`** : Droits insuffisants (ex. un équipier essayant de valider sa propre tâche via l'endpoint de contrôle).
*   **`404 Not Found`** : Tâche de ménage inexistante.
*   **`422 Unprocessable Entity`** : Stock insuffisant pour exécuter la sortie automatique de stock associée à la validation (`BR-STK-001`).

---

## 7. Règles métier appelées

*   **`BR-CHA-002` : Invariant des États de Chambre**
    *   Vérification et mise à jour de la colonne `status` de la chambre physique associée.
*   **`BR-HK-001` : Déclenchement Automatique par Checkout**
    *   Une tâche `A_FAIRE` doit être générée automatiquement sans saisie manuelle lors du Check-out du séjour.
*   **`BR-HK-002` : Transitions Contrôlées de Tâches de Ménage**
    *   Respect strict du flux séquentiel : `A_FAIRE` ➔ `EN_COURS` ➔ `TERMINEE` ➔ `CONTROLEE`.
*   **`BR-HK-003` : Rétablissement du Statut Chambre Propre**
    *   La validation (`PATCH .../validate`) fait basculer de manière transactionnelle l'état de la chambre de `A_NETTOYER` ou `EN_NETTOYAGE` vers `LIBRE_PROPRE`. Le statut `TERMINEE` maintient la chambre à l'état `EN_NETTOYAGE` ou `A_NETTOYER`.
*   **`BR-HK-004` : Ségrégation d'Accès de l'Écran Gouvernante**
    *   L'affichage mobile (`GET /api/v1/housekeeping/my-tasks`) ne retourne aucune métadonnée financière ou client.
*   **`BR-STK-001` : Sortie de Stock Automatique basée sur l'Activité**
    *   La transition finale vers `CONTROLEE` doit déclencher la décrémentation automatique des quantités de produits d'accueil en stock.

---

## 8. ADR concernées

*   **`ADR-003` : Room State Machine**
    *   Les mutations de chambre induites par les actions de ménage respectent la machine à états.
*   **`ADR-006` : RBAC Enforcement**
    *   Protection serveur des endpoints sensibles d'assignation et de validation.

---

## 9. Transactions

La validation finale du contrôle qualité d'une tâche de ménage (`PATCH .../validate`) s'exécute dans une transaction de base de données à haut niveau d'isolation **`READ COMMITTED`** avec verrouillage d'écriture pessimiste (`SELECT FOR UPDATE`) sur les stocks et les chambres.
*   **Portée de la transaction :**
    1.  Verrouillage en écriture de la ligne `HousekeepingTask` et de la ligne `Room`.
    2.  Vérification de l'état (doit être `TERMINEE`).
    3.  Mise à jour du statut de la tâche vers `CONTROLEE`.
    4.  Mise à jour du statut de la chambre associée vers `LIBRE_PROPRE`.
    5.  Écriture de l'historique dans `RoomStatusLog`.
    6.  Calcul théorique des consommables selon la capacité de la chambre.
    7.  Vérification et décrémentation des stocks physiques dans `StockItem`.
    8.  Création des lignes de mouvements de stock `StockMovement`.
    9.  Émission de l'événement.

---

## 10. Idempotence

Les endpoints d'avancement de statut (`PATCH /start`, `PATCH /finish`, `PATCH /validate`) sont idempotents. Si la tâche possède déjà le statut cible, le serveur renvoie `200 OK` sans altérer l'état comptable des stocks ou générer de doublons d'historiques.

---

## 11. Audit

Toute validation manuelle de ménage ou tout override de statut de tâche est enregistré :
*   **Validation :** `"Validation de propreté de la chambre [NUM]. Tâche de ménage [ID] certifiée par la Gouvernante [USER_ID]"` (Log de niveau opérationnel).
*   **Override :** `"Override manuel de la tâche [ID] par l'administrateur [ADMIN_ID]"` (Log de niveau sécurité).

---

## 12. Événements émis

*   `HousekeepingTaskStartedEvent` : Publié lors de la prise en charge de la chambre.
*   `HousekeepingTaskFinishedEvent` : Notifie la gouvernance pour inspection.
*   `HousekeepingTaskValidatedEvent` : Notifie la Réception (chambre vendable) et le module Stocks (décrémentation finalisée).

---

## 13. Performance

*   **Lazy Loading :** L'endpoint mobile `GET /api/v1/housekeeping/my-tasks` est optimisé pour ne retourner que les champs indispensables afin de limiter le trafic réseau sur terminaux mobiles.
*   **Indexation :** Index sur `HousekeepingTask(status, assigneeId)`.

---

## 14. Sécurité

*   **Ségrégation des endpoints :** Aucun endpoint de ce module ne permet la lecture des données personnelles ou d'historique de paiement d'un client.
*   **Vérification de l'assigné :** Le backend vérifie que l'utilisateur qui démarre la tâche est bien l'employé auquel elle est assignée (ou un superviseur).

---

## 15. Checklist PR

- [ ] L'endpoint de validation qualité (`/validate`) fait passer de manière transactionnelle le statut de la chambre à `LIBRE_PROPRE` et décrémente les stocks d'accueil.
- [ ] La transition de statut respecte strictement la séquence de machine à états `A_FAIRE` ➔ `EN_COURS` ➔ `TERMINEE` ➔ `CONTROLEE`.
- [ ] L'équipier connecté ne peut pas s'auto-valider le contrôle propreté de sa tâche.
- [ ] Tous les endpoints de ce module n'exposent aucune information de facturation ou de données client confidentielles.
- [ ] Le cas de stock épuisé lors de la décrémentation automatique est intercepté de manière propre, générant une alerte d'approvisionnement sans bloquer la finalisation du ménage (décrémentation en négatif ou alerte asynchrone selon décision d'architecture).
