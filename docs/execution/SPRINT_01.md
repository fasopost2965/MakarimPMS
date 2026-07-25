# SPRINT_01.md — Spécification d'Exécution : Module Auth (Authentification & RBAC)

Ce document spécifie les directives d'implémentation physique et d'ingénierie logicielle pour le **Sprint 01**, dédié au module d'Authentification et au contrôle d'accès basé sur les rôles (RBAC).

---

## 1. Objectif du Sprint
Mettre en place le système d'authentification robuste de l'Hôtel Makarim en s'appuyant sur un protocole double jeton (Access Token JWT de courte durée, Refresh Token stocké dans un cookie HttpOnly sécurisé) et configurer le contrôle d'accès RBAC (Role-Based Access Control) d'API côté serveur.

---

## 2. Métriques & Références d'Architecture

*   **Module concerné :** `auth`
*   **Documents de référence :** `RBAC_MATRIX.md`, `SECURITY_HANDBOOK.md`
*   **ADR utilisée :** `ADR-006-RBAC-Enforcement.md`
*   **Règles Métier (BUSINESS_RULES) concernées :**
    *   `BR-TR-004` : Vérification systématique des autorisations RBAC côté serveur d'API.
    *   `BR-RH-004` : Blocage de la déconnexion utilisateur (`Logout Guard`) si un shift de pointage est actuellement marqué actif.

---

## 3. Contrat d'Ingénierie & Signature Physique

### 3.1. Tables Prisma Concernées
*   **`User`** : Profil du collaborateur (id, email, passwordHash, nom, prenom, roleId, tokenVersion, deletedAt).
*   **`Role`** : Libellé du rôle d'exploitation (id, code, libelle).
*   **`Permission`** : Permissions fines d'Endpoints (id, code, description).
*   **`RolePermission`** : Table pivot d'association des permissions aux rôles.

### 3.2. Services NestJS à Implémenter
*   `AuthService` : Gestion du hachage de mot de passe (bcrypt), de la création de paires de jetons (Access / Refresh) et de la validation des sessions.
*   `SessionService` : Vérification en temps réel de la colonne `tokenVersion` pour l'invalidation active de session suspecte.

### 3.3. Controllers & Routes d'API
*   `AuthController` :
    *   `POST /api/v1/auth/login` : Authentification et écriture du Refresh Token dans un cookie HttpOnly.
    *   `POST /api/v1/auth/refresh` : Régénération d'Access Token via vérification du Refresh Token.
    *   `POST /api/v1/auth/logout` : Révocation du Refresh Token (vérifié par le Logout Guard).

### 3.4. DTOs
*   `LoginDto` : Validation de l'email (format standard) et du mot de passe (non vide).
*   `TokenResponseDto` : Contient l'Access Token et son expiration en secondes (15 minutes).

### 3.5. Guards, Pipes & Middlewares
*   `JwtAuthGuard` : Extrait et valide la signature de l'Access Token JWT.
*   `PermissionsGuard` : Intercepte la requête, lit la métadonnée `@Permissions()`, interroge les permissions de l'utilisateur et refuse l'accès en cas d'absence du privilège.
*   `LogoutGuard` : Intercepte l'appel `/auth/logout`, vérifie dans la table `TimeShift` si l'utilisateur possède une session active de pointage, et rejette la déconnexion avec l'erreur `PMS-012` s'il n'a pas pointé son départ (Clock-Out).

---

## 4. Stratégie de Validation & Tests

*   **Tests Unitaires :**
    *   Validation des algorithmes de hachage de mot de passe (bcrypt salé).
    *   Génération de jetons et décodage de payload JWT conforme.
*   **Tests d'Intégration :**
    *   Test de connexion réussie avec vérification de la présence du cookie sécurisé `HttpOnly` `Secure` `SameSite=Strict`.
    *   Tentative d'accès à un endpoint sécurisé avec un jeton expiré ou altéré (Retour attendu : Code HTTP 401 - `PMS-003`).
    *   Validation du refus d'accès d'un réceptionniste sur une route réservée aux administrateurs (Retour attendu : Code HTTP 403 - `PMS-002`).
*   **Tests E2E :**
    *   Cycle complet de Login ➔ Accès à la session ➔ Rafraîchissement du jeton ➔ Déconnexion réussie.

---

## 5. Gouvernance d'Exécution & Clôture

*   **Critères d'Acceptation :**
    *   L'authentification est totalement sécurisée côté serveur. Les informations d'identités et les permissions fines de la matrice RBAC sont correctement injectées lors du démarrage (via seed Prisma).
*   **Points de Vigilance :** Veiller à ce que la vérification de la colonne `tokenVersion` ne génère pas de surcharge de requêtes en base de données (mettre en place un cache mémoire léger).
*   **Dette Technique Autorisée :** Aucune pour ce module fondamental de sécurité.
*   **Définition de Terminé (DoD) :** Compilation réussie, couverture locale des tests à 90% au vert, linter impeccable.
