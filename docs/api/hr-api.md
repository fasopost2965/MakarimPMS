# hr-api.md — Contrat d'API du Module Ressources Humaines (RH, Plannings & Paie)

Ce document spécifie le contrat d'API REST officiel et immuable pour le **Module Ressources Humaines (RH, Plannings & Paie)** du Property Management System (PMS) de l'Hôtel Makarim. Il sert de contrat technique de référence pour l'implémentation de la couche de contrôleurs backend et de la couche d'intégration frontend.

---

## 1. Objectif
Le module Ressources Humaines pilote l'administration du personnel de l'Hôtel Makarim. Il orchestre la planification des shifts de travail, le pointage de présence en temps réel et inviolable, la gestion des demandes d'échanges de roulements, et l'établissement des bulletins de paie légaux et conformes à la réglementation de la CNSS marocaine.

---

## 2. Endpoints REST

| Méthode | URI | Description | Rôle Minimum Requis | Version |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/hr/employees` | Lister les fiches du personnel et contrats | RH | `v1` |
| **GET** | `/api/v1/hr/shifts` | Lister le planning des shifts d'une période | RH | `v1` |
| **POST** | `/api/v1/hr/shifts` | Planifier un nouveau shift de travail | RH | `v1` |
| **POST** | `/api/v1/hr/shifts/exchange` | Initier une demande d'échange de shift | RH | `v1` |
| **PATCH** | `/api/v1/hr/shifts/exchange/{id}/validate` | Valider une demande d'échange de shift | RH | `v1` |
| **POST** | `/api/v1/hr/attendance/clock-in` | Enregistrer un pointage de début de service (Clock-in) | RH | `v1` |
| **POST** | `/api/v1/hr/attendance/clock-out` | Enregistrer un pointage de fin de service (Clock-out) | RH | `v1` |
| **POST** | `/api/v1/hr/payslips/calculate` | Lancer le calcul de paie mensuel d'un employé | RH | `v1` |
| **GET** | `/api/v1/hr/payslips/{id}` | Consulter un bulletin de paie généré | RH | `v1` |

---

## 3. Permissions RBAC

Chaque requête subit une validation d'accès stricte côté serveur (`BR-TR-004`).

*   **`GET /api/v1/hr/employees`**, **`GET /api/v1/hr/shifts`**, **`POST /api/v1/hr/shifts`**, **`PATCH /api/v1/hr/shifts/exchange/{id}/validate`**, **`POST /api/v1/hr/payslips/calculate`**, **`GET /api/v1/hr/payslips/{id}`**
    *   **Rôles autorisés :** Administrateur, RH. (Les données de salaires, plannings globaux et contrats sont strictement isolées de la Réception ou de la Maintenance).
*   **`POST /api/v1/hr/shifts/exchange`**
    *   **Rôles autorisés :** Tout utilisateur authentifié. (Les employés de l'hôtel, quel que soit leur rôle opérationnel, peuvent soumettre des demandes d'échange de shift de travail).
*   **`POST /api/v1/hr/attendance/clock-in`** et **`POST /api/v1/hr/attendance/clock-out`**
    *   **Rôles autorisés :** Tout utilisateur authentifié. (Chaque membre de l'équipe utilise ces endpoints pour pointer à l'arrivée et au départ).

---

## 4. Request DTO

### `CreateShiftDTO` (POST `/api/v1/hr/shifts`)
```json
{
  "employeeId": "string (UUID v4, requis)",
  "startTime": "string (DateISO-8601, requis)",
  "endTime": "string (DateISO-8601, requis)",
  "roleShift": "string (Enum: 'RECEPTION', 'MÉNAGE', 'MAINTENANCE', 'CUISINE', requis)"
}
```

### `RequestExchangeDTO` (POST `/api/v1/hr/shifts/exchange`)
```json
{
  "sourceShiftId": "string (UUID v4, requis)",
  "targetEmployeeId": "string (UUID v4, requis)",
  "reason": "string (requis, min: 10, max: 200)"
}
```

### `ValidateExchangeDTO` (PATCH `/api/v1/hr/shifts/exchange/{id}/validate`)
```json
{
  "approuve": "boolean (requis)",
  "notes": "string (max: 200, optionnel)"
}
```

### `CalculatePayslipDTO` (POST `/api/v1/hr/payslips/calculate`)
```json
{
  "employeeId": "string (UUID v4, requis)",
  "mois": "integer (min: 1, max: 12, requis)",
  "annee": "integer (requis, ex: 2026)",
  "joursTravailles": "integer (min: 0, max: 31, requis)",
  "primes": "number (Decimal, min: 0.00, requis)"
}
```

---

## 5. Response DTO

### `AttendanceClockDTO` (POST `/api/v1/hr/attendance/clock-in`)
```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-1234567890aa",
  "employeeId": "e4b1a457-37fb-49d7-bb92-0b89f8174bbc",
  "startedAt": "2026-07-19T06:58:34Z (Généré par l'horloge du serveur)",
  "endedAt": null,
  "status": "ACTIF"
}
```

### `PayslipDetailDTO`
```json
{
  "id": "p1a2b3c4-5678-90ab-cdef-1234567890aa",
  "employee": {
    "id": "e4b1a457-37fb-49d7-bb92-0b89f8174bbc",
    "nom": "Ait Oufkir",
    "prenom": "Rachid"
  },
  "periode": "07-2026",
  "salaireBase": 5000.00,
  "primes": 500.00,
  "retenues": {
    "amoRetenue": 113.30,
    "cnssRetenue": 239.80,
    "irRetenue": 150.00
  },
  "cotisationsPatronales": {
    "cnssPatronal": 625.00,
    "amoPatronal": 226.60
  },
  "salaireNet": 4996.90,
  "devise": "MAD",
  "calculatedAt": "2026-07-31T17:00:00Z"
}
```

---

## 6. Codes HTTP

*   **`200 OK`** : Consultation de planning ou calcul de bulletin de paie réussi.
*   **`201 Created`** : Shift planifié, échange demandé ou pointage validé avec succès.
*   **`400 Bad Request`** : Erreur de dates de shifts (fin antérieure au début) ou pointage impossible.
*   **`403 Forbidden`** : Accès refusé pour rôle insuffisant.
*   **`404 Not Found`** : Employé, Shift ou bulletin de paie introuvable.
*   **`409 Conflict`** : Pointage multi-session détecté (`BR-RH-005`) ou double-booking horaire d'employé.

---

## 7. Règles métier appelées

*   **`BR-RH-001` : Calcul de la Paie lié au Référentiel CNSS**
    *   Le endpoint `/payslips/calculate` extrait dynamiquement les pourcentages de cotisations de la table `CnssRateConfig` pour calculer les retenues et les parts patronales de la CNSS et de l'AMO marocaines, appliquant les plafonds mensuels réglementaires.
*   **`BR-RH-002` : Validation des Échanges de Shifts (Planning)**
    *   La demande d'échange reste suspendue à l'état `EN_ATTENTE`. Le endpoint `/validate` vérifie l'identité du responsable et applique formellement l'échange si validé.
*   **`BR-RH-003` : Horodatage Serveur Inviolable pour les Présences (Time Shift)**
    *   Les endpoints `/clock-in` et `/clock-out` **ignorent totalement** les timestamps envoyés par le client. Ils injectent en base la date de l'horloge système du serveur (`new Date()`), protégeant le PMS contre la fraude de pointage.
*   **`BR-RH-004` : Blocage de Déconnexion sur Shift Actif**
    *   La passerelle d'authentification valide le statut de pointage de l'utilisateur. Si un shift est `ACTIF`, la tentative de déconnexion de la session PMS est refusée, incitant l'utilisateur à clore ou suspendre son shift.
*   **`BR-RH-005` : Pointage Multi-Session Interdit**
    *   Interdiction stricte de démarrer un nouveau shift de travail si l'employé connecté possède déjà un enregistrement actif ou en pause.

---

## 8. ADR concernées

*   **`ADR-007` : Time-Shift & Attendance**
    *   Garantit la traçabilité infalsifiable des heures de travail du personnel de l'établissement.
*   **`ADR-006` : RBAC Enforcement**
    *   Sécurisation serveur stricte des interfaces de gestion RH.

---

## 9. Transactions

La demande d'échange de shift et surtout le pointage de présence nécessitent une exécution transactionnelle sous isolation **`SERIALIZABLE`**.
*   **Portée de la transaction (Clock-in) :**
    1.  Verrouillage pessimiste de la table `Attendance` pour l'employé cible (`SELECT FOR UPDATE WHERE employeeId = ...`).
    2.  Vérification de l'inexistence de shifts actifs (`status IN ('ACTIF', 'EN_PAUSE')`).
    3.  Écriture de la nouvelle ligne de pointage avec le timestamp précis du serveur.
    4.  Émission de l'événement.

---

## 10. Idempotence

Les endpoints de pointage (`/clock-in`, `/clock-out`) n'imposent pas de clé d'idempotence HTTP de type header mais s'appuient sur un verrou d'état applicatif en base de données : un double-clic sur "Pointer Arrivée" échoue immédiatement lors de la seconde exécution par le biais de la contrainte d'unicité de shift actif (`BR-RH-005`).

---

## 11. Audit

*   Toute validation d'échange de shift ou édition manuelle de feuille d'heures est journalisée : `"ECHANGE DE SHIFT [ID] validé par le responsable [USER_ID]"` (Log opérationnel).
*   La modification manuelle a posteriori d'un bulletin de paie ou d'un pointage est considérée comme action hautement sensible : `"Modification manuelle du pointage [ID] de l'employé [ID] par le responsable [USER_ID]. Justification : [MOTIF]"` (Audit log de sécurité).

---

## 12. Événements émis

*   `EmployeeClockedInEvent` : Diffusé aux modules Sécurité et Housekeeping (suivi des effectifs).
*   `EmployeeClockedOutEvent` : Signale la fin de service de l'employé.
*   `ShiftExchangeValidatedEvent` : Modifie dynamiquement les plannings et envoie une alerte mobile aux deux équipiers concernés.
*   `PayslipCalculatedEvent` : Déclenche l'écriture de dépense salariale correspondante dans le module de Comptabilité.

---

## 13. Performance

*   **Poids des plannings :** L'endpoint `GET /api/v1/hr/shifts` prend en charge des filtres de période restreints (maximum 31 jours) pour éviter de saturer la mémoire du serveur ou l'affichage de l'interface en réceptionnant d'un coup des plannings annuels.
*   **Indexation :** Index sur `Attendance(employeeId, status)` et `Shift(employeeId, startTime, endTime)`.

---

## 14. Sécurité

*   **Données personnelles sensibles :** Les salaires, adresses privées, et comptes CNSS sont cryptés en base de données ou masqués. Aucun endpoint n'expose d'attributs financiers à des rôles extérieurs au pôle RH et Administratif.
*   **Inviolabilité temporelle :** Utilisation systématique de serveurs de temps NTP pour garantir l'exactitude de l'horloge du serveur PMS.

---

## 15. Checklist PR

- [ ] L'écriture de pointage (`/clock-in` et `/clock-out`) requiert exclusivement l'horloge système du serveur et rejette tout timestamp envoyé par le client.
- [ ] Un test d'intégration s'assure qu'un employé ne peut pas pointer à l'arrivée s'il dispose d'une session de pointage active ou en pause (`BR-RH-005`).
- [ ] Le calcul de bulletin de paie mensuel extrait les barèmes salariaux directement de l'entité de configuration `CnssRateConfig` (aucun taux écrit en dur).
- [ ] Tout endpoint de validation d'échange exige que le valideur possède des privilèges d'écriture RH ou Admin et l'enregistre via la colonne `valideParId`.
- [ ] La tentative de déconnexion d'un utilisateur ayant un shift de travail actif est interceptée par le système.
