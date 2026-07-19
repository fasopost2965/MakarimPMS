# guests-api.md — Contrat d'API du Module Clients (Guests & CRM)

Ce document spécifie le contrat d'API REST officiel et immuable pour le **Module Clients (Guests & CRM)** du Property Management System (PMS) de l'Hôtel Makarim. Il sert de contrat technique de référence pour l'implémentation de la couche de contrôleurs backend et de la couche d'intégration frontend.

---

## 1. Objectif
Le module Clients pilote la base de données CRM de l'Hôtel Makarim. Il gère l'enregistrement, la qualification, l'historique et la classification réglementaire des clients. Ce module permet notamment d'intercepter les clients indésirables (liste noire), de gérer les comptes d'entreprises partenaires bénéficiant de tarifs préférentiels ou de crédits, et de collecter les données d'identité requises par la législation nationale marocaine.

---

## 2. Endpoints REST

| Méthode | URI | Description | Rôle Minimum Requis | Version |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/guests` | Rechercher et filtrer les fiches clients | Réception | `v1` |
| **GET** | `/api/v1/guests/{id}` | Consulter la fiche complète d'un client | Réception | `v1` |
| **POST** | `/api/v1/guests` | Créer un nouveau profil client | Réception | `v1` |
| **PUT** | `/api/v1/guests/{id}` | Modifier les coordonnées d'un client | Réception | `v1` |
| **PATCH** | `/api/v1/guests/{id}/blacklist` | Muter le statut de blacklist d'un client | Administrateur | `v1` |
| **GET** | `/api/v1/companies` | Rechercher les fiches entreprises | Réception | `v1` |
| **POST** | `/api/v1/companies` | Créer un profil de société partenaire | Administrateur | `v1` |

---

## 3. Permissions RBAC

Chaque requête subit une validation d'accès stricte côté serveur (`BR-TR-004`).

*   **`GET /api/v1/guests`**, **`GET /api/v1/guests/{id}`**, **`GET /api/v1/companies`**
    *   **Rôles autorisés :** Administrateur, Réception.
*   **`POST /api/v1/guests`**, **`PUT /api/v1/guests/{id}`**
    *   **Rôles autorisés :** Administrateur, Réception.
*   **`PATCH /api/v1/guests/{id}/blacklist`**
    *   **Rôles autorisés :** Administrateur. (Seul l'administrateur est autorisé à placer ou retirer un client de la liste noire).
*   **`POST /api/v1/companies`**
    *   **Rôles autorisés :** Administrateur.

---

## 4. Request DTO

### `CreateGuestRequestDTO` (POST `/api/v1/guests`)
```json
{
  "nom": "string (requis, max: 100)",
  "prenom": "string (requis, max: 100)",
  "email": "string (format email, requis, unique)",
  "telephone": "string (requis, max: 30)",
  "nationalite": "string (requis, max: 50)",
  "identiteType": "string (Enum: 'CNIE', 'PASSEPORT', requis)",
  "identiteNumero": "string (requis, unique, max: 30)",
  "statutCRM": "string (Enum: 'STANDARD', 'VIP', 'ENTREPRISE', 'AGENCE', requis)",
  "notes": "string (max: 1000, optionnel)"
}
```

### `UpdateGuestRequestDTO` (PUT `/api/v1/guests/{id}`)
```json
{
  "nom": "string (requis)",
  "prenom": "string (requis)",
  "email": "string (format email, requis)",
  "telephone": "string (requis)",
  "nationalite": "string (requis)",
  "identiteType": "string (Enum: 'CNIE', 'PASSEPORT', requis)",
  "identiteNumero": "string (requis)",
  "statutCRM": "string (Enum: 'STANDARD', 'VIP', 'ENTREPRISE', 'AGENCE', requis)",
  "notes": "string (max: 1000, optionnel)"
}
```

### `ToggleBlacklistDTO` (PATCH `/api/v1/guests/{id}/blacklist`)
```json
{
  "blacklist": "boolean (requis)",
  "reason": "string (min: 10, max: 500, requis)"
}
```

### `CreateCompanyRequestDTO` (POST `/api/v1/companies`)
```json
{
  "nom": "string (requis, unique, max: 100)",
  "ice": "string (Identifiant Commun de l'Entreprise marocain, requis, 15 chiffres, unique)",
  "adresse": "string (requis)",
  "contactEmail": "string (format email, requis)",
  "contactTelephone": "string (requis)",
  "plafondCredit": "number (Decimal, requis, min: 0.00)",
  "tarifNegocieRemise": "number (Decimal, max: 100.00, requis)"
}
```

---

## 5. Response DTO

### `GuestDetailDTO`
```json
{
  "id": "c1f7a829-87c2-482d-bf8d-d586e37996bb",
  "nom": "Benjelloun",
  "prenom": "Yassine",
  "email": "yassine.benj@example.com",
  "telephone": "+212661123456",
  "nationalite": "Marocaine",
  "identiteType": "CNIE",
  "identiteNumero": "K123456",
  "statutCRM": "STANDARD",
  "blacklist": false,
  "blacklistReason": null,
  "notes": "Client habituel",
  "createdAt": "2026-07-19T04:30:00Z"
}
```

### `CompanyDetailDTO`
```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "nom": "Société Marocaine de Logistique S.A.",
  "ice": "001234567890123",
  "adresse": "Boulevard Mohamed V, Casablanca",
  "plafondCredit": 50000.00,
  "creditUtilise": 12500.00,
  "tarifNegocieRemise": 15.00,
  "createdAt": "2026-07-19T04:30:00Z"
}
```

---

## 6. Codes HTTP

*   **`200 OK`** : Fiche client ou entreprise consultée ou modifiée avec succès.
*   **`201 Created`** : Client ou entreprise créé avec succès.
*   **`400 Bad Request`** : Erreur de format de données (ex. ICE marocain invalide ou format d'e-mail incorrect).
*   **`403 Forbidden`** : Droits d'administration requis pour les actions de Blacklist ou d'enregistrement de sociétés.
*   **`404 Not Found`** : Fiche client ou entreprise non trouvée.
*   **`409 Conflict`** : Doublon de pièce d'identité (`identiteNumero`), d'e-mail ou d'ICE d'entreprise.

---

## 7. Règles métier appelées

*   **`BR-CLI-001` : Typologie des Fiches Clients**
    *   Contrôle de conformité de l'affectation de la catégorie de client.
*   **`BR-CLI-002` : Restriction pour Clients sur Liste Noire (Blacklist)**
    *   Si `blacklist = true`, l'identifiant du client est inscrit sur un registre de sécurité globale. Toute tentative de liaison ultérieure avec une réservation ou un séjour déclenchera un blocage direct au niveau applicatif.
*   **`BR-CLI-003` : Enregistrement Obligatoire des Pièces d'Identité**
    *   Interdiction de créer une fiche client ou de l'enregistrer si les champs `identiteType` et `identiteNumero` sont vides.
*   **`BR-CLI-004` : Plafond de Crédit Entreprise (City Ledger)**
    *   Les entreprises sont dotées d'un attribut `plafondCredit` et d'un calcul dynamique de `creditUtilise` représentant l'encours des folios ouverts.

---

## 8. ADR concernées

*   **`ADR-005` : Audit & Soft Delete**
    *   Aucun client ni entreprise ne peut être supprimé physiquement (`DELETE` proscrit). Seul un drapeau logique d'effacement `deletedAt` est positionné.
*   **`ADR-006` : RBAC Enforcement**
    *   Isolement strict des droits d'accès. La réception est interdite de modifier le registre des entreprises et de lever les fiches de blacklist.

---

## 9. Transactions

La création de clients ou d'entreprises requiert des validations d'unicité préalables (`SELECT` avant `INSERT`).
*   **Portée de la transaction (Création Guest) :**
    1.  Verrouillage en lecture sur la pièce d'identité (`SELECT FOR UPDATE WHERE identiteNumero = ...`).
    2.  Vérification de l'inexistence de doublons.
    3.  Écriture physique de l'entité `Guest`.
    4.  Émission de l'événement.

---

## 10. Idempotence

Les créations de fiches clients (`POST /api/v1/guests`) et d'entreprises (`POST /api/v1/companies`) acceptent l'en-tête optionnel mais fortement recommandé `Idempotency-Key` pour fiabiliser les doubles clics de formulaires en réception.

---

## 11. Audit

Toute modification du statut de blacklist d'un client est une action hautement critique soumise à journalisation immuable (`BR-AUD-002`) :
*   **Blacklistage :** `"Mise sur LISTE NOIRE du client [NOM] [PRENOM] ([ID]) par l'administrateur [ADMIN_ID]. Motif : [REASON]"`
*   **Whitelisting :** `"Retrait de la liste noire du client [ID] par l'administrateur [ADMIN_ID]. Motif : [REASON]"`

---

## 12. Événements émis

*   `GuestCreatedEvent` : Publié pour synchronisation avec les bases de données d'analyse ou CRM.
*   `GuestBlacklistedEvent` : Diffusé immédiatement pour intercepter d'éventuels dossiers de réservation en suspens pour le même client.
*   `CompanyCreditLimitExceededEvent` : Déclenché en cas de dépassement de l'encours financier autorisé.

---

## 13. Performance

*   **Recherche floue :** L'endpoint `GET /api/v1/guests` prend en charge une recherche floue (`q=Benj`) optimisée par un index de texte ou trigramme SQL sur les colonnes `nom` et `prenom` pour assurer des temps de recherche inférieurs à **20ms**.
*   **Pagination obligatoire** sur toutes les listes de fiches CRM.

---

## 14. Sécurité

*   **Vérification de l'ICE marocain :** L'ICE (Identifiant Commun de l'Entreprise) des fiches sociétés fait l'objet d'un contrôle de longueur (15 caractères numériques) et de luhn si applicable.
*   **RGPD / Confidentialité :** Le droit d'exportation exhaustive des bases clients est exclusivement attribué à l'Administrateur (`RBAC_MATRIX.md`). Les données sensibles (pièces d'identité) sont masquées dans les affichages non autorisés.

---

## 15. Checklist PR

- [ ] L'ICE d'une société est composé de 15 chiffres exactement et est validé côté serveur.
- [ ] L'insertion d'un profil client sans pièce d'identité valide (`identiteNumero` et `identiteType` absents) est bloquée par l'API.
- [ ] Seul l'Administrateur peut appeler avec succès le endpoint de gestion de la liste noire.
- [ ] L'inscription d'un client sur liste noire écrit une ligne détaillée explicite dans l'entité `AuditLog` avec motif obligatoire de 10+ caractères.
