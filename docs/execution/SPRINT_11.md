# SPRINT_11.md — Spécification d'Exécution : Module HR (Pointage Inviolable & Paie CNSS)

Ce document spécifie les directives d'implémentation physique et d'ingénierie logicielle pour le **Sprint 11**, dédié à la gestion des Ressources Humaines, du pointage et du calcul de paie réglementaire marocain.

---

## 1. Objectif du Sprint
Développer la console de pointage inviolable (Clock-In/Clock-Out) des employés, sécuriser les données temporelles en interdisant le recours aux horloges des machines clientes (recours exclusif à l'horloge système du serveur), et implémenter le calcul de bulletin de paie intégrant les cotisations CNSS et AMO du Maroc.

---

## 2. Métriques & Références d'Architecture

*   **Module concerné :** `hr`
*   **Documents de référence :** `BUSINESS_RULES.md`, `DATA_DICTIONARY.md`
*   **ADR utilisée :** `ADR-007-Time-Shift-Attendance.md`
*   **Règles Métier (BUSINESS_RULES) concernées :**
    *   `BR-RH-001` : Inviolabilité temporelle : Les horodatages de pointage proviennent uniquement du serveur backend system.
    *   `BR-RH-002` : Calcul de bulletin de paie conforme à la CNSS (taux salarial 4.48%, AMO 2.26%, plafond de calcul de 6000 MAD mensuel pour les cotisations de sécurité sociale).
    *   `BR-RH-004` : Interdiction de déconnexion si un shift est actuellement actif (`Logout Guard`).

---

## 3. Contrat d'Ingénierie & Signature Physique

### 3.1. Tables Prisma Concernées
*   **`TimeShift`** : Fiche de pointage horaire d'un collaborateur (id, userId, startedAt, endedAt, ipAddress, userAgent, pointsCumules, deletedAt).
*   **`PaySlip`** : Bulletin de paie mensuel (id, userId, mois, annee, salaireBase, indemnites, retenueCNSS, retenueAMO, salaireNet, estValide, issuedAt, validatedBy).

### 3.2. Services NestJS à Implémenter
*   `AttendanceService` : Prise en charge des pointages de début et de fin. Écrit la ligne dans `TimeShift` avec l'horloge système (`new Date()`).
*   `PayrollService` : Calcul exact du bulletin de paie marocain. Applique la formule de retenue sociale :
    *   Retenue CNSS = Min(Salaire Brut Imposable, 6000 MAD) * 4.48%
    *   Retenue AMO = Salaire Brut Imposable * 2.26% (non plafonnée)

### 3.3. Controllers & Routes d'API
*   `AttendanceController` :
    *   `POST /api/v1/hr/clock-in` : Pointage d'arrivée (début de shift).
    *   `POST /api/v1/hr/clock-out` : Pointage de départ (fin de shift).
*   `PayrollController` :
    *   `POST /api/v1/hr/payroll/calculate` : Calcul d'estimation d'un bulletin de paie.
    *   `GET /api/v1/hr/payroll/slips` : Consultation des bulletins de paie validés.

### 3.4. DTOs
*   `PayrollCalculationDto` : ID de l'employé, mois, année, salaire de base, indemnités diverses.
*   `PaySlipResponseDto` : Format de données du bulletin calculé avec ventilation claire des cotisations (Brut, CNSS, AMO, Net).

### 3.5. Guards, Pipes & Middlewares
*   `LogoutGuard` : Guard d'authentification interdisant la déconnexion d'un utilisateur d'hôtel si la table `TimeShift` détient une ligne non clôturée (`endedAt IS NULL`) pour cette session d'employé (Garantit que le personnel de réception ou d'étages pointe formellement son départ avant de quitter son poste).

---

## 4. Stratégie de Validation & Tests

*   **Tests Unitaires :**
    *   Validation de l'application stricte du plafond de cotisation CNSS de 6000 MAD.
    *   *Exemple :* Salaire brut de 8500 MAD ➔ Retenue CNSS = 6000 * 4.48% = 268.80 MAD. Retenue AMO = 8500 * 2.26% = 192.10 MAD.
*   **Tests d'Intégration :**
    *   Vérification qu'une tentative de clock-in pour un utilisateur possédant déjà un shift en cours est refusée par le serveur.
    *   Vérification que l'horodatage écrit dans `startedAt` correspond à la milliseconde près à l'horloge du serveur et ignore l'heure soumise par le client.
*   **Tests E2E :**
    *   Simulation complète : Clock-In ➔ Tentative de Logout (Rejet) ➔ Clock-Out ➔ Logout (Autorisé).

---

## 5. Gouvernance d'Exécution & Clôture

*   **Critères d'Acceptation :**
    *   La console d'enregistrement d'heures de présence et le moteur de calcul de bulletin de paie CNSS/AMO sont conformes. L'événement `EmployeeClockedInEvent` est émis au pointage d'arrivée.
*   **Points de Vigilance :** Ne jamais faire confiance à l'heure du client web ou mobile pour éviter la fraude d'heures de présence.
*   **Dette Technique Autorisée :** Aucune. La législation CNSS marocaine doit être appliquée de façon exacte.
*   **Définition de Terminé (DoD) :** Compilation réussie, linter impeccable, tests unitaires financiers de paie validés au centime près.
