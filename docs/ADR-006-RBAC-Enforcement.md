# Architecture Decision Record (ADR-006) : RBAC Enforcement

Ce document formalise la conception, l'implémentation, et la validation du système de **Contrôle d'Accès Basé sur les Rôles (RBAC)** au sein du Property Management System (PMS) de l'Hôtel Makarim. Il définit l'autorité absolue du serveur dans la validation des droits et la ségrégation stricte des tâches métiers.

---

## 1. Métadonnées

* **Identifiant :** ADR-006
* **Titre :** RBAC Enforcement (Application stricte et étanchéité du contrôle d'accès)
* **Statut :** Validé (Complété)
* **Date :** 2026-07-19
* **Auteur :** Architecte Logiciel PMS Makarim
* **Documents de référence :**
  * `RBAC_MATRIX.md` (Spécification complète des privilèges et matrice matricielle des permissions des 6 rôles)
  * `BUSINESS_RULES.md` (BR-CHA-003, BR-SEJ-004, BR-HK-003, BR-MNT-001, BR-AUD-002, BR-COM-002, BR-RH-001)
  * `DATA_DICTIONARY.md` (Entités `User`, `Room`, `Stay`, `Folio`, `AuditLog`, `HousekeepingTask`, `MaintenanceTicket`)
  * `ADR-001 — Stay-Centric Architecture` (Centralité du séjour)
  * `ADR-002 — Folio & Billing Model` (Imputation financière et multi-folio)
  * `ADR-005 — Audit & Soft Delete` (Non-suppression et journalisation des anomalies)

---

## 2. Contexte

Le PMS de l'Hôtel Makarim (Tétouan, Maroc) orchestre l'activité de plusieurs services professionnels (Réception, Ménage, Technique, Comptabilité, Direction, RH) travaillant en simultané sur la même plateforme. L'application d'une sécurité d'accès rigoureuse est motivée par plusieurs problématiques majeures :
1. **Insuffisance des contrôles d'interface (Client-Side Only) :** Masquer un bouton d'action ou un onglet de menu dans l'interface utilisateur web (frontend React) est une mesure d'ergonomie et de confort de navigation, mais n'offre aucune sécurité réelle. N'importe quel utilisateur ou attaquant peut utiliser les outils d'inspection du navigateur pour simuler un clic, usurper un état local ou interroger directement l'API REST avec un outil tiers (Postman, curl) s'il n'y a pas de garde-fou côté serveur.
2. **Risques de malversation ou d'erreur financière :** Permettre à un réceptionniste d'accéder aux écritures comptables définitives ou d'annuler arbitrairement une facture émise (normalement réservé au Comptable) fragilise la conformité fiscale de l'hôtel. À l'inverse, laisser un technicien de maintenance ou un employé de ménage modifier des réservations clients expose à des pertes d'exploitation.
3. **Fuite d'informations hautement sensibles :** Les données clients (CRM), les fiches de police, et les relevés de masse salariale (RH) sont des données confidentielles et réglementées (RGPD / législation marocaine). Leur accès et leur exportation brute doivent être cantonnés au strict besoin opérationnel de profils spécifiquement habilités.
4. **Complexité de la traçabilité des modifications :** Lors de l'écriture d'un log d'audit, il est indispensable de connaître avec certitude l'identité et les habilitations de l'utilisateur à l'origine de l'action pour garantir la valeur juridique et managériale de l'audit.

---

## 3. Décision

Pour garantir une protection absolue de la plateforme et des données d'exploitation hôtelière, nous actons l'implémentation d'un modèle **RBAC Server-Authoritative (Contrôle d'Accès Validé par le Serveur)** structuré selon les décisions d'architecture suivantes :

### 3.1. Six Rôles Métiers Structurés
Le système reconnaît exclusivement l'énumération de rôles suivante (déclarée dans la table `User.role` et alignée sur `RBAC_MATRIX.md`) :
1. **`ADMINISTRATEUR` :** Accès global et sans restriction de lecture, écriture, soft-delete, et export.
2. **`RECEPTION` :** Front-desk. Lecture/écriture sur les réservations, les séjours, le CRM client minimal et le dashboard opérationnel. Aucun accès à la facturation comptable ou à la paie RH.
3. **`GOUVERNANTE` :** Supervision de l'entretien. Gestion des tâches de ménage (`HousekeepingTask`), lecture technique des pannes et modification du statut de stock de consommables.
4. **`COMPTABLE` :** Finance. Lecture/écriture complète sur la facturation, génération d'avoirs fiscaux, perception de règlements, et exportation des journaux de ventes.
5. **`MAINTENANCE` :** Technique. Gestion des tickets d'incidents techniques (`MaintenanceTicket`) et blocage technique des chambres. Aucun accès aux fiches clients ou à la facturation.
6. **`RH` :** Ressources Humaines. Gestion exclusive des fiches salariés, de la planification des Shifts, de l'enregistrement de présence et des calculs CNSS de paie.

### 3.2. Autorité Absolue du Serveur (Server-Side Enforcement)
* **Session portée par JWT :** L'authentification de l'utilisateur est matérialisée par un jeton web JSON (JWT) signé côté serveur. Ce jeton embarque de manière immuable l'ID utilisateur, son nom, et son rôle unique validé en base.
* **Extraction étanche côté Serveur :** Lors d'une requête vers un endpoint d'API protégé, le serveur extrait le rôle directement de la signature JWT validée. Les rôles transmis dans le corps (`body`) ou dans les paramètres de la route sont ignorés pour les décisions de sécurité.
* **Guards de Contrôleurs NestJS :** Chaque contrôleur ou route d'API du backend (hors route publique `/api/auth/login`) est protégé par une chaîne de validation combinant un garde d'authentification (`JwtAuthGuard`) et un garde d'autorisation de permissions (`PermissionsGuard`).

### 3.3. Déclarations de Permissions Granulaires
Plutôt que de coder des vérifications de rôles en dur dans la logique des services, le système associe à chaque route une **permission d'accès** explicite (ex: `billing:write`, `reservations:read`) via un décorateur NestJS :
```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('billing:write') // Exemple d'application d'autorisation étanche
@Post('payments')
async createPayment(...) { ... }
```

---

## 4. Invariants de Sécurité (Security Invariants)

* **INV-SEC-001 (Refus par Défaut - Fail-Safe Default) :** Tout endpoint d'API exposé sur le serveur (en dehors du login initial) est sécurisé par défaut. L'absence de décorateur de protection ou de permission explicite doit provoquer le rejet systématique de la requête (HTTP 401 Unauthorized / 403 Forbidden).
* **INV-SEC-002 (Inviolabilité du Rôle Authentifié) :** Le rôle d'un utilisateur utilisé pour autoriser une action et renseigner la table d'audit log doit provenir exclusivement du JWT vérifié et décodé côté serveur. Aucun paramètre client ne peut modifier ce rôle pour la session courante.
* **INV-SEC-003 (Unicité de Rôle Principal) :** Un utilisateur (`User`) n'est rattaché qu'à un unique rôle actif à la fois au sein du système.
* **INV-SEC-004 (Droits d'Exception Administrateur) :** Le rôle `ADMINISTRATEUR` fait office de passe-partout de sécurité. Le système de garde-fous de permissions du serveur lui attribue par défaut l'accès à n'importe quel module ou action (bypass/override programmatique de toutes les permissions).
* **INV-SEC-005 (Ségrégation Financière) :** Le rôle `RECEPTION` ne possède aucun droit d'écriture (`write`) sur le module financier `billing`. Il peut uniquement visualiser le solde algébrique lors du check-out pour confirmer l'égalité à 0.00 MAD, mais ne peut ni imputer un paiement, ni valider ou éditer une facture en base.
* **INV-SEC-006 (Lien de Permission Indissociable) :** Une permission d'accès (ex: `housekeeping:control`) est toujours formellement mappée à un ou plusieurs rôles de la matrice officielle. Aucun utilisateur ne peut se voir attribuer une permission isolée sans posséder le rôle correspondant.
* **INV-SEC-007 (Journalisation des Refus d'Accès) :** Toute tentative d'accès à une route d'API protégée par un utilisateur n'ayant pas les permissions suffisantes doit lever une exception `403 Forbidden` et générer de manière synchrone une écriture dans le journal système des infractions (avec ID utilisateur, timestamp, IP source et endpoint ciblé).
* **INV-SEC-008 (Interdiction d'Auto-Élévation de Privilèges) :** Un utilisateur ne peut jamais modifier son propre rôle ou ses propres permissions. L'administration des comptes utilisateurs (`users:write`) est réservée exclusivement au rôle `ADMINISTRATEUR`.

---

## 5. Impact par Module

L'application stricte du RBAC structure le comportement et l'isolation des données de chaque module applicatif :

* **Réservations :** Le rôle `RECEPTION` peut lire, créer et modifier des réservations (`reservations:write`). Les rôles `MAINTENANCE` ou `GOUVERNANTE` n'ont aucun accès de lecture ou d'écriture sur ce module.
* **Séjours :** La création de séjours (`checkin`) et la mise à jour de la table `Stay` sont réservées à `RECEPTION` et `ADMINISTRATEUR`. Aucun rôle opérationnel d'entretien ou comptable ne peut modifier directement le cycle de vie du séjour (hors check-out coordonné).
* **Chambres :** La visualisation de la grille d'état des chambres est commune, mais la modification d'état est cloisonnée. `RECEPTION` ne peut changer le statut d'une chambre que vers `OCCUPEE` ou `RESERVEE` via le processus métier d'enregistrement.
* **Housekeeping :** La création et le début de nettoyage des tâches (`HousekeepingTask`) sont accessibles aux équipiers de ménage (via l'interface de propreté), mais la validation finale `CONTROLEE` (libérant la chambre pour la vente) requiert exclusivement la permission `housekeeping:control` (détenue uniquement par la `GOUVERNANTE` et l'`ADMINISTRATEUR`).
* **Maintenance :** La création d'un ticket de panne (`MaintenanceTicket`) est accessible à la `RECEPTION` et à la `GOUVERNANTE` (`maintenance:write`). En revanche, la déclaration de résolution technique d'un incident de maintenance (et donc le déblocage de la chambre) est strictement réservée au rôle `MAINTENANCE`.
* **Facturation & Folios :** L'ajout ou l'annulation de lignes de folio (`FolioLine`) et l'édition de factures (`Invoice`) exigent la permission `billing:write`. Ce droit est réservé exclusivement au `COMPTABLE` et à l'`ADMINISTRATEUR`. La `RECEPTION` est limitée à la lecture du folio (`billing:read`) pour informer le client du solde courant.
* **Paiements :** L'enregistrement de règlements financiers dans la table `Payment` est une opération strictement contrôlée liée à la permission `payments:write`, restreinte au `COMPTABLE` et à l'`ADMINISTRATEUR`.
* **Comptabilité :** L'accès aux balances comptables de fin de journée, l'application de taux de TVA personnalisés, et la modification de configurations fiscales (`TaxRateConfig`) sont le domaine réservé du `COMPTABLE` et de l'`ADMINISTRATEUR`.
* **Ressources Humaines (RH) :** La planification des shifts d'employés (`Shift`), l'accès aux fiches de paie (`Payslip`), et l'imputation des grilles salariales CNSS sont isolés au sein d'un sous-système accessible uniquement par le rôle `RH` et l'`ADMINISTRATEUR` (`hr:write`). Aucun autre rôle hôtelier (y compris le Comptable ou la Gouvernante) ne peut lire ou écrire dans ces tables.
* **Reporting :** L'accès aux rapports analytiques stratégiques (taux d'occupation consolidé, RevPAR mensuel, statistiques d'annulation) est strictement réservé à l'`ADMINISTRATEUR`, au `COMPTABLE` et à la direction de l'hôtel.
* **Audit :** La lecture brute de la table `AuditLog` est strictement cantonnée au rôle `ADMINISTRATEUR` et au `COMPTABLE` pour des besoins d'investigation de fraude ou de contrôle fiscal.

---

## 6. Cas Particuliers

Pour les situations administratives ou de sécurité avancées non explicitement détaillées dans le cahier des charges d'origine, les règles d'intégrité suivantes s'appliquent :

### 6.1. Le Changement de Rôle d'un Collaborateur
Lorsqu'un administrateur met à jour le rôle d'un utilisateur en base (ex: promotion d'un réceptionniste vers un rôle de comptable) :
* *Décision métier à confirmer :* Le changement doit-il invalider instantanément toutes les sessions en cours de l'utilisateur ? Par mesure de sécurité par défaut, le serveur exigera la déconnexion et la ré-authentification de l'utilisateur pour appliquer son nouveau rôle.

### 6.2. La Désactivation d'un Utilisateur
En cas de départ d'un employé de l'Hôtel Makarim :
* L'utilisateur ne doit jamais être supprimé physiquement de la base de données afin de préserver l'historique de ses signatures d'actions et de ses logs d'audit.
* La fiche utilisateur est désactivée logiquement (`User.isActive = false`).
* Toute tentative de connexion d'un compte désactivé lève immédiatement une exception `401 Unauthorized` lors de la phase d'authentification.

### 6.3. La Suppression d'un Rôle Standard
* *Décision métier à confirmer :* Est-il possible de créer des rôles personnalisés ou de supprimer l'un des 6 rôles de la matrice ? Les 6 rôles définis dans `RBAC_MATRIX.md` sont codés de manière immuable sous forme d'une énumération en base de données. Aucune suppression de rôle n'est tolérée pour éviter de casser le typage fort de l'application.

### 6.4. Le Verrouillage de Compte suite à Échecs Multiples
* *Décision métier à confirmer :* Nombre maximal de tentatives de connexion échouées avant verrouillage temporaire du compte. En l'absence de règle, le système mettra en place un verrouillage par défaut après 5 échecs consécutifs, requérant l'intervention d'un Administrateur pour débloquer le compte.

### 6.5. L'Expiration de Session (Session Timeout)
Pour éviter qu'un écran de réception ou de ménage resté inactif au comptoir ne soit utilisé par une personne non autorisée :
* La durée de validité maximale d'un JWT de session active est fixée à **12 heures** (couvrant l'intégralité d'un shift d'exploitation).
* À l'expiration du jeton, toute requête vers le serveur est rejetée et l'interface client redirige instantanément l'utilisateur vers l'écran de connexion.

### 6.6. La Révocation Globale de JWT (JWT Revocation / Blacklist)
Si un terminal (tablette de ménage, ordinateur de réception) est déclaré volé ou perdu, ou si un compte utilisateur doit être instantanément suspendu :
* *Décision métier à confirmer :* Implémentation d'un système de liste noire des jetons JWT en cache ou utilisation d'un marqueur de réinitialisation de session (`User.tokenVersion` incrémenté lors de la déconnexion forcée). Le serveur implémentera par défaut le mécanisme de `tokenVersion` pour révoquer instantanément la validité d'un JWT en cours sans altérer la performance des requêtes standard.

### 6.7. Utilisateur sans Rôle (Orphelin)
* Un compte créé en base de données ne peut jamais avoir de champ de rôle nul ou vide (`User.role` obligatoire). L'enregistrement d'un utilisateur exige l'attribution d'un rôle valide de la matrice. Tout utilisateur orphelin se voit interdire l'accès par défaut (fail-safe).

---

## 7. Alternatives rejetées

### Alternative A : ACL (Access Control Lists) par Utilisateur Individuel
* **Description :** Associer des permissions de lecture, écriture et modification directement sur la fiche de chaque utilisateur individuel dans la base de données.
* **Pourquoi elle a été rejetée :** Trop lourd, complexe à maintenir et sujet aux erreurs d'administration pour un hôtel de 24 chambres. Les rôles opérationnels d'un hôtel sont clairs, standardisés, et correspondent exactement à des profils métiers prédéfinis. Le modèle RBAC par rôle est la solution la plus élégante, robuste et facile à auditer.

### Alternative B : Sécurisation uniquement au niveau des routes de navigation (Frontend-Only)
* **Description :** Sécuriser l'application en masquant les pages ou formulaires dans le framework Single Page Application (React) et laisser l'API backend ouverte.
* **Pourquoi elle a été rejetée :** Risque de sécurité critique et non professionnel. N'importe quel développeur ou utilisateur curieux pourrait contourner les restrictions en utilisant la console JavaScript, des extensions de navigateur, ou en émettant des requêtes HTTP forgées pour modifier les données, s'approprier des séjours ou s'exonérer de paiements.

---

## 8. Anti-patterns (Pratiques strictement interdites)

* **Anti-Pattern #1 (Vérifier un rôle uniquement dans React) :** Restreindre l'accès à une page de facturation dans l'interface React tout en laissant l'API `/api/billing/invoices` accessible en écriture sans contrôle d'autorisation côté serveur.
* **Anti-Pattern #2 (Masquer un bouton sans sécuriser l'API) :** Masquer le bouton de contrôle de propreté sur l'interface des équipiers de ménage sans protéger la route d'API `PATCH /api/housekeeping/:id/control` côté serveur.
* **Anti-Pattern #3 (Utiliser directement role === "ADMIN" partout) :** Coder en dur des vérifications de rôles spécifiques dans la logique des services ou contrôleurs NestJS. Utiliser systématiquement des permissions granulaires d'action (ex: `@Permissions('billing:write')`) définies de manière centralisée.
* **Anti-Pattern #4 (Ignorer RBAC pour les endpoints internes) :** Laisser des routes de synchronisation de stocks, d'imports de données ou de tâches de fond sans protection d'authentification et de permissions sous prétexte qu'elles sont "internes" ou "techniques".
* **Anti-Pattern #5 (Permissions codées en dur) :** Éparpiller les définitions de droits et permissions à travers le code. Tout le mapping Rôle ➔ Permissions doit être centralisé dans un fichier de configuration unique ou un dictionnaire de sécurité du serveur.

---

## 9. Checklist de conformité pour les Pull Requests (Module Sécurité)

Chaque développeur (y compris Claude Code) doit valider scrupuleusement la checklist de sécurité suivante avant de proposer une modification sur le backend ou le frontend :

* [ ] **Endpoint Protégé :** Chaque nouveau contrôleur d'API ou route de contrôleur ajoutée possède le décorateur `@UseGuards(JwtAuthGuard, PermissionsGuard)` et ne peut pas être interrogé de manière anonyme (hors auth/login).
* [ ] **Permission Déclarée :** La route d'API est associée à une permission granulaire claire et explicite via le décorateur `@Permissions('...')`.
* [ ] **Journalisation des Refus :** Le garde-fou d'autorisation (`PermissionsGuard`) est configuré pour intercepter les échecs, renvoyer une erreur `403 Forbidden` standard, et logger de manière synchrone la tentative avortée.
* [ ] **Compatible RBAC_MATRIX :** Le mapping de la nouvelle permission d'accès ou de la route correspond scrupuleusement aux privilèges définis pour chaque rôle au sein du fichier de référence `RBAC_MATRIX.md`.
* [ ] **Compatible BUSINESS_RULES :** Les contrôles de sécurité mis en œuvre respectent scrupuleusement les règles métiers associées aux actions (ex: BR-HK-003 pour la validation du ménage par la Gouvernante uniquement).
* [ ] **Compatible DATA_DICTIONARY :** La fiche utilisateur (`User`) lue en base respecte les types d'énumération de rôles définis physiquement dans Prisma et détaillés dans le dictionnaire de données.
* [ ] **Zéro Auto-Élévation :** Les routes permettant d'éditer ou de lister les comptes utilisateurs valident que l'appelant possède explicitement le rôle `ADMINISTRATEUR`.
