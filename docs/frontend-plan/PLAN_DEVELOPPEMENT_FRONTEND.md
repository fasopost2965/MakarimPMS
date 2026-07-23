# Plan de développement frontend — Makarim PMS v1

Construit **après** la cartographie fonctionnelle (`CARTOGRAPHIE_ECRANS.md`, `MATRICE_ROLE_PERMISSIONS_ECRANS.md`, `MATRICE_MODULE_API_ECRAN.md`, `COMPOSANTS_PARTAGES_MANQUANTS.md`, `EXIGENCES_UX.md`) — ce document ordonne l'exécution, il ne redéfinit pas ce qui doit exister.

---

## 1. Lots de développement, ordonnés par valeur métier et dépendances

### Lot 0 — Fondations transverses (prérequis de tout le reste)
- `error-boundary` (composant partagé).
- Contexte `AuthContext` côté frontend + route backend `GET /auth/me` (CH-011, coordonné avec le plan backend).
- `form` structuré + `date-picker` (composants partagés).

**Pourquoi en premier** : le Lot 0 ne livre aucune valeur métier visible immédiatement, mais chaque lot suivant en dépend soit techniquement (formulaires), soit pour la cohérence RBAC (contexte d'identité). Le construire en dernier obligerait à retoucher tous les écrans déjà livrés pour y greffer le gating après coup — plus coûteux que de le poser en fondation.

### Lot 1 — Registre de police (É-01) — ✅ **Terminé (session courante)**
- Le seul chantier frontend bloquant (CH-003), désormais livré. Voir `CARTOGRAPHIE_ECRANS.md` (É-01) et `docs/governance/REGISTRE_CHANTIERS.md` pour le détail.
- **Écart par rapport au plan** : n'a en réalité **pas** dépendu d'un composant `form`/`date-picker` générique du Lot 0 — les primitives déjà existantes (`Input type="date"`, `Select`, `Label`, même pattern que `WalkinCheckinDialog.tsx`) ont suffi pour les 8 champs du formulaire. Le Lot 0 (`AuthContext`/`GET auth/me`, gating RBAC) reste à faire pour CH-011, mais un composant `form` structuré dédié n'était pas un prérequis réel pour ce lot précis — à réévaluer si un futur écran a des besoins de formulaire plus complexes (validation croisée, champs conditionnels) que ce que les primitives actuelles couvrent.
- Valeur métier : ferme un risque de conformité légale.

### Lot 2 — Self check-in staff (É-02)
- Indépendant du Lot 1 au niveau technique, mais logiquement lié (même flux de check-in) — à développer par la même personne si possible pour cohérence de parcours.
- Valeur métier : rend utilisable une fonctionnalité déjà livrée côté backend (F6).

### Lot 3 — Gating RBAC appliqué aux écrans existants
- Une fois le Lot 0 (contexte d'identité) en place, appliquer le masquage aux 11 écrans existants + Lots 1/2, selon `MATRICE_ROLE_PERMISSIONS_ECRANS.md`.
- Attention particulière : le masquage d'actions **à l'intérieur** d'un écran (Maintenance pour la Gouvernante, Paramètres en lecture pour Réception/Comptable) — pas seulement le masquage d'onglets entiers.
- Valeur métier : cohérence perçue de l'interface avec les droits réels (fermeture du risque R-09).

### Lot 4 — Interfaces de configuration administrative
- É-03 (notifications), É-04 (channel-manager, **sous réserve de confirmation qu'un canal OTA réel est utilisé** — sinon reporter en `ECARTS_ASSUMES.md`).
- Réservées à l'Administrateur (Lot 3 doit être livré avant, pour que le gating s'applique dès leur mise en ligne plutôt qu'après coup).

### Lot 5 — Consultation et traçabilité
- É-06 (audit log), É-07 (historique statuts chambre, dépend de la route backend CH-014).
- Nécessite le composant `table` (voir `COMPOSANTS_PARTAGES_MANQUANTS.md`).
- Valeur métier : ferme les points aveugles de traçabilité identifiés Phase 7/9.

### Lot 6 — Confort et automatisation
- É-05 (document-ocr — scan de pièce, confort de saisie, pas une obligation).
- Nécessite `file-upload`.

### Lot 7 — Chantiers financiers frontend (dépendent du backend, CH-001/CH-005)
- Interface de création d'avoir (une fois CH-001 livré côté backend — aucune interface n'existe tant que le backend n'a rien à exposer).
- Ajustement de l'écran de check-out pour refléter le blocage/avertissement de CH-005 une fois tranché.
- **Ce lot ne peut pas démarrer avant que le plan backend correspondant (CH-001, CH-005) ne soit livré** — dépendance dure, pas seulement une préférence de séquencement.

---

## 2. Composants partagés à construire avant les pages (rappel — détail dans `COMPOSANTS_PARTAGES_MANQUANTS.md`)

Ordre déjà établi dans ce document, repris ici pour la cohérence du plan : `error-boundary` → `form`/`date-picker` → `table` → `tabs`/`select` recherche/`toast` → `file-upload`/`diff-viewer`.

## 3. Prérequis UX

Voir `EXIGENCES_UX.md` — s'applique à chaque lot ci-dessus, en particulier la règle « aucune action sans confirmation pour un geste financier ou destructif » qui concerne directement le Lot 7.

## 4. Logique de gating RBAC côté client (cohérente avec le backend)

**Principe** : le frontend ne doit jamais réimplémenter la logique RBAC — il consomme la même paire `(module, action)` que le backend, jamais une logique de rôle codée en dur côté client (ex. `if (role === 'Réception')` est **à proscrire** — cela dupliquerait la matrice déjà tenue par `RolePermission` en base, avec un risque de désynchronisation entre les deux couches).

**Mécanique proposée** :
1. `GET /auth/me` (CH-011, backend) retourne `{ roleId, roleName, permissions: [{module, action}] }`.
2. `AuthContext` (frontend) charge cette liste une fois à la connexion, l'expose via un hook `useHasPermission(module, action)`.
3. `NAV_ITEMS` (existant) est étendu avec un champ `requiredPermission?: {module, action}` par entrée — un item sans permission déclarée reste visible à tous les utilisateurs authentifiés (cohérent avec le comportement backend actuel : une route sans `@RequirePermission` est accessible à tout utilisateur authentifié).
4. Les actions à l'intérieur d'un écran (boutons, formulaires) utilisent le même hook — pas de logique dupliquée entre le filtrage de navigation et le filtrage d'action.

**Ce que cette logique ne doit pas devenir** : une seconde source de vérité RBAC. Si le backend refuse une action que le frontend croyait autorisée (dérive entre le moment du chargement de `GET /auth/me` et l'action réelle, ex. permission retirée entre-temps), le frontend doit afficher l'erreur 403 renvoyée par le serveur normalement (déjà géré par le pattern d'erreur existant) — jamais supposer que son propre état de permissions est toujours à jour.

## 5. Compatibilité avec un suivi visuel continu du rendu

Le pilotage du projet accorde une importance explicite au rendu réel pendant le développement (design, qualité perçue, confort d'usage). Conséquences pour l'exécution de ce plan :
- Chaque lot doit être vérifiable visuellement en environnement local dès qu'un écran (même partiel) est en place — pas seulement à la fin du lot. Voir `docs/planning/ENVIRONNEMENT_LOCAL.md` pour le détail du lancement des serveurs de développement.
- Les composants partagés du Lot 0 doivent être développés avec au moins un écran d'usage réel dès leur création (ne pas construire un composant « en isolation » sans l'appliquer immédiatement à É-01, qui en est le premier consommateur) — cohérent avec la règle transverse « pas de donnée simulée » : un composant partagé doit être validé contre un vrai écran, pas un bac à sable déconnecté.

## 6. Récapitulatif de séquence

```
Lot 0 (fondations)
   │
   ├──► Lot 1 (police, bloquant)
   ├──► Lot 2 (self-checkin)
   │        │
   │        ▼
   │     Lot 3 (gating RBAC appliqué partout)
   │        │
   │        ▼
   │     Lot 4 (config admin) ──► Lot 5 (traçabilité) ──► Lot 6 (confort OCR)
   │
   └──► Lot 7 (financier, dépend du backend CH-001/CH-005 — parallèle possible dès que le backend livre)
```
