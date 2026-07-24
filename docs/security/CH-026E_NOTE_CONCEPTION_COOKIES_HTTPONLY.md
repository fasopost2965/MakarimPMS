# Note de conception — CH-026(e) : migration des tokens JWT vers des cookies `httpOnly`

**Statut : prérequis écrit avant tout code, en attente de validation avant implémentation.** Conformément au prérequis posé dans `docs/frontend-plan/PLAN_EXECUTION_LOTS_QUALITE.md` (Lot D) : *« une mini note de conception (CSRF + révision CORS) est un prérequis écrit avant le premier commit de code CH-026(e) — pas un simple refactor mécanique »*. Ce document ne modifie aucun fichier de code.

## 1. Problème et périmètre

- **Constat** (`docs/audits/PHASE_11_FRONTEND_QUALITE.md` §4.3, risque R-14 `REGISTRE_RISQUES.md`) : `frontend/src/lib/token-storage.ts` stocke l'access token et le refresh token dans `localStorage`. Tout script capable d'exécuter du JavaScript dans la page (XSS) peut lire ces deux jetons et usurper la session — y compris le refresh token (7 jours de validité), pas seulement l'access token (15 minutes).
- **Vérifié avant de concevoir la migration** : `grep -rn "jwt-decode\|jwtDecode\|atob(" frontend/src` → 0 résultat. Le frontend ne décode jamais le payload du JWT côté client — l'identité/les permissions viennent exclusivement de `GET /auth/me` (CH-011). Conséquence directe : les deux jetons peuvent devenir **entièrement opaques au JavaScript de la page** sans perdre aucune fonctionnalité actuelle.
- **Hors périmètre, volontairement** : `AuthService.loginMobile()` (F9) reste sur `Authorization: Bearer` — c'est un client mobile natif (pas un navigateur avec pot de cookies partagé avec l'origine du site), déjà à portée réduite et sans refresh token par choix (`CLAUDE.md` §F9). Le double extracteur JWT décrit en §4 préserve ce flux sans le modifier.

## 2. Conception retenue : cookies `httpOnly` + double-submit CSRF

### 2.1 Transport des jetons

Les deux jetons (access + refresh) migrent vers des cookies `httpOnly`, posés par le backend via `Set-Cookie` sur `POST /auth/login` et `POST /auth/refresh` :

| Cookie | Contenu | `httpOnly` | `Secure` | `SameSite` | `Path` | Durée de vie |
|---|---|---|---|---|---|---|
| `makarim_access_token` | JWT access (identique au contenu actuel) | ✅ | `NODE_ENV=production` | `Lax` | `/api` | = `JWT_ACCESS_EXPIRES_IN` (15 min) |
| `makarim_refresh_token` | JWT refresh (identique au contenu actuel) | ✅ | `NODE_ENV=production` | `Lax` | `/api/auth` | = `JWT_REFRESH_EXPIRES_IN` (7 j) |
| `makarim_csrf_token` | valeur aléatoire opaque (32 octets, hex) | ❌ (lisible par le JS de la page) | `NODE_ENV=production` | `Lax` | `/api` | alignée sur l'access token, régénérée à chaque `/login`/`/refresh` |

`Secure` conditionnel à `NODE_ENV=production` (pas systématique) : le dev local (`http://localhost`) n'a pas de TLS — un `Secure` inconditionnel empêcherait tout cookie de partir en développement. Cohérent avec le seul autre exemple de ce type dans le projet (`app.use(helmet({ contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false }))`, `main.ts`).

`SameSite=Lax` (pas `Strict`) : `Strict` empêcherait la session d'être active dès la toute première navigation venant d'un lien externe ouvert dans un nouvel onglet (cas réel : un rappel email/SMS F7 qui pointerait un jour vers l'app admin, ou simplement un favori ouvert dans un nouvel onglet) — `Lax` est le standard recommandé pour une application avec flux de connexion classique et protège déjà l'essentiel : un `fetch`/XHR cross-site (ce que forge une attaque CSRF) n'envoie **pas** les cookies `Lax` d'un autre site, seule une navigation de premier niveau (GET) le fait — sans effet ici puisqu'aucune route mutante n'est un `GET`.

Deux jetons opaques plutôt qu'un seul cookie combiné : réutilise directement la structure JWT existante (access/refresh séparés, TTL différents, `AuthService.refresh()`/`logout()` inchangés dans leur logique métier) — pas de nouveau format à inventer.

### 2.2 Protection CSRF : double-submit cookie

`SameSite=Lax` seul est une mitigation, pas une protection complète (dépendance au support navigateur, et le périmètre « site » de `SameSite` est le domaine enregistrable — eTLD+1 — pas l'origine exacte : un autre sous-domaine du même domaine racine échapperait à `SameSite` seul). Le plan Lot D demande explicitement une **protection CSRF conçue**, pas une dépendance implicite à un attribut de cookie.

**Pattern retenu** : double-submit cookie.

1. `makarim_csrf_token` (§2.1) est le seul des trois cookies **non** `httpOnly` — volontairement lisible par le JavaScript de la page.
2. `apiRequest()` (frontend) lit ce cookie et l'envoie dans un en-tête `X-CSRF-Token` sur toute requête mutante (`POST`/`PUT`/`PATCH`/`DELETE` — jamais sur un `GET`, qui reste par convention du projet sans effet de bord, cf. `reporting` module read-only).
3. Nouveau `CsrfGuard` (global, `APP_GUARD`, après `JwtAuthGuard`/`PermissionsGuard`) : compare la valeur de l'en-tête à la valeur du cookie sur toute requête non-`GET`/`HEAD`/`OPTIONS`. Absence ou désaccord → `403`.
4. Le guard **s'efface** quand aucun cookie `makarim_access_token` n'est présent — une requête authentifiée par `Authorization: Bearer` (F9 mobile, un futur client API externe, un appel `curl`/Postman avec un jeton copié manuellement) n'est pas vulnérable au CSRF par construction (un navigateur piégé ne peut pas forger un en-tête `Authorization`, contrairement à un cookie qu'il attache automatiquement) — appliquer le guard dans ce cas serait un blocage sans bénéfice de sécurité réel.

**Pourquoi ça marche** : un site attaquant peut faire en sorte que le navigateur de la victime envoie une requête vers l'API (formulaire auto-soumis, `fetch` avec `credentials: 'include'`) — le cookie `httpOnly` part automatiquement. Mais l'attaquant ne peut **pas lire** `document.cookie` pour le domaine de l'API (politique de même origine) et ne peut donc pas reproduire la valeur exacte de `makarim_csrf_token` dans l'en-tête `X-CSRF-Token` — la requête forgée échoue au niveau du `CsrfGuard`.

### 2.3 Alternatives considérées et rejetées

- **Access token seul en cookie, refresh token laissé en `localStorage`** — rejeté : le refresh token (7 jours) est l'actif le plus sensible, exactement celui que ce chantier vise à protéger d'un vol XSS ; le laisser en `localStorage` viderait le chantier de son intérêt principal.
- **`SameSite=Strict`** — rejeté (§2.1) : dégrade l'UX sur la première navigation externe sans gain de sécurité proportionné, `Lax` couvre déjà le vecteur CSRF réel (requêtes mutantes cross-site).
- **Jeton CSRF encodé comme claim dans le JWT lui-même** (« synchronizer token » côté serveur avec état) — rejeté : complexité additionnelle sans bénéfice sur le double-submit stateless, qui ne demande aucun stockage serveur supplémentaire et reste cohérent avec le caractère stateless déjà choisi pour les JWT de ce projet.
- **Dépendre uniquement de `SameSite` sans jeton CSRF explicite** — rejeté : le plan Lot D demande explicitement une protection CSRF conçue (pas une simple note disant « SameSite suffit »), et OWASP recommande une défense en profondeur plutôt qu'une dépendance unique à un attribut de cookie dont le support/la portée varient selon les navigateurs et la topologie de domaine.

## 3. Révision du carve-out CORS (F4/F6)

**Conclusion : aucune modification requise**, vérifiée plutôt que supposée.

Le `CorsOptionsDelegate` de `main.ts` distingue déjà deux régimes : les préfixes publics `/api/booking` et `/api/self-checkin` (`origin: true` réfléchie, `credentials: false`) contre le reste de l'API (`origin: FRONTEND_URL`, `credentials: true`). Cette migration ne change rien à cette séparation :

- Les routes `booking-engine` (F4) et `self-checkin` (F6) restent `@Public()` — elles ne lisent ni ne dépendent d'aucun cookie de session. `self-checkin` s'authentifie par un jeton porté dans l'URL (`SelfCheckinToken`), `booking-engine` n'a aucune authentification. Aucun cookie `makarim_*` n'est requis ni envoyé sur ces deux surfaces.
- `credentials: false` sur ces préfixes reste correct : ces routes n'ont jamais eu besoin que le navigateur transmette des cookies, migration ou non.
- `credentials: true` + origine explicite (`FRONTEND_URL`, jamais `*`) sur le reste de l'API est **la condition exacte requise** pour que les cookies `httpOnly` fonctionnent en cross-origin — déjà en place avant ce chantier, pour d'autres raisons (CH-026(a)/RD antérieures), mais qui se trouve satisfaire directement ce nouveau besoin sans modification.
- **Limite documentée, pas nouvelle** : `docs/audits/PHASE_11_FRONTEND_QUALITE.md`/CLAUDE.md notaient déjà que le carve-out CORS public reste restreint à `FRONTEND_URL` pour le reste de l'API — cette migration ne change pas cette limite, elle en dépend (voir §5, contrainte de déploiement).

## 4. Backend — plan d'implémentation (une fois validé)

- Installer `cookie-parser` (+ `@types/cookie-parser`), activer `app.use(cookieParser())` dans `main.ts`.
- Nouveau service canonique `AuthCookieService` (`setAuthCookies(res, {accessToken, refreshToken}) `/ `clearAuthCookies(res)`) — **un seul chemin d'écriture** pour ces cookies (même discipline que `RoomsService.transitionRoom`/`GuestsService.updateCategorie` déjà établie dans ce projet), réutilisé par `login`, `refresh` (set) et `logout` (clear).
- `JwtAccessStrategy` : `jwtFromRequest` passe de `ExtractJwt.fromAuthHeaderAsBearerToken()` à `ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), (req) => req?.cookies?.makarim_access_token ?? null])` — **les deux mécanismes cohabitent** (Bearer reste nécessaire pour F9 mobile), pas un remplacement.
- `AuthController.login`/`refresh` : injectent `@Res({ passthrough: true }) res: Response`, appellent `AuthCookieService.setAuthCookies`, renvoient un corps minimal sans jeton (`{ ok: true }` — le frontend n'a jamais eu besoin de lire le jeton lui-même, seulement de savoir que la connexion a réussi, avant d'appeler `GET /auth/me`).
- `AuthController.refresh`/`logout` : lisent le refresh token depuis `req.cookies.makarim_refresh_token` au lieu du corps `RefreshDto` (`RefreshDto` devient obsolète pour ces deux routes — à retirer si aucun autre appelant).
- `AuthController.logout` : appelle en plus `AuthCookieService.clearAuthCookies(res)`.
- Nouveau `CsrfGuard` global (`APP_GUARD`, après `PermissionsGuard`) — logique §2.2.
- `.env.example`/`README.md` backend : documenter les nouveaux cookies et la contrainte de domaine (§5).

## 5. Frontend — plan d'implémentation (une fois validé)

- `lib/token-storage.ts` : les jetons ne sont plus lisibles en JS (cookies `httpOnly`) — le module est réduit à un helper de lecture du cookie CSRF (`getCsrfToken()`, parse `document.cookie`) et à un indicateur non sensible d'authentification optimiste (`isLoggedInHint` — un simple flag `localStorage`/cookie non `httpOnly`, posé/retiré en même temps que la connexion/déconnexion, **jamais utilisé pour une décision de sécurité**, seulement pour éviter un flash de l'écran de connexion avant la résolution de `GET /auth/me` au premier rendu).
- `lib/api-client.ts` : chaque `fetch` passe `credentials: 'include'` ; l'en-tête `Authorization` manuel disparaît (le cookie part automatiquement) ; un en-tête `X-CSRF-Token` (valeur de `getCsrfToken()`) est ajouté sur les requêtes mutantes ; `refreshAccessToken()` devient un simple `POST /auth/refresh` sans corps (le refresh token part via son propre cookie).
- `App.tsx` : `isAuthenticated` initial ne peut plus se déduire synchronement d'un `localStorage.getItem` — bascule sur le flag non sensible ci-dessus pour l'hypothèse optimiste de premier rendu, confirmée/infirmée par le premier appel `GET /auth/me` (déjà appelé aujourd'hui pour les permissions CH-011 — aucun appel réseau supplémentaire).
- `doLogout()` : `POST /auth/logout` sans corps (`credentials:'include'`), le backend lit/révoque/efface via les cookies.

## 6. Stratégie de test (barre à 100 % avant clôture)

- **Backend e2e** (`auth.e2e-spec.ts` étendu) :
  - `POST /auth/login` pose bien les 3 cookies avec les attributs attendus (`httpOnly` sur les deux premiers, absent sur le CSRF ; `SameSite=Lax` sur les trois).
  - Une route protégée répond `200` avec le cookie access, `401` sans.
  - `POST /auth/refresh` (cookie refresh valide) fait tourner les cookies (ancien refresh token révoqué — logique CH-026(f) déjà en place, inchangée).
  - `POST /auth/logout` efface les 3 cookies côté réponse et révoque le refresh token en base.
  - **Preuve sabotage/restore CSRF** (discipline non négociable du projet, `CLAUDE.md` §Tests) : une requête mutante avec cookie de session valide mais sans en-tête `X-CSRF-Token` (ou avec une valeur incorrecte) est rejetée `403` ; désactiver temporairement `CsrfGuard`, confirmer que la même requête réussit alors (preuve que le guard faisait bien quelque chose), le réactiver, reconfirmer le rejet.
  - F9 (`loginMobile`) : toujours un jeton Bearer en JSON, toujours fonctionnel sur `/mobile/housekeeping/*` via `Authorization` — non affecté par le double extracteur.
  - F4/F6 : `booking-engine`/`self-checkin` toujours fonctionnels sans cookie ni en-tête CSRF (routes publiques, `CsrfGuard` s'efface en leur absence de cookie de session).
- **Frontend** : vérification manuelle réelle en navigateur (login → rechargement de page conserve la session via cookie → navigation authentifiée → refresh naturel après expiration de l'access token → logout efface bien la session) — pas de valeur significative à un test Vitest sur la mécanique des cookies `httpOnly` (invisibles et non simulables utilement en jsdom).

## 7. Risques résiduels et contraintes de déploiement

- **Contrainte de domaine — confirmée et détaillée, plus une simple hypothèse** : `SameSite` définit le « site » par domaine enregistrable (eTLD+1), pas par port ni sous-domaine exact — frontend et backend doivent donc partager le même domaine enregistrable en production. **Confirmé par l'utilisateur** (`REGISTRE_DECISIONS.md`, RD-022) : l'hébergement VPS Hostinger prévu utilise un domaine déjà prêt, avec des sous-domaines dédiés (`pms.mondomaine.ma`/`api.mondomaine.ma`) partageant le même domaine racine — compatible par construction avec cette contrainte. Détail complet (schéma de sous-domaines, valeurs `FRONTEND_URL`/`VITE_API_URL`, infrastructure nginx/Certbot à ajouter, et pourquoi le cookie doit rester host-only plutôt que d'élargir son `Domain` au domaine racine) : `docs/operations/CH-026E_DEPLOIEMENT_DOMAINE.md`.
- **Session existante interrompue au déploiement** : les utilisateurs déjà connectés (jetons en `localStorage` d'un build antérieur) devront se reconnecter une fois après la mise en production de ce changement — acceptable pour un PMS interne à effectif réduit (quelques comptes nommés), pas un système public à fort trafic.
- **Chantier le plus risqué de la vague Phase 11** (touche l'authentification de bout en bout) — recommandation : l'implémenter en dernier du Lot D (déjà l'ordre prévu), avec la suite e2e backend rejouée intégralement après chaque étape, jamais en un seul commit monolithique.

## 8. Ce qui ne change pas

- Le format et le contenu des JWT (claims `sub`/`email`/`roleId`/`roleName`/`scope`/`jti`) — inchangés.
- `AuthService.login`/`refresh`/`logout`/`authenticateCredentials` — logique métier inchangée, seul le point d'écriture de la réponse HTTP (cookies au lieu du corps JSON) change.
- `PermissionsGuard`/RBAC — aucune interaction, le scope du jeton reste la seule source de vérité pour F9, `PermissionsGuard` reste la seule source de vérité pour les permissions.
- `RefreshToken` (table Prisma, rotation à usage unique CH-026(f)) — logique de révocation inchangée.

## 9. Correctif post-vérification live : livraison du jeton CSRF (§2.2 amendé)

**Constat en vérification navigateur réelle** (Playwright, login réel contre le backend de dev sur un port distinct du frontend, exactement la topologie de production — frontend/backend sur deux origines différentes) : `document.cookie` évalué sur la page frontend ne contenait **jamais** `makarim_csrf_token`, alors que `context.cookies()` (toutes origines confondues côté navigateur) le montrait bien posé. Conséquence : `getCsrfToken()` renvoyait toujours `null`, l'en-tête `X-CSRF-Token` partait vide, et `CsrfGuard` rejetait à raison en `403` — **`POST /auth/logout` a réellement échoué** dans ce test avant correctif.

**Cause** : `document.cookie` n'expose que les cookies dont le domaine et le chemin correspondent au document courant. Le cookie CSRF est posé côté API (`Path=/api`, host-only sur l'origine de l'API) ; la page frontend est chargée depuis une **autre origine** (autre port en dev, autre sous-domaine en prod — voir `docs/operations/CH-026E_DEPLOIEMENT_DOMAINE.md`). §2.2/§5 supposaient à tort un scénario same-origin où `document.cookie` suffirait à lire un cookie non `httpOnly` posé par l'API — faux dès que frontend et backend sont deux origines distinctes, ce qui est la topologie réelle de ce projet aussi bien en dev qu'en production.

**Correctif retenu** (préserve la décision §7 de ne jamais élargir `Domain` au domaine racine — RD-022) : le cookie CSRF reste posé, non `httpOnly`, et c'est toujours lui que `CsrfGuard` compare à l'en-tête — mais sa valeur transite **en plus**, une fois, dans le corps JSON de `POST /auth/login`, `POST /auth/refresh` et `GET /auth/me` (`{ ..., csrfToken }`). Le frontend la garde en mémoire JS uniquement (`lib/token-storage.ts`, jamais `localStorage`) :
- login → capturée depuis la réponse de `POST /auth/login` ;
- refresh → recapturée depuis la réponse de `POST /auth/refresh` (le cookie est régénéré à chaque refresh, une valeur en mémoire non rafraîchie enverrait un en-tête périmé) ;
- rechargement de page → la mémoire JS est perdue avec le contexte précédent ; `GET /auth/me`, déjà appelé par `App.tsx` à chaque montage (CH-011), la refournit — sans ce canal de récupération, la première requête mutante après un F5 échouerait à tort en `403`.

**Pourquoi la protection CSRF tient toujours** : un attaquant cross-site ne peut ni lire le cookie (toujours vrai, §2.2) ni lire le corps de la réponse `login`/`refresh`/`me` — ces requêtes sont soumises à la politique CORS du projet (`credentials: true`, origine restreinte à `FRONTEND_URL`, jamais `*`) qui bloque déjà la lecture cross-origine de la réponse par une page tierce. Le canal de livraison change, la garantie de sécurité (l'attaquant ne peut pas obtenir la valeur exacte) ne change pas.

**Fichiers concernés** : `backend/src/modules/auth/auth-cookie.service.ts` (`setAuthCookies` retourne désormais la valeur générée), `auth.controller.ts` (`login`/`refresh`/`me` l'incluent dans le corps), `frontend/src/lib/token-storage.ts` (`getCsrfToken`/`setCsrfToken` en mémoire, plus de lecture `document.cookie`), `frontend/src/lib/api-client.ts` (`refreshAccessToken` recapture la valeur), `frontend/src/features/auth/pages/LoginPage.tsx` et `frontend/src/App.tsx` (capture à la connexion et à chaque `GET /auth/me`).
