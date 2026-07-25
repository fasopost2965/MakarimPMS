# Architecture Decision Record (ADR-007) : Time Shift & Attendance State Machine

Ce document formalise la conception technique, le comportement dynamique, les garanties d'inviolabilité et les contraintes d'intégrité du **système de pointage et de suivi de présence des collaborateurs (Time Shift)** du Property Management System (PMS) de l'Hôtel Makarim.

---

## 1. Métadonnées

* **Identifiant :** ADR-007
* **Titre :** Time Shift & Attendance State Machine (Gestion du pointage et de la présence)
* **Statut :** Validé
* **Date :** 2026-07-19
* **Auteur :** Architecte Logiciel PMS Makarim
* **Documents de référence :**
  * `BUSINESS_RULES.md` (BR-RH-003, BR-RH-004, BR-RH-005, BR-AUD-001)
  * `DATA_DICTIONARY.md` (Entités `TimeShift`, `TimeShiftSegment`, `User`)
  * `RBAC_MATRIX.md` (Permissions des rôles RH, Réception, Ménage, Maintenance, Administrateur)
  * `ADR-005 — Audit & Soft Delete` (Journalisation obligatoire des corrections d'heures)
  * `ADR-006 — RBAC Enforcement` (Rôles d'autorisation d'ajustement)

---

## 2. Contexte

La maîtrise des horaires de présence et de la planification des ressources humaines est un enjeu d'efficacité opérationnelle et de conformité légale pour l'Hôtel Makarim (24 chambres, Tétouan) :
1. **Risque de fraude ou de falsification horaire :** Si l'application fait confiance à l'horloge de l'appareil client (navigateur web, smartphone d'équipier de ménage ou de technicien) pour enregistrer les heures d'arrivée ou de départ, un collaborateur malveillant peut facilement modifier l'heure locale de son système pour simuler une présence fictive ou dissimuler un retard.
2. **Double pointage et sessions concurrentes :** Dans un environnement multi-terminaux (postes fixes à la réception, tablettes mobiles d'étage, smartphones personnels), un collaborateur pourrait théoriquement démarrer des shifts en double, ou pointer actif sur plusieurs appareils à la fois pour tromper le système de comptabilisation des heures réelles travaillées.
3. **Oublis de fin de shift et dérive des sessions :** Un employé pressé en fin de service peut fermer son navigateur, éteindre sa tablette ou simplement cliquer sur "Se déconnecter" sans avoir formellement clos son shift d'activité. Sans mécanisme de blocage ou d'alerte, cela génère des shifts restés "actifs" indéfiniment, faussant les calculs de paie et bloquant les rapports de planification.
4. **Modifications rétroactives clandestines :** La correction manuelle des heures de travail par un responsable ne doit jamais se faire de manière silencieuse ou arbitraire, sous peine de violer la législation du travail et d'ouvrir la porte à des falsifications RH.

---

## 3. Décision

Pour garantir une étanchéité absolue et une conformité comptable et RH irréprochable, nous actons l'implémentation d'un module de **Time Shift & Attendance** articulé autour de plusieurs piliers technologiques :

### 3.1. Suprématie de l'Horloge Serveur (Server-Side Time Authority)
Toutes les dates et heures de début, de pause, de reprise ou de fin d'activité d'un shift sont **générées strictement par l'horloge système du serveur** au moment de la réception de la requête REST (`new Date()`).
* Les payloads d'API envoyés par l'interface frontend (`body` de la requête HTTP) ne doivent **jamais** inclure de champ de date ou d'heure pour le pointage.
* Toute requête tentant de soumettre un timestamp arbitraire est rejetée avec un code d'erreur `400 Bad Request`.

### 3.2. Machine à États du Shift (`StatutTimeShift`)
Le cycle de vie de la présence d'un employé est régi par une énumération stricte de statuts :
* **`NON_DEMARRE` :** L'employé n'a pas commencé sa journée de travail.
* **`ACTIF` :** Le collaborateur est actuellement en service. Les heures de travail s'accumulent en temps réel.
* **`EN_PAUSE` :** Le collaborateur a temporairement interrompu son service (ex. temps de repas). Le décompte des heures de travail effectives est suspendu.
* **`TERMINE` :** Le service de la journée est clos. Le shift est scellé opérationnellement.

### 3.3. Isolation par Segments Temporels (`TimeShiftSegment`)
Pour calculer précisément les heures de travail effectif sans perdre la traçabilité des pauses :
* L'entité `TimeShift` fait office de conteneur global pour la journée.
* Chaque action de l'utilisateur crée un segment chronologique `TimeShiftSegment` doté d'un type (`TRAVAIL` ou `PAUSE`), d'un début et d'une fin générés par le serveur.
* Le cumul des heures travaillées est la somme stricte de la durée des segments de type `TRAVAIL`.

### 3.4. Unicité et Anti-Session Multi-Terminaux
Le système interdit le pointage simultané :
* Un employé ne peut démarrer un shift s'il possède déjà un enregistrement dans l'état `ACTIF` ou `EN_PAUSE` associé à son identifiant d'utilisateur.
* La requête d'initiation de shift effectue une vérification d'unicité en base de données. Si une collision est détectée, elle est bloquée avec une erreur descriptive `409 Conflict`.

### 3.5. Interception de Déconnexion (Logout Blocking Guard)
* **Contrôle d'activité au Logout :** Le processus de déconnexion de l'application PMS (action de l'utilisateur ou expiration de session active) interroge l'API de pointage.
* Si le serveur détecte que l'utilisateur possède un shift `ACTIF` ou `EN_PAUSE` :
  1. L'action de déconnexion est temporairement bloquée par l'interface UI.
  2. Une modale d'alerte s'affiche, lui imposant de choisir entre : "Clôturer mon service" (clôture le shift et le déconnecte), "Mettre mon service en pause" (passe le shift en pause et le déconnecte) ou "Annuler" (interrompt la déconnexion).

---

## 4. Invariants de Présence (Security & Operational Invariants)

* **INV-TSH-001 (Monopole Temporel Serveur) :** Les attributs `startedAt` et `endedAt` des entités `TimeShift` et `TimeShiftSegment` proviennent exclusivement du serveur hôte au moment transactionnel de l'insertion SQL.
* **INV-TSH-002 (Unicité de Pointage Actif) :** Un utilisateur ne peut avoir au maximum qu'**un seul** shift actif (`ACTIF` ou `EN_PAUSE`) à un instant $t$.
* **INV-TSH-003 (Linéarité des Transitions) :** Les transitions d'état du shift doivent strictement respecter la logique séquentielle autorisée par la machine à états. Un passage direct de `NON_DEMARRE` à `TERMINE` ou de `EN_PAUSE` à `TERMINE` sans passer par un segment de reprise actif est interdit.
* **INV-TSH-004 (Sûreté d'Audit des Ajustements) :** Toute modification manuelle a posteriori des heures réelles d'un shift ou d'un segment par un gestionnaire RH ou un Administrateur est interdite d'accès direct. Elle doit obligatoirement transiter par un service d'ajustement qui écrit une ligne d'audit d'action `UPDATE_SHIFT` dans `AuditLog`, détaillant l'ancienne heure, la nouvelle heure, l'ID de l'employé et un motif d'ajustement écrit de 10 caractères minimum (BR-AUD-001).
* **INV-TSH-005 (Non-Suppression Physique des Shifts) :** Aucune entité de pointage `TimeShift` ou `TimeShiftSegment` ne peut faire l'objet d'une suppression physique en base de données. En cas d'erreur de pointage accidentelle (ex: un employé n'aurait pas dû pointer), le shift est invalidé logiquement via `deletedAt` avec justification obligatoire et log d'audit.

---

## 5. Machine à États et Transitions de Pointage

Le graphe ci-dessous représente les transitions nominales de pointage garanties par le serveur backend :

```
         ┌────────────────────────────────────────────────────────┐
         │                                                        │
         ▼                                                        │
   ┌───────────┐         Démarrer Service                         │
   │NON_DEMARRE├─────────────────────────────────┐                │
   └─────▲─────┘                                 │                │
         │                                       ▼                │
         │                                 ┌───────────┐          │
         │          Reprendre Service      │  ACTIF    │          │
         │       ┌────────────────────────►│(En travail│          │
         │       │                         └─────┬─────┘          │
         │       │                               │                │
         │       │                               │ Mettre en pause│
         │       │                               ▼                │
         │ ┌─────┴─────┐                   ┌───────────┐          │
         │ │ EN_PAUSE  │◄──────────────────┤ EN_PAUSE  │          │
         │ └───────────┘                   └───────────┘          │
         │                                                        │
         │ Terminer Service                                       │
         └────────────────────────────────────────────────────────┘
                                                 │
                                                 │ Clôturer Service
                                                 ▼
                                           ┌───────────┐
                                           │  TERMINE  │  ➔ (Shift scellé)
                                           └───────────┘
```

### Matrice de Transition du Pointage

| Statut Initial | Statut Cible | Action Utilisateur | Action Système | Séquence des Segments |
| :--- | :--- | :--- | :--- | :--- |
| `NON_DEMARRE` | `ACTIF` | "Démarrer mon service" | Création d'un `TimeShift` + Segment `TRAVAIL` | Débute à $t_{serveur}$ |
| `ACTIF` | `EN_PAUSE` | "Prendre une pause" | Clôture le segment `TRAVAIL` actif ➔ Crée un segment `PAUSE` | Débute à $t_{serveur}$ |
| `EN_PAUSE` | `ACTIF` | "Reprendre mon service" | Clôture le segment `PAUSE` actif ➔ Crée un segment `TRAVAIL` | Débute à $t_{serveur}$ |
| `ACTIF` | `TERMINE` | "Clôturer mon service" | Clôture le segment `TRAVAIL` actif ➔ Ferme l'entité `TimeShift` | Scelle le shift à $t_{serveur}$ |

---

## 6. Traitement des Cas Particuliers

### 6.1. La Perte de Connexion Réseau (Offline / Timeout)
Si un équipier de ménage perd la connexion réseau de sa tablette à l'intérieur d'une chambre au moment de clore son shift :
* L'application web React sauvegarde l'intention de l'action localement.
* Cependant, le calcul officiel du temps de travail effectif reste régi par l'heure de réception finale de la requête REST par le serveur.
* En cas d'écart significatif dû à une panne réseau prolongée, le collaborateur formule une demande de correction manuelle auprès de la Gouvernante ou du responsable RH.

### 6.2. Le Pointage à Cheval sur Minuit (Shift de Nuit)
Pour le veilleur de nuit ou le réceptionniste assurant le shift de nuit (ex. 20h00 à 08h00 le lendemain) :
* Le shift n'est pas coupé automatiquement à 23h59. Le `TimeShift` reste actif d'un jour sur l'autre sous une même entité.
* Le système de consolidation comptable et de reporting RH sait ventiler dynamiquement les heures de présence affectées à chaque journée d'exploitation calendaire lors de la génération des statistiques de fin de mois.

### 6.3. Le Verrou de Sécurité Anti-Oubli (Auto-Timeout d'Urgence)
Si un collaborateur quitte l'établissement en oubliant de clore son shift de travail :
* Le système implémente une tâche de fond automatisée (Cron Job de nuit à 04h00) qui identifie les shifts restés `ACTIF` ou `EN_PAUSE` depuis plus de **14 heures consécutives**.
* Le système clôture automatiquement ces shifts "orphelins" au statut `TERMINE` à l'heure théorique planifiée de fin de shift de l'employé, ou à défaut après 8 heures d'activité théorique.
* Cette action génère automatiquement une alerte système dans la boîte de réception RH pour imposer une vérification et une validation humaine de l'horaire.

### 6.4. Ajustements des Horaires par le Gestionnaire RH
Si un employé a pointé en retard ou a oublié de déclarer sa pause repas :
* Le gestionnaire RH (ou l'Administrateur) ouvre la fiche de pointage de l'employé.
* Il applique la correction. Le système met à jour les heures des segments de manière synchrone.
* L'ancienne valeur de l'heure, la nouvelle valeur, l'ID utilisateur de l'auteur de la correction et le motif textuel explicatif de la modification (au moins 10 caractères) sont écrits de manière atomique dans la table `AuditLog`.

---

## 7. Alternatives rejetées

### Alternative A : Confiance aux Horaires Client (Frontend-Based Timestamps)
* **Description :** Transmettre la date et l'heure générées par le navigateur de l'utilisateur lors de l'appel d'API de pointage.
* **Pourquoi elle a été rejetée :** Risque de fraude trop élevé. N'importe quel utilisateur pourrait manipuler frauduleusement l'horloge de son PC ou de sa tablette de ménage pour cacher des retards systématiques, simuler des heures supplémentaires imaginaires ou s'absenter prématurément de l'hôtel.

### Alternative B : Clôture Automatique Silencieuse lors de la Déconnexion (Silent Auto-Clockout)
* **Description :** Clôturer automatiquement le shift d'activité de l'utilisateur dès qu'il clique sur "Se déconnecter" de l'application, sans lui demander son avis.
* **Pourquoi elle a été rejetée :** Cette approche masque les dysfonctionnements et fausse les statistiques opérationnelles. L'employé doit être responsabilisé sur la déclaration physique de son service. Imposer une modale de choix lors de la tentative de déconnexion garantit un enregistrement explicite des heures effectives travaillées et évite les malentendus.

---

## 8. Conséquences de la Décision

* **Architecture Backend :** Sécurisation et rigueur absolue. L'authentification et les modules RH/Pointage sont fortement couplés. Les contrôleurs NestJS valident l'unicité et le séquencement des segments avant d'accorder le commit en base de données.
* **Architecture Frontend (React) :** Implémentation d'un interceptor de navigation global et de handlers de déconnexion (`logout`) pour vérifier l'état du shift de l'utilisateur connecté avant d'autoriser la destruction de la session JWT locale.
* **Conformité Comptable & Sociale :** La consolidation mensuelle des fiches de paie et le calcul des cotisations sociales CNSS s'appuient sur des données de présence d'une exactitude mathématique et inviolables, éliminant les litiges sociaux et les pénalités d'audit.
* **Auditabilité :** Les anomalies d'oublis ou d'ajustements administratifs de pointage sont 100% auditables par la Direction, renforçant la confiance interne et le contrôle de gestion.

---

## 9. Anti-patterns (Pratiques strictement interdites)

* **Anti-Pattern #1 (Date envoyée par l'API) :** Exposer ou consommer un endpoint de pointage acceptant une valeur temporelle dans son corps JSON (ex: `POST /api/time-shifts/demarrer { time: "2026-07-19T08:00:00" }`).
* **Anti-Pattern #2 (Bypass de Vérification d'Unicité) :** Insérer ou modifier un shift de pointage en base de données sans exécuter au préalable la requête de contrôle d'existence de shift actif pour cet ID utilisateur.
* **Anti-Pattern #3 (Ajustement sans Audit Log) :** Permettre la modification d'un enregistrement `TimeShift` ou `TimeShiftSegment` par un administrateur ou un responsable RH sans insérer de manière atomique la ligne d'audit d'historique de modification.
* **Anti-Pattern #4 (Modale de déconnexion passive) :** Mettre en place un simple popup d'information au logout que l'utilisateur peut fermer pour se déconnecter sans avoir effectivement clôs ou mis en pause son shift. L'action doit être bloquante ou forcer la clôture automatique encadrée.

---

## 10. Checklist de conformité pour les Pull Requests (Module Pointage)

Avant d'intégrer des modifications de code sur le module RH, l'authentification, ou le tableau de présence des employés, vérifiez rigoureusement la liste suivante :

* [ ] **Heure exclusivement serveur :** L'heure de début ou de fin de shift/segment n'est jamais récupérée de la requête client ; elle est initialisée au sein du service backend via `new Date()`.
* [ ] **Garantie d'unicité de shift actif :** Le service de démarrage de shift vérifie l'absence de shift `ACTIF` ou `EN_PAUSE` pour l'utilisateur authentifié avant l'insertion en base, et lève un code `409 Conflict` en cas de violation.
* [ ] **Audits de correction :** Les méthodes de mise à jour rétroactive des horaires de présence requièrent un motif textuel de 10 caractères minimum et écrivent de manière transactionnelle l'ancienne et la nouvelle valeur dans `AuditLog`.
* [ ] **Protection des endpoints de pointage :** Les routes d'API de pointage de présence exigent une authentification JWT valide et extraient l'ID de l'employé directement de la session décodée.
* [ ] **Intercepteur UI de déconnexion :** Le gestionnaire d'état frontend React intègre un garde-fou sur le bouton de déconnexion, bloquant l'action si le store d'état local ou l'API de pointage indique un shift toujours en cours.
