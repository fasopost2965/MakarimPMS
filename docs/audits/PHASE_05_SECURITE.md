# Audit technique — Makarim PMS v1
## Phase 5 — Sécurité

Analyse fondée sur lecture directe du code : `auth.service.ts`, `auth.controller.ts` et ses 4 DTO, `assert-strong-secrets.ts`, `JwtAuthGuard`, `PermissionsGuard`, `ChannelWebhookGuard`, `self-checkin.controller.ts`, `booking-engine.controller.ts`, `main.ts` (CORS/ValidationPipe/filters), `app.module.ts` (guards/throttler/logger), `.env.example`, le frontend (`token-storage.ts`, `api-client.ts`, `AppSidebar.tsx`). Aucune modification de fichier effectuée.

---

## 1. Authentification

**Mécanisme** : email + mot de passe (`bcrypt.compare`, hash stocké dans `User.motDePasseHash`, `BCRYPT_SALT_ROUNDS = 10`). `authenticateCredentials()` est le point de vérification unique, partagé par `login()` (desktop) et `loginMobile()` (F9). Chaque tentative (succès ou échec) est journalisée dans `LoginLog` — mais uniquement si l'utilisateur existe : une tentative sur un email inexistant n'est pas journalisée.

**Access/refresh tokens** : `issueTokens()` signe deux JWT distincts avec deux secrets distincts (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`), TTL par défaut 15 min / 7 jours. Le refresh (`POST /auth/refresh`) revérifie que l'utilisateur existe et est `actif`. **Aucune blacklist/rotation de refresh token détectée** : un refresh token compromis reste valide et réutilisable jusqu'à son expiration naturelle (7 jours par défaut).

**Mot de passe oublié** : `forgotPassword()` répond un message identique que l'email existe ou non (protection anti-énumération confirmée). **Mais le token de réinitialisation est retourné directement dans le corps de la réponse HTTP** plutôt qu'envoyé exclusivement par email — comportement documenté comme intérimaire dans le code lui-même, en attendant le module notifications. **Constat factuel** : le module notifications (F7) a été livré depuis mais **aucune valeur `PASSWORD_RESET` n'existe dans `EvenementNotification`**, et `AuthService.forgotPassword()` n'a jamais été raccordé à `NotificationsService.notify()`. Le comportement « temporaire » reste donc le comportement actuel.

**Politique de mot de passe** : `ResetPasswordDto.nouveauMotDePasse` exige `@MinLength(8)` uniquement — aucune contrainte de complexité. Pas de mécanisme de verrouillage de compte après N échecs consécutifs.

**Jeton mobile housekeeping (F9)** : réutilise `JWT_ACCESS_SECRET`, `scope: 'mobile-housekeeping'`, TTL `MOBILE_JWT_EXPIRES_IN` (8h par défaut), aucun refresh token émis. `JwtAuthGuard` rejette explicitement ce scope hors de `/api/mobile/housekeeping/*`, vérifié dans le code, pas seulement documenté.

---

## 2. Autorisations (RBAC)

**Guards globaux** ordre `ThrottlerGuard` → `JwtAuthGuard` → `PermissionsGuard`.

**`JwtAuthGuard`** : fail-closed confirmé — toute route protégée par défaut sauf `@Public()` explicite.

**`PermissionsGuard`** : `prisma.permission.findFirst(...)` **à chaque appel**, aucun cache — retirer une permission prend effet immédiatement. Une route sans `@RequirePermission` déclaré laisse passer tout utilisateur authentifié — un futur controller qui l'oublierait sur une route sensible serait accessible à tout utilisateur authentifié sans qu'aucun mécanisme ne le signale.

**Cohérence RBAC front/back** : recherche exhaustive sur le frontend (`roleId`, `permission`) ne retourne que 2 occurrences non fonctionnelles (commentaires). **Aucune logique de gating côté client n'a été trouvée**. `AppSidebar.tsx` affiche les 11 onglets à tout utilisateur authentifié sans vérification de permission ; `App.tsx` rend chaque page sans garde de rôle. Le RBAC réel n'existe qu'au niveau serveur, jamais reflété dans l'UI.

**Webhooks channel-manager** : `ChannelWebhookGuard` — secret statique partagé, comparaison directe `!==` (pas de comparaison à temps constant). Fail-closed confirmé : secret serveur absent → 401 systématique.

**Self-checkin / booking-engine (surfaces publiques)** : `@Public()` + `@Throttle` sur chaque route. `CreatePublicReservationDto` n'expose aucun champ `guestId` (anti-IDOR), combiné à `forbidNonWhitelisted: true` global.

---

## 3. Protections transverses

**Secrets** : `assertStrongSecrets()` refuse le démarrage en production si `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` valent encore leur valeur de `.env.example`. Ne couvre que ces deux variables — `CHANNEL_WEBHOOK_SECRET`, SMTP/Twilio non soumis à une vérification équivalente.

**CORS** : `CorsOptionsDelegate` distingue `/api/booking`/`/api/self-checkin` (origine réfléchie, `credentials: false`) du reste (strictement `FRONTEND_URL`, `credentials: true`).

**Rate limiting** : `ThrottlerModule.forRoot` global (100 req/min/IP), surchargé à 5/min sur `/auth/login` et `/auth/refresh`, 20/min self-checkin, 30/10 min booking-engine. Uniquement par IP, pas par utilisateur authentifié.

**En-têtes de sécurité HTTP** : recherche exhaustive de `helmet` — **aucune occurrence**. Aucun middleware de durcissement des en-têtes HTTP configuré explicitement.

**Validation globale** : `ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })` appliqué globalement.

**Logs sensibles** : `redact` explicite sur `Authorization`, `motDePasse`, `nouveauMotDePasse`, `refreshToken`. **Non couvert** : les payloads contenant `pieceIdentite`/`email`/`telephone` sont journalisés en clair par `pino-http` au niveau requête.

**Audit trail** : `AuditLog` append-only côté application, écrit dans la même transaction que la modification auditée. Non garanti au niveau base (pas de trigger MySQL, pas de contrainte FK sur `targetId`).

**Données personnelles et de paiement** : `Guest.pieceIdentite` confirmé stocké en clair. `ENCRYPTION_KEY` référencé dans `GO_LIVE_CHECKLIST.md` mais **n'apparaît dans aucun fichier de code**. Aucune donnée de carte bancaire stockée nulle part dans le schéma.

**Stockage des tokens côté frontend** : `token-storage.ts` confirme un stockage en `localStorage` (access + refresh token), reconnu dans le code comme un choix temporaire.

---

## 4. Évaluation globale

**Constats** : le socle RBAC/JWT est structurellement solide côté serveur. Les faiblesses identifiées ne sont pas dans l'architecture du mécanisme RBAC lui-même mais dans des zones périphériques restées en configuration « intérimaire » : l'exposition directe du token de reset de mot de passe (jamais raccordée au module notifications pourtant livré), l'absence totale de RBAC côté frontend, l'absence de chiffrement au repos des pièces d'identité, et le stockage des tokens en `localStorage`.

**Points forts** :
- `PermissionsGuard` sans cache, vérification RBAC fraîche à chaque requête.
- `JwtAuthGuard` fail-closed par défaut, défense en profondeur vérifiée pour le scope mobile housekeeping.
- `assertStrongSecrets()` bloque le démarrage en production avec des secrets par défaut.
- CORS strictement scindé entre surfaces publiques et surface authentifiée.
- Throttling différencié et resserré sur les routes d'authentification et les surfaces publiques.
- Redaction explicite des identifiants/tokens dans les logs structurés.
- `AllExceptionsFilter` : jamais de stack trace exposée au client.
- Anti-IDOR vérifié sur `booking-engine`.
- Webhooks channel-manager fail-closed.

**Points faibles** :
- Token de réinitialisation de mot de passe retourné en clair dans la réponse HTTP.
- Aucune logique RBAC côté frontend.
- Pas de révocation de refresh token (pas de blacklist, pas de rotation).
- Pas de verrouillage de compte après échecs de connexion répétés.
- Pas de complexité de mot de passe imposée au-delà de 8 caractères minimum.
- Tokens JWT stockés en `localStorage` côté frontend.
- Aucun middleware de durcissement des en-têtes HTTP (`helmet` ou équivalent) détecté.
- Comparaison du secret webhook channel-manager en `!==` simple, pas en temps constant.
- `Guest.pieceIdentite` stocké en clair malgré une checklist de mise en production qui exige un `ENCRYPTION_KEY` jamais implémenté.

**Risques** :
- Toute personne connaissant l'email d'un utilisateur peut obtenir un token de réinitialisation de mot de passe valide directement dans la réponse API — prise de contrôle de compte en un seul appel non authentifié.
- Un poste de réception laissé ouvert expose de fait toutes les fonctionnalités du PMS dans l'UI, y compris hors du rôle assigné.
- Une fuite XSS ponctuelle donnerait accès aux tokens stockés en `localStorage`, sans possibilité de révocation côté serveur.
- Une base de données compromise exposerait immédiatement les pièces d'identité en clair.
- L'absence de verrouillage de compte laisse une fenêtre de force brute distribuée contre `/auth/login`.

**Questions ouvertes** :
- Le raccordement de `forgotPassword()` à `NotificationsService.notify()` est-il planifié ?
- Une migration du stockage des tokens frontend vers un cookie `httpOnly` + `SameSite` est-elle prévue ?
- Le chiffrement au repos de `Guest.pieceIdentite` reste-t-il un prérequis bloquant avant production ?
- Une politique de verrouillage de compte et/ou de complexité de mot de passe est-elle jugée nécessaire ?

### Note globale — Sécurité : **6,5/10**
