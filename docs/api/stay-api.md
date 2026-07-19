# stay-api.md — Contrat d'API du Module Séjours (Stays)

Ce document spécifie le contrat d'API REST officiel et immuable pour le **Module Séjours (Stays)** du Property Management System (PMS) de l'Hôtel Makarim. Il sert de contrat technique de référence pour l'implémentation de la couche de contrôleurs backend et de la couche d'intégration frontend.

---

## 1. Objectif
Le module Séjours constitue le cœur opérationnel de l'hôtel (conformément à l'ADR-001). Il orchestre la présence physique du client au sein de l'établissement. Ses fonctionnalités majeures englobent l'enregistrement de l'arrivée (Check-in), l'accueil direct sans réservation (Walk-in), le suivi opérationnel, la réaffectation de chambre en cours de séjour, et la validation réglementaire du départ (Check-out).

---

## 2. Endpoints REST

| Méthode | URI | Description | Rôle Minimum Requis | Version |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/stays` | Lister et filtrer les séjours actifs ou passés | Réception | `v1` |
| **GET** | `/api/v1/stays/{id}` | Consulter le détail complet d'un séjour | Réception | `v1` |
| **POST** | `/api/v1/stays/check-in` | Effectuer le Check-in à partir d'une réservation | Réception | `v1` |
| **POST** | `/api/v1/stays/walk-in` | Effectuer un Check-in direct sans réservation préexistante | Réception | `v1` |
| **POST** | `/api/v1/stays/{id}/room-move` | Changer la chambre d'un séjour en cours | Réception | `v1` |
| **POST** | `/api/v1/stays/{id}/check-out` | Clore et finaliser un séjour (Check-out) | Réception | `v1` |

---

## 3. Permissions RBAC

Chaque requête subit une validation d'accès stricte côté serveur (`BR-TR-004`).

*   **`GET /api/v1/stays`** et **`GET /api/v1/stays/{id}`**
    *   **Rôles autorisés :** Administrateur, Réception.
*   **`POST /api/v1/stays/check-in`** et **`POST /api/v1/stays/walk-in`**
    *   **Rôles autorisés :** Administrateur, Réception.
    *   **Contrôle contextuel :** Rejet si la pièce d'identité du client n'est pas enregistrée dans la fiche client associée (`BR-CLI-003`).
*   **`POST /api/v1/stays/{id}/room-move`**
    *   **Rôles autorisés :** Administrateur, Réception.
*   **`POST /api/v1/stays/{id}/check-out`**
    *   **Rôles autorisés :** Administrateur, Réception.
    *   **Contrôle contextuel :** Interdiction stricte de valider le départ si le solde financier de l'intégralité des folios associés au séjour n'est pas égal à 0.00 MAD (`BR-SEJ-004`).

---

## 4. Request DTO

### `CheckInRequestDTO` (POST `/api/v1/stays/check-in`)
```json
{
  "reservationId": "string (UUID v4, requis)",
  "roomId": "string (UUID v4, requis)",
  "identiteType": "string (Enum: 'CNIE', 'PASSEPORT', requis)",
  "identiteNumero": "string (min: 5, max: 30, requis)",
  "notes": "string (max: 500, optionnel)"
}
```

### `WalkInRequestDTO` (POST `/api/v1/stays/walk-in`)
```json
{
  "guest": {
    "nom": "string (requis)",
    "prenom": "string (requis)",
    "email": "string (format email, requis)",
    "telephone": "string (requis)",
    "identiteType": "string (Enum: 'CNIE', 'PASSEPORT', requis)",
    "identiteNumero": "string (requis)"
  },
  "roomId": "string (UUID v4, requis)",
  "checkOut": "string (Date ISO-8601 YYYY-MM-DD, requis)",
  "canal": "WALK_IN",
  "nombreAdultes": "integer (min: 1, max: 4, requis)",
  "nombreEnfants": "integer (min: 0, max: 4, requis)",
  "tarifNegocie": "number (Decimal, requis)",
  "notes": "string (max: 500, optionnel)"
}
```

### `RoomMoveRequestDTO` (POST `/api/v1/stays/{id}/room-move`)
```json
{
  "newRoomId": "string (UUID v4, requis)",
  "reason": "string (min: 10, max: 250, requis)"
}
```

### `CheckOutRequestDTO` (POST `/api/v1/stays/{id}/check-out`)
```json
{
  "overrideBalanceCheck": "boolean (requis, par défaut false, utilisable uniquement par Admin si City Ledger validé)",
  "companyId": "string (UUID v4, optionnel, requis si transfert sur City Ledger)"
}
```

---

## 5. Response DTO

### `StayDetailDTO`
```json
{
  "id": "b8a5d147-36c2-411d-bf8e-f586e11993aa",
  "reservationId": "e4b1a457-37fb-497d-bb92-0b89f8174a7b",
  "reference": "STAY-2026-0043",
  "guest": {
    "id": "c1f7a829-87c2-482d-bf8d-d586e37996bb",
    "nom": "Benjelloun",
    "prenom": "Yassine"
  },
  "room": {
    "id": "a5d8b749-16c2-421d-bf8e-f586e11993cc",
    "numero": "104",
    "status": "OCCUPEE"
  },
  "checkIn": "2026-07-19T14:30:00Z",
  "checkOut": "2026-07-23T12:00:00Z",
  "status": "EN_COURS",
  "folios": [
    {
      "id": "d5b8a147-16c2-421d-bf8e-c586e11995bb",
      "solde": 0.00
    }
  ],
  "createdAt": "2026-07-19T14:30:00Z"
}
```

---

## 6. Codes HTTP

*   **`200 OK`** : Opération traitée avec succès.
*   **`201 Created`** : Séjour (Check-in / Walk-in) initialisé avec succès.
*   **`400 Bad Request`** : Données invalides ou non-conformité de la pièce d'identité (`BR-CLI-003`).
*   **`403 Forbidden`** : Interdiction d'accès ou refus de Check-in pour client blacklisté.
*   **`404 Not Found`** : Séjour, Réservation ou Chambre introuvable.
*   **`409 Conflict`** : Chambre non disponible au statut `LIBRE_PROPRE` ou déjà occupée.
*   **`422 Unprocessable Entity`** : Solde de folio différent de 0.00 MAD au check-out (`BR-SEJ-004`).

---

## 7. Règles métier appelées

*   **`BR-SEJ-001` : Liaison Unique avec la Réservation**
    *   Un check-in invalide la réservation d'origine en basculant son état à `TRANSFORMEE_EN_SEJOUR`.
*   **`BR-SEJ-002` : Initialisation du Séjour (Check-in)**
    *   La validation du check-in doit obligatoirement générer un `Stay`, instancier le Folio principal pour l'hébergement et muter le statut de la chambre à `OCCUPEE`.
*   **`BR-SEJ-003` : Check-in Direct (Walk-In)**
    *   Initialisation d'un séjour d'un seul bloc (Client + Stay + Folio + Statut Chambre `OCCUPEE`).
*   **`BR-SEJ-004` : Invariant de Solde de Check-out**
    *   Rejet de la clôture si la somme algébrique de toutes les lignes des folios rattachés n'est pas strictement égale à `0.00` MAD.
*   **`BR-SEJ-005` : Libération de la Chambre au Check-out**
    *   Le départ effectif d'un séjour doit immédiatement libérer la chambre en la passant au statut `A_NETTOYER`.
*   **`BR-CLI-003` : Enregistrement Obligatoire des Pièces d'Identité**
    *   La pièce d'identité du client physique principal doit être stockée avec son numéro et son type.

---

## 8. ADR concernées

*   **`ADR-001` : Stay-Centric Architecture**
    *   Le séjour est le nœud opérationnel et technique.
*   **`ADR-002` : Folio & Billing Model**
    *   Initialisation automatique d'un Folio lors de la création du séjour.
*   **`ADR-003` : Room State Machine**
    *   Transition rigoureuse des états de chambres : `LIBRE_PROPRE` ➔ `OCCUPEE` ➔ `A_NETTOYER`.
*   **`ADR-005` : Audit & Soft Delete**
    *   Aucune suppression physique de séjours n'est autorisée.

---

## 9. Transactions

Les check-ins, changements de chambres, et check-outs s'exécutent au sein de transactions de base de données d'un niveau d'isolation **`SERIALIZABLE`**.
*   **Portée de la transaction (Check-in) :**
    1.  Verrouillage de la réservation (`SELECT FOR UPDATE`).
    2.  Verrouillage et vérification du statut de la chambre (doit être `LIBRE_PROPRE`).
    3.  Création du séjour `Stay`.
    4.  Création du `Folio` principal associé.
    5.  Mise à jour du statut de la chambre en `OCCUPEE`.
    6.  Mise à jour du statut de la réservation en `TRANSFORMEE_EN_SEJOUR`.
    7.  Écriture de l'historique `RoomStatusLog`.
    8.  Publication des événements.

---

## 10. Idempotence

Les endpoints de modification majeure (`POST /api/v1/stays/check-in`, `POST /api/v1/stays/walk-in`, `POST /api/v1/stays/{id}/check-out`) imposent l'en-tête HTTP `Idempotency-Key` (UUID v4) pour empêcher le re-traitement intempestif des arrivées/départs.

---

## 11. Audit

Toutes les actions d'initialisation, de transfert ou de clôture font l'objet d'un archivage immuable dans l'entité `AuditLog` :
*   **Check-in :** `"Check-in validé pour le séjour [REF]. Chambre affectée : [NUM]."`
*   **Changement de chambre :** `"Changement de chambre du séjour [REF]. Ancienne : [NUM_A], Nouvelle : [NUM_B]. Motif : [REASON]"`
*   **Check-out :** `"Check-out finalisé pour le séjour [REF]. Solde apuré."`

---

## 12. Événements émis

*   `StayStartedEvent` : Diffusé aux modules Facturation, Housekeeping et Reporting.
*   `RoomMovedEvent` : Déclenche la mise à jour immédiate du ménage et du transfert de charges.
*   `StayEndedEvent` : Déclenche immédiatement la tâche de ménage (`BR-HK-001`) et met à jour le rapport d'activité.

---

## 13. Performance

*   **Pessimistic Locking :** Les sélections sur les chambres et les folios d'un séjour en écriture sont systématiquement sécurisées par un `SELECT FOR UPDATE` pour prévenir les conflits de concurrence en cas de check-ins parallèles.
*   **Indexation :** Index sur `Stay(status, checkOut)` et `Stay(roomId)`.

---

## 14. Sécurité

*   **Contrôle strict des pièces d'identité :** Aucun check-in n'est validé si les expressions régulières associées aux pièces d'identité ne sont pas conformes (par exemple, longueur minimale et caractères pour CNIE / Passeport).
*   **Sanitization :** Nettoyage obligatoire des motifs de changement de chambre contre l'injection de scripts (XSS).

---

## 15. Checklist PR

- [ ] L'action de Check-in ou Walk-in crée bel et bien l'entité `Stay` et le `Folio` d'hébergement dans une unique transaction SQL.
- [ ] Le statut de la chambre passe rigoureusement à `OCCUPEE` au Check-in et à `A_NETTOYER` au Check-out.
- [ ] L'en-tête `Idempotency-Key` est implémenté et testé pour le Check-out et le Check-in.
- [ ] Le Check-out d'un séjour échoue systématiquement si le solde calculé des folios associés n'est pas strictement de `0.00` MAD.
- [ ] Les pièces d'identité sont capturées, validées et persistées lors du Check-in.
