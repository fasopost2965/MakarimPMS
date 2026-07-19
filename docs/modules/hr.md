# Spécification Technique — Module RH & Pointage (hr.md)

---

## 1. Objectif du module
Le module **RH & Pointage (Time Shift & Attendance)** assure l'administration des collaborateurs de l'Hôtel Makarim, le suivi infalsifiable des horaires de présence et le calcul de la masse salariale d'exploitation en conformité avec la législation du travail marocaine et les cotisations obligatoires CNSS.

---

## 2. Responsabilités
Le module est seul responsable de :
* La gestion des fiches salariés (contrat de travail, grille salariale CNSS, coordonnées).
* La planification des Shifts d'équipes opérationnelles de l'hôtel (plannings hebdomadaires).
* Le système de pointage en temps réel de début, de pause, de reprise et de fin d'activité de shift.
* La gestion de la machine à états stricte du statut de pointage de présence de l'utilisateur connecté (`StatutTimeShift`).
* L'inviolabilité absolue des dates et heures d'enregistrement basées exclusivement sur l'horloge système du serveur.
* Le blocage actif et encadré de déconnexion de l'application PMS si l'employé possède un shift en cours d'activité (Logout Guard).
* La gestion des corrections rétroactives d'heures par les managers avec écriture d'audit de sécurité obligatoire.

---

## 3. Hors périmètre
Le module n'intervient jamais dans :
* Le processus d'attribution commerciale des chambres ou de check-in (confié au module `stay`).
* La perception et l'enregistrement de règlements de clients ou d'extras de séjours (confiés aux modules `payments` et `billing`).
* Le suivi technique d'entretien physique des chambres (confié au module `housekeeping`).

---

## 4. Entités manipulées
Ce module manipule et gère directement les entités suivantes du `DATA_DICTIONARY.md` :
* `User` (Fiche salarié et identifiant d'authentification)
* `TimeShift` (Enregistrement de présence global pour la journée d'exploitation)
* `TimeShiftSegment` (Segment d'activité : Travail effectif ou pause d'interruption)
* `Payslip` (Calcul mensuel de la grille de paie CNSS)
* `AuditLog` (Pour historiser et documenter réglementairement les modifications administratives d'heures)

---

## 5. BUSINESS_RULES concernées
Les règles métiers applicables à ce module sont :
* **BR-RH-001 (Ségrégation du module RH) :** Confidentialité et étanchéité absolue des fiches salariés et grilles de salaires.
* **BR-RH-002 (Calcul CNSS) :** Application réglementaire des cotisations patronales et salariales marocaines.
* **BR-RH-003 (Pointage strict) :** Heures de shifts enregistrées exclusivement via l'horloge du serveur backend.
* **BR-RH-004 (Correction réglementée) :** Justification obligatoire d'au moins 10 caractères pour modifier une fiche d'heures.
* **BR-RH-005 (Pointage et déconnexion) :** Interdiction de se déconnecter de l'application sans clore ou pauser son shift actif.

---

## 6. ADR concernées
Les décisions d'architecture impactant ce module sont :
* **[ADR-005 (Audit & Soft Delete)](/docs/ADR-005-Audit-Soft-Delete.md) :** Obligation d'auditer de manière synchrone toutes les modifications rétroactives d'heures d'employés.
* **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md) :** Protection stricte d'accès des relevés salariaux et fiches collaborateurs.
* **[ADR-007 (Time Shift & Attendance State Machine)](/docs/ADR-007-Time-Shift-Attendance.md) :** Machine à états des shifts d'activité, primauté de l'horloge serveur, et dispositif de sécurité logout.

---

## 7. Permissions RBAC
Les habilitations requises pour interagir avec ce module sont :
* `hr:read` (Accès aux plannings, fiches d'heures) : Autorisé pour `ADMINISTRATEUR`, `RH`.
* `hr:write` (Modification de fiches salariés, administration de paie, correction d'heures) : Autorisé exclusivement pour `ADMINISTRATEUR` et `RH`.
* `hr:clock` (Saisie de son propre pointage) : Autorisé pour l'ensemble des rôles actifs connectés à l'application.

---

## 8. Flux entrants
Le module intercepte les événements et requêtes suivants :
* Requête de pointage d'arrivée d'un salarié au comptoir de réception ou sur mobile.
* Requête de prise de pause repas ou de reprise d'activité.
* Demande d'enregistrement de fin de service (clôture de shift).
* Tentative de déconnexion utilisateur (Logout Guard interrogeant l'API de pointage).
* Requête d'ajustement retroactive d'heures par un gestionnaire RH.

---

## 9. Flux sortants
Le module produit et diffuse les événements suivants :
* `SHIFT_DEMARRE` : Émis lors du pointage d'arrivée (permet d'actualiser la présence physique de l'employé sur la console de supervision).
* `SHIFT_TERMINE` : Émis lors de la clôture de service.
* `SHIFT_TIMEOUT_AUTO` : Émis par la tâche planifiée de nuit en cas d'oubli de pointage de fin de shift d'un employé.

---

## 10. Dépendances autorisées
Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants :
* `auth` : Pour identifier de manière certaine l'utilisateur connecté émettant la requête de pointage de présence en production.
* `audit` : Pour consigner synchrone l'historique d'ajustement d'heures ou d'invalidation logique de shifts de présence d'un collaborateur.

---

## 11. Dépendances interdites
Ce module a l'interdiction stricte de dépendre de :
* `billing` / `payments` : Aucun point de contact technique. Les ressources humaines ne se connectent pas à la facturation d'exploitation hôtelière courante. *Justification : Ségrégation stricte de la paie et de la comptabilité de ventes.*
* `stay` / `reservations` : Pas d'accès au CRM ou au planning d'occupation des chambres. *Justification : Découplage complet de l'organisation interne du personnel et de l'activité commerciale.*
* `housekeeping` / `maintenance` : Le module n'appelle pas l'exécution physique des tâches d'entretien ou de réparation hôtelière. *Justification : Préservation de la modularité.*

---

## 12. Contraintes métier
* **Exclusivité Temporelle Serveur :** L'heure de début, de fin de shift ou de segment d'activité provient exclusivement et strictement de l'horloge système du serveur backend (`new Date()`). Les requêtes HTTP d'API de pointage ne doivent accepter aucun paramètre de date ou d'heure en corps ou paramètre sous peine de rejet immédiat.
* **Exigence de Motif :** La modification a posteriori d'une fiche d'heures par un gestionnaire RH exige un motif textuel écrit explicatif d'au moins **10 caractères**.

---

## 13. Invariants
* **INV-RH-001 (Monopole de présence active) :** Un collaborateur ne peut posséder qu'**un seul** shift d'activité dans un statut actif (`ACTIF` ou `EN_PAUSE`) à un instant $t$. L'initiation d'un nouveau shift est systématiquement bloquée s'il existe déjà une présence en cours.
* **INV-RH-002 (Non-suppression physique) :** Les entités de pointage `TimeShift` et `TimeShiftSegment` ne font jamais l'objet d'une suppression physique en base de données afin de garantir la sincérité du journal d'heures face aux audits sociaux et de l'inspection du travail.

---

## 14. États manipulés
Le cycle d'activité du shift de présence est régi par `StatutTimeShift` :
* `NON_DEMARRE`
* `ACTIF`
* `EN_PAUSE`
* `TERMINE`

---

## 15. Points sensibles
* **Les oublis de fin de shift :** Risques d'heures de service cumulées indéfiniment en cas de collaborateurs quittant l'établissement en omettant de déclarer la fin de leur service dans l'application.
  * *Résolution :* Mise en place d'un Cron Job automatisé de nuit (à 04h00) identifiant et clôturant d'office les shifts "orphelins" actifs depuis plus de 14 heures consécutives, tout en émettant une alerte dans la boîte de réception RH pour contrôle humain.

---

## 16. Dette technique connue
* *Aucune dette technique identifiée à ce stade.*

---

## 17. Fonctionnalités prévues ultérieurement
* **Phase 3 :** Intégration de verrous biométriques ou de géolocalisation sécurisée des mobiles d'équipiers d'étages et de maintenance pour valider physiquement la présence dans les murs de l'établissement au moment du pointage.

---

## 18. Checklist de Pull Request
Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] La route d'API de pointage de présence utilise exclusivement l'heure système du serveur hôte pour initialiser les segments temporels.
* [ ] Le processus de déconnexion de l'application PMS interroge l'API de pointage et bloque l'effacement de session si le store d'état indique un shift toujours `ACTIF` ou `EN_PAUSE` sans confirmation explicite.
* [ ] Toute mise à jour rétroactive d'heures ou d'historique de shifts de présence exige la permission `hr:write` et valide la présence d'un motif explicatif d'au moins 10 caractères.
* [ ] La création de shifts d'activité effectue un contrôle d'unicité bloquant l'enregistrement en cas de présence active préexistante en base pour cet utilisateur.
