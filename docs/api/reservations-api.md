# reservations-api.md — Contrat d'API du Module Réservations

Ce document spécifie le contrat d'API REST officiel et immuable pour le **Module Réservations** du Property Management System (PMS) de l'Hôtel Makarim. Il sert de contrat technique de référence pour l'implémentation de la couche de contrôleurs backend et de la couche d'intégration frontend.

---

## 1. Objectif
Le module de Réservations expose les interfaces permettant de planifier, d'enregistrer, d'annuler et de gérer le cycle de vie des réservations de chambres de l'Hôtel Makarim. Il permet de capturer les détails des séjours futurs des clients (dates d'arrivée/départ, catégorie de chambre, origine de réservation, etc.) tout en assurant l'intégrité de la grille d'occupation et la prévention absolue de la surréservation.

---

## 2. Endpoints REST

| Méthode | URI | Description | Rôle Minimum Requis | Version |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/reservations` | Lister et filtrer les réservations | Réception | `v1` |
| **GET** | `/api/v1/reservations/{id}` | Consulter les détails d'une réservation | Réception | `v1` |
| **POST** | `/api/v1/reservations` | Créer une nouvelle réservation | Réception | `v1` |
| **PATCH** | `/api/v1/reservations/{id}/status` | Muter le statut d'une réservation (Annulation / No-Show) | Réception | `v1` |
| **PUT** | `/api/v1/reservations/{id}` | Modifier les caractéristiques d'une réservation | Réception | `v1` |

---

## 3. Permissions RBAC

Chaque requête adressée à cette API subit une interception par la couche d'autorisation backend avant traitement de la logique métier (conformément à la règle transversale `BR-TR-004`).

*   **`GET /api/v1/reservations`**
    *   **Rôles autorisés :** Administrateur, Réception.
    *   **Contrôle contextuel :** Aucun.
*   **`GET /api/v1/reservations/{id}`**
    *   **Rôles autorisés :** Administrateur, Réception.
    *   **Contrôle contextuel :** Aucun.
*   **`POST /api/v1/reservations`**
    *   **Rôles autorisés :** Administrateur, Réception.
    *   **Contrôle contextuel :** Interdiction d'enregistrer la réservation si le client cible est classé en `BLACKLIST` (nécessite un override Admin).
*   **`PATCH /api/v1/reservations/{id}/status`**
    *   **Rôles autorisés :** Administrateur, Réception.
    *   **Contrôle contextuel :** Restriction sur les transitions d'état autorisées.
*   **`PUT /api/v1/reservations/{id}`**
    *   **Rôles autorisés :** Administrateur, Réception.
    *   **Contrôle contextuel :** Interdiction de modifier les dates si cela génère une surréservation (`BR-RES-001`).

---

## 4. Request DTO

### `CreateReservationRequestDTO` (POST `/api/v1/reservations`)
```json
{
  "guestId": "string (UUID v4, requis)",
  "roomTypeId": "string (UUID v4, requis)",
  "roomId": "string (UUID v4, optionnel)",
  "checkIn": "string (Date ISO-8601 YYYY-MM-DD, requis)",
  "checkOut": "string (Date ISO-8601 YYYY-MM-DD, requis)",
  "canal": "string (Enum: 'WALK_IN', 'DIRECT', 'BOOKING_COM', requis)",
  "nombreAdultes": "integer (min: 1, max: 4, requis)",
  "nombreEnfants": "integer (min: 0, max: 4, requis)",
  "tarifNegocie": "number (Decimal, min: 0.00, optionnel)",
  "notes": "string (max: 500, optionnel)"
}
```

### `UpdateReservationStatusDTO` (PATCH `/api/v1/reservations/{id}/status`)
```json
{
  "status": "string (Enum: 'ANNULEE', 'NO_SHOW', requis)",
  "reason": "string (min: 10, max: 250, requis)"
}
```

---

## 5. Response DTO

### `ReservationDetailDTO`
```json
{
  "id": "e4b1a457-37fb-497d-bb92-0b89f8174a7b",
  "reference": "RES-2026-0089",
  "guest": {
    "id": "c1f7a829-87c2-482d-bf8d-d586e37996bb",
    "nom": "Benjelloun",
    "prenom": "Yassine",
    "email": "yassine.benj@example.com",
    "statutCRM": "STANDARD"
  },
  "roomType": {
    "id": "f5b8a147-86c2-431d-bf8e-c586e11995aa",
    "nom": "Chambre Double Standard"
  },
  "room": {
    "id": "a5d8b749-16c2-421d-bf8e-f586e11993cc",
    "numero": "104"
  },
  "checkIn": "2026-08-01",
  "checkOut": "2026-08-05",
  "status": "CONFIRMEE",
  "canal": "DIRECT",
  "nombreAdultes": 2,
  "nombreEnfants": 1,
  "tarifNegocie": 1200.00,
  "createdAt": "2026-07-19T11:30:00Z",
  "updatedAt": "2026-07-19T11:30:00Z"
}
```

---

## 6. Codes HTTP

*   **`200 OK`** : Requête traitée avec succès (récupération de liste, de détail ou mise à jour).
*   **`201 Created`** : Réservation créée avec succès. Renvoie le `ReservationDetailDTO`.
*   **`400 Bad Request`** : Erreur de validation des données d'entrée ou transition d'état invalide.
*   **`401 Unauthorized`** : Absence de jeton d'authentification ou jeton expiré.
*   **`403 Forbidden`** : Rôle insuffisant ou client sur liste noire (`BR-CLI-002`).
*   **`404 Not Found`** : Réservation ou entité associée non trouvée.
*   **`409 Conflict`** : Surréservation détectée sur la chambre ou la catégorie de chambre demandée pour les dates spécifiées (`BR-RES-001`).

---

## 7. Règles métier appelées

*   **`BR-RES-001` : Prévention du Double-Booking (Surréservation)**
    *   Vérification stricte de l'inexistence d'une réservation confirmée chevauchant la même chambre ou saturant le stock physique disponible pour la catégorie sélectionnée.
*   **`BR-RES-002` : Cycle de Vie de la Réservation**
    *   Seuls les états `CONFIRMEE` peuvent être modifiés.
    *   La transition de `CONFIRMEE` vers `ANNULEE` ou `NO_SHOW` est autorisée moyennant justification.
*   **`BR-RES-003` : Origine de Réservation Obligatoire**
    *   Validation stricte du champ `canal` dans le DTO de création.
*   **`BR-CLI-002` : Restriction pour Clients sur Liste Noire (Blacklist)**
    *   Rejet de la création si l'identifiant du client pointe vers un profil blacklisté sans intervention d'un administrateur.

---

## 8. ADR concernées

*   **`ADR-001` : Stay-Centric Architecture**
    *   Une réservation est une planification hors-murs. Elle ne consomme aucun service réel et n'a pas de folio actif avant le check-in.
*   **`ADR-005` : Audit & Soft Delete**
    *   Une annulation de réservation ne supprime jamais l'entité. Seul l'état évolue vers `ANNULEE`. Un effacement logique (`deletedAt`) n'est toléré que sur ordre de l'Administrateur.
*   **`ADR-006` : RBAC Enforcement**
    *   Sécurisation serveur de l'ensemble des requêtes.

---

## 9. Transactions

La création et la modification de dates de réservation doivent être exécutées au sein d'une transaction de base de données à isolation **`SERIALIZABLE`** (ou `READ COMMITTED` avec verrouillage pessimiste `SELECT FOR UPDATE` sur la table `RoomNight` / `Reservation`).
*   **Portée de la transaction :**
    1.  Vérification de l'existence et du statut du client.
    2.  Verrouillage de la chambre physique ou du contingent pour les dates ciblées.
    3.  Validation d'absence de chevauchement de dates.
    4.  Écriture de l'entité `Reservation`.
    5.  Émission de l'événement de domaine.

---

## 10. Idempotence

L'endpoint de création de réservation (`POST /api/v1/reservations`) implémente un contrôle d'idempotence strict via l'en-tête HTTP :
*   **`Idempotency-Key` :** UUID v4 obligatoire.
*   En cas de renvoi d'une clé déjà traitée dans un intervalle de 24 heures, le serveur retourne directement la réponse HTTP d'origine stockée en cache Redis sans réexécuter la logique métier, évitant ainsi la création accidentelle de réservations doublonnées.

---

## 11. Audit

Toute modification majeure ou annulation de réservation génère une écriture immuable dans l'entité `AuditLog` :
*   **Création :** `"Création réservation [REF] pour le client [ID]"` (Log de niveau opérationnel).
*   **Annulation :** `"Annulation réservation [REF] par l'utilisateur [ID]. Motif : [REASON]"` (Log de niveau sécurité).
*   **No-Show :** `"Passage en NO_SHOW de la réservation [REF]"` (Log de niveau opérationnel).

---

## 12. Événements émis

Lors du changement d'état d'une réservation, les événements de domaine suivants sont publiés sur le bus de message interne pour traitement asynchrone par les autres modules :
*   `ReservationCreatedEvent` : Diffusé pour notification et pré-affectation technique.
*   `ReservationCancelledEvent` : Diffusé à la gouvernance et aux chambres pour libérer les pré-affectations.
*   `ReservationNoShowEvent` : Déclenche les protocoles d'annulation des services annexes et de libération définitive de la chambre.

---

## 13. Performance

*   **Pagination :** Le listing `GET /api/v1/reservations` est paginé obligatoirement par défaut (`page=1`, `limit=20`, max `limit=100`).
*   **Indexation :** Index composites obligatoires en base de données sur les colonnes `(checkIn, checkOut)`, `(roomId, status)` et `(guestId)` pour garantir des temps de réponse inférieurs à **50ms** sur les requêtes d'allocation.
*   **Chargement :** Utilisation d'un chargement sélectif (Select) pour éviter le rapatriement inutile des métadonnées du client lors d'un simple listing.

---

## 14. Sécurité

*   **Assainissement (Sanitization) :** Le champ `notes` est nettoyé via une bibliothèque anti-XSS (`dompurify` ou équivalent serveur) avant écriture.
*   **Validation des entrées :** Utilisation de schémas de validation stricts (`Zod` ou `Class-Validator`) bloquant les dates incohérentes (départ antérieur ou égal à l'arrivée).
*   **Vérification de Blacklist :** Couplage obligatoire avec le service CRM pour intercepter tout client indésirable (`BR-CLI-002`).

---

## 15. Checklist PR

Avant de valider une modification sur le contrôleur ou le service de réservations, assurez-vous que :
- [ ] La validation des dates (`checkIn < checkOut`) est gérée par le validateur de schéma et testée.
- [ ] L'en-tête `Idempotency-Key` est exigé et validé sur le endpoint `POST`.
- [ ] La transaction SQL de réservation utilise un mécanisme de verrouillage pour empêcher les race-conditions de surréservation.
- [ ] Le contrôle RBAC est actif et validé par un test d'intégration avec un jeton Réception et un jeton restreint.
- [ ] Aucune suppression SQL (`DELETE`) n'est implémentée ; l'annulation de réservation doit uniquement muter son statut.
