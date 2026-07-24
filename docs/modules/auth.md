# Spécification Technique — Module Authentification & RBAC (auth.md)

*Créé lors de CH-018 (`docs/governance/REGISTRE_CHANTIERS.md`) — spec manquante malgré un module backend complet et déjà largement documenté au fil de l'eau dans `CLAUDE.md` (rotation de jetons CH-026(f), verrouillage de compte CH-026(c), etc.). Ce document consolide ces éléments dans le même format que les autres modules.*

---

## 1. Objectif du module

Le module **Authentification & RBAC** est le point d'entrée unique de vérification d'identité de tout utilisateur du PMS (interface desktop et mobile housekeeping) et le socle de la vérification des permissions fines (`PermissionsGuard`) appliquée à toutes les routes protégées de l'application.

---

## 2. Responsabilités

Le module est seul responsable de :
* La vérification des identifiants (email/mot de passe) et l'émission des jetons JWT (accès + rafraîchissement).
* La rotation et la révocation des jetons de rafraîchissement (usage unique, CH-026(f)).
* Le verrouillage temporaire d'un compte après une série d'échecs de connexion consécutifs (CH-026(c)).
* Le flux « mot de passe oublié » (jeton à durée de vie limitée, envoyé par email via `NotificationsModule`).
* L'émission d'un jeton d'accès à portée restreinte (`scope: 'mobile-housekeeping'`) pour l'application mobile Housekeeping (F9), distinct des jetons desktop mais signé avec le même secret.
* L'exposition de l'identité et des permissions effectives de l'utilisateur connecté (`GET /auth/me`), source de vérité du gating RBAC frontend (CH-011).

---

## 3. Hors périmètre

Le module n'intervient jamais dans :
* La définition des permissions elles-mêmes (`Permission`, `RolePermission`) — attribution figée par `prisma/seed.ts`, aucune route de gestion de rôle/permission n'existe dans ce projet (pas de besoin exprimé au-delà des 6 rôles fixes).
* La création de fiches personnel (`Employee`) — confiée au module `hr`, qui référence `User` mais ne le crée jamais lui-même (aucune route de provisioning composite `User`+`Employee` n'existe à ce jour, voir `docs/planning/CADRAGE_PLANNING_ATTENDANCE_STAFF.md`, cadré mais non implémenté).
* Le pointage de présence en temps réel (`TimeShift`/`TimeShiftSegment`) — confié au module `hr` (ADR-007), qui consomme l'identité authentifiée mais ne dépend d'aucune autre logique de ce module.

---

## 4. Entités manipulées

Ce module manipule et gère directement les entités suivantes du `DATA_DICTIONARY.md` :
* `User` (lecture, mise à jour de `motDePasseHash` uniquement — jamais de création, voir §3)
* `Role`, `Permission` (lecture seule — jointure pour résoudre les permissions effectives)
* `LoginLog` (écriture à chaque tentative de connexion, succès et échec — réutilisée aussi comme base du verrouillage CH-026(c), aucune table dédiée créée pour cela)
* `RefreshToken` (`jti`/`userId`/`expiresAt`/`revokedAt` — CH-026(f))
* `PasswordResetToken` (`token`/`expiresAt`/`utiliseAt` — jeton à usage unique, BR-AUD-003)

---

## 5. BUSINESS_RULES concernées

* **BR-AUD-003 (Durée de vie limitée des liens d'authentification)** : les jetons de réinitialisation de mot de passe (`forgot-password`) expirent strictement après **30 minutes** (`RESET_TOKEN_TTL_MINUTES`, `auth.service.ts`) — passé ce délai, `resetPassword()` rejette explicitement le jeton même syntaxiquement valide.

---

## 6. ADR concernées

* **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md)** : ce module authentifie l'utilisateur (`JwtAuthGuard`, global) — la vérification de permission elle-même (`PermissionsGuard`) est une brique distincte qui s'exécute après, mais s'appuie sur l'identité que ce module a validée.

---

## 7. Permissions RBAC

Toutes les routes de ce module sont `@Public()` (aucune permission requise, cohérent avec leur nature — s'authentifier ne peut pas exiger d'être déjà authentifié), à une seule exception :
* `GET /auth/me` : aucune permission dédiée, mais **exige un jeton valide** (pas de `@Public()`) — tout utilisateur authentifié peut consulter sa propre identité et ses propres permissions effectives (CH-011, source de vérité du gating RBAC frontend). Les permissions renvoyées sont recalculées à chaque appel par une requête fraîche — jamais mises en cache dans le JWT (même discipline que `PermissionsGuard`, retirer un droit à un rôle doit se refléter immédiatement).

---

## 8. Flux entrants

Le module intercepte les événements et requêtes suivants :
* `POST /auth/login` (`@Public`, throttlé 5/min) — email + mot de passe.
* `POST /auth/refresh` (`@Public`, throttlé 5/min) — rotation à usage unique du jeton de rafraîchissement.
* `POST /auth/logout` (`@Public`, `204`, throttlé 5/min) — révocation explicite, idempotente et tolérante à un jeton déjà invalide/expiré.
* `POST /auth/forgot-password` (`@Public`) — email uniquement, réponse strictement identique que le compte existe ou non (anti-énumération de comptes).
* `POST /auth/reset-password` (`@Public`) — jeton + nouveau mot de passe (complexité exigée, CH-026(d)).
* `GET /auth/roles-actifs` (`@Public`) — liste des rôles disponibles (formulaire de connexion, pas de données sensibles).
* `GET /auth/me` — identité + permissions effectives de l'utilisateur connecté.
* `POST /mobile/housekeeping/login` (`@Public`, throttlé 5/min, exposée par `MobileHousekeepingController` du module `housekeeping`, F9) — délègue à `AuthService.loginMobile()`, même vérification d'identifiants que `login()` (`authenticateCredentials()` partagée), jamais un second code de vérification.

---

## 9. Flux sortants

Le module ne produit aucun événement inter-module (`@nestjs/event-emitter`) — il consomme `NotificationsModule` (façade `MailerService` uniquement) pour l'envoi de l'email de réinitialisation, sans passer par le pipeline `notify()`/consentement/journalisation habituel de F7 (un email de sécurité n'est pas une communication CRM soumise à `Guest.consentementNotifications` — il ne s'adresse d'ailleurs pas à un `Guest` mais à un `User`).

---

## 10. Dépendances autorisées

Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants :
* `notifications` : façade `MailerService` uniquement (email de réinitialisation de mot de passe), jamais le pipeline `notify()` complet.

Symétriquement, `NotificationsModule` n'importe jamais `AuthModule` en retour — aucune dépendance circulaire.

---

## 11. Dépendances interdites

Ce module a l'interdiction stricte de dépendre de :
* Tout module métier opérationnel (`reservations`, `stay`, `billing`, etc.) : l'authentification est un socle transverse consommé par tous les autres modules, jamais l'inverse. *Justification : une dépendance descendante introduirait un cycle et coupler la disponibilité de l'authentification à un domaine métier particulier.*

---

## 12. Contraintes métier

* **Limite resserrée sur `/login`/`/refresh`/`/logout`/mobile login** : 5/min/IP (contre 100/min par défaut ailleurs) — ces routes sont la cible directe d'une attaque par force brute, ce que le RBAC seul ne couvre pas (l'utilisateur n'est justement pas encore authentifié).
* **Verrouillage de compte (CH-026(c))** : `LOCKOUT_THRESHOLD = 5` tentatives, fenêtre glissante `LOCKOUT_WINDOW_MINUTES = 15` — un compte est verrouillé si ses 5 tentatives les plus récentes sont **toutes** des échecs, y compris avec le bon mot de passe une fois la fenêtre ouverte (empêche un attaquant ayant deviné/volé le mot de passe pendant la fenêtre de blocage). Compromis assumé et documenté (`docs/governance/REGISTRE_DECISIONS.md`, RD-016) : révèle qu'un compte existe, tradeoff standard OWASP de tout mécanisme de verrouillage.
* **Complexité de mot de passe (CH-026(d))** : `ResetPasswordDto.nouveauMotDePasse` exige au moins une minuscule, une majuscule et un chiffre, en plus des 8 caractères minimum.
* **Rotation de refresh token à usage unique (CH-026(f))** : chaque `POST /auth/refresh` révoque systématiquement l'ancien jeton avant d'émettre le nouveau — un refresh token volé et rejoué après que le titulaire légitime a déjà rafraîchi échoue désormais (alors qu'un JWT stateless restait valable jusqu'à expiration naturelle quel que soit le nombre de réutilisations).
* **Jeton mobile à portée réduite (F9)** : `loginMobile()` émet un jeton unique `scope: 'mobile-housekeeping'`, TTL `MOBILE_JWT_EXPIRES_IN` (défaut 8h), **sans** refresh token (ré-authentification périodique volontairement simple). `JwtAuthGuard` (global) rejette tout jeton portant ce scope en dehors de `/api/mobile/housekeeping/*` — défense en profondeur contre un appareil perdu/volé, asymétrique par choix (un jeton desktop normal reste utilisable sur les routes mobiles, un privilège plus large n'est jamais un abaissement de sécurité sur une surface plus étroite).

---

## 13. Invariants

* **Access token entièrement stateless** : aucune lecture base sur son chemin de vérification (`JwtAccessStrategy.validate()` retourne le payload signé tel quel) — seul le refresh token embarque un `jti` unique et une ligne `RefreshToken` correspondante.
* **Réponse identique compte existant/inexistant sur `forgot-password`** : anti-énumération de comptes, aucune branche de code ne doit distinguer les deux cas dans la réponse HTTP.
* **`logout()` idempotent** : `updateMany({ where: { jti, revokedAt: null } })` ne lève jamais d'exception pour un jeton déjà invalide, inexistant ou expiré — la déconnexion locale côté client ne doit jamais être bloquée par un aléa serveur.

---

## 14. États manipulés

Ce module ne porte pas de machine à états métier propre — les seuls « états » qu'il gère sont binaires et attachés à des enregistrements ponctuels : `RefreshToken.revokedAt` (null = actif) et `PasswordResetToken.utiliseAt` (null = consommable). Le verrouillage de compte (CH-026(c)) n'est lui-même pas un champ d'état stocké — il est recalculé à chaque tentative de connexion à partir des lignes `LoginLog` récentes (cohérent avec l'absence de cron dans ce projet).

---

## 15. Points sensibles

* **Verrouillage de compte révèle son existence** : un attaquant peut distinguer un compte verrouillé (message dédié) d'un compte avec mauvais mot de passe — compromis OWASP assumé (RD-016), impact limité pour un effectif de quelques employés.
* **Cookie `httpOnly` explicitement différé (CH-026(e))** : les jetons restent stockés côté frontend en `localStorage` + en-tête `Authorization: Bearer`, pas en cookie `httpOnly`/`SameSite` — reporté car cela suppose de concevoir une protection CSRF (absente aujourd'hui, non nécessaire tant qu'aucune requête d'état n'est portée par un cookie envoyé automatiquement par le navigateur) et de revoir le carve-out CORS documenté pour F4/F6 (`main.ts`). Voir `docs/governance/REGISTRE_DECISIONS.md` (RD-016).

---

## 16. Dette technique connue

* **CH-026(e)** : migration vers un cookie `httpOnly` explicitement reportée (voir §15) — sous-chantier distinct si repris, aucune urgence identifiée pour un PMS interne mono-établissement.
* **Aucune route de gestion de rôles/permissions** : `Role`/`Permission`/`RolePermission` sont figés par `prisma/seed.ts`, aucun CRUD exposé — non implémenté car aucun besoin exprimé de créer un rôle personnalisé pour cette v1 (6 rôles fixes suffisent au périmètre de l'hôtel).

---

## 17. Fonctionnalités prévues ultérieurement

* **Provisioning composite `User`+`Employee`** (cadrage `docs/planning/CADRAGE_PLANNING_ATTENDANCE_STAFF.md`, `CH-027`, validé en principe mais non planifié) : aujourd'hui, aucune route ne permet de créer un `User` — ajouter un employé réel nécessite un accès direct à la base. Resterait dans le module `hr` (`hr/employees.*`), pas dans `auth`, ce module se contentant de vérifier des identifiants déjà existants.

---

## 18. Checklist de Pull Request

Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] Toute nouvelle route sensible reste `@Public()` uniquement si elle ne peut légitimement pas exiger d'authentification préalable (login, refresh, logout, mot de passe oublié).
* [ ] Aucune information ne permet de distinguer un compte existant d'un compte inexistant dans la réponse de `forgot-password`.
* [ ] Toute émission de jeton de rafraîchissement crée bien une ligne `RefreshToken` correspondante, et toute réutilisation de l'ancien jeton après rotation est explicitement rejetée.
* [ ] Le verrouillage de compte est vérifié avant la comparaison bcrypt, jamais après (sinon un mot de passe correct pendant la fenêtre de blocage contournerait le mécanisme).
* [ ] Un jeton portant `scope: 'mobile-housekeeping'` reste rejeté par `JwtAuthGuard` en dehors de `/api/mobile/housekeeping/*`.
