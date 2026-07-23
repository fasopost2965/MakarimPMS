# Plan de développement frontend — Makarim PMS v1

Construit **après** la cartographie fonctionnelle (`CARTOGRAPHIE_ECRANS.md`, `MATRICE_ROLE_PERMISSIONS_ECRANS.md`, `MATRICE_MODULE_API_ECRAN.md`, `COMPOSANTS_PARTAGES_MANQUANTS.md`, `EXIGENCES_UX.md`) — ce document ordonne l'exécution, il ne redéfinit pas ce qui doit exister.

---

## 1. Lots de développement, ordonnés par valeur métier et dépendances

### Lot 0 — Fondations transverses (prérequis de tout le reste)
- `error-boundary` (composant partagé).
- ~~Contexte `AuthContext` côté frontend~~ + route backend `GET /auth/me` — **✅ Terminé (CH-011, session courante)**, avec un écart par rapport au plan : pas de `AuthContext` séparé, un seul consommateur (`AppSidebar`) au moment de l'implémentation ne le justifiait pas — l'état `permissions` vit dans `App.tsx`, transmis en prop (voir §4 ci-dessous pour le détail réel).
- `form` structuré + `date-picker` (composants partagés).

**Pourquoi en premier** : le Lot 0 ne livre aucune valeur métier visible immédiatement, mais chaque lot suivant en dépend soit techniquement (formulaires), soit pour la cohérence RBAC (contexte d'identité). Le construire en dernier obligerait à retoucher tous les écrans déjà livrés pour y greffer le gating après coup — plus coûteux que de le poser en fondation.

### Lot 1 — Registre de police (É-01) — ✅ **Terminé (session courante)**
- Le seul chantier frontend bloquant (CH-003), désormais livré. Voir `CARTOGRAPHIE_ECRANS.md` (É-01) et `docs/governance/REGISTRE_CHANTIERS.md` pour le détail.
- **Écart par rapport au plan** : n'a en réalité **pas** dépendu d'un composant `form`/`date-picker` générique du Lot 0 — les primitives déjà existantes (`Input type="date"`, `Select`, `Label`, même pattern que `WalkinCheckinDialog.tsx`) ont suffi pour les 8 champs du formulaire. Un composant `form` structuré dédié n'était pas un prérequis réel pour ce lot précis — à réévaluer si un futur écran a des besoins de formulaire plus complexes (validation croisée, champs conditionnels) que ce que les primitives actuelles couvrent. (`GET auth/me`/gating RBAC — CH-011 — terminé depuis, voir Lot 0 ci-dessus.)
- Valeur métier : ferme un risque de conformité légale.

### Lot 2 — Self check-in staff (É-02)
- Indépendant du Lot 1 au niveau technique, mais logiquement lié (même flux de check-in) — à développer par la même personne si possible pour cohérence de parcours.
- Valeur métier : rend utilisable une fonctionnalité déjà livrée côté backend (F6).

### Lot 3 — Gating RBAC appliqué aux écrans existants — ✅ **Partiellement terminé (CH-011, session courante), portée réduite par arbitrage produit**
- Le masquage des 11 onglets existants (granularité onglet entier, `AppSidebar`/`NAV_ITEMS`) est livré avec CH-011 lui-même — pas un lot séparé après coup, contrairement au séquencement initialement prévu ici.
- **Écart par rapport au plan, tranché explicitement** (RD-009, `docs/governance/REGISTRE_DECISIONS.md`) : le masquage d'actions **à l'intérieur** d'un écran partagé (ex. Maintenance en lecture seule pour la Gouvernante à l'intérieur d'un écran déjà visible) n'est **pas** couvert — granularité onglet entier uniquement, option explicitement recommandée et retenue face au risque « cosmétique/UX, pas une barrière de sécurité » de ce chantier. Resterait un chantier distinct si le besoin réapparaît.
- Valeur métier : cohérence perçue de l'interface avec les droits réels (fermeture du risque R-09, `REGISTRE_RISQUES.md`).

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

## 4. Logique de gating RBAC côté client (cohérente avec le backend) — ✅ Implémenté (CH-011), mécanique réelle différente de la proposition initiale ci-dessous

**Principe** (respecté) : le frontend ne réimplémente jamais la logique RBAC — il consomme la même paire `(module, action)` que le backend, jamais une logique de rôle codée en dur côté client.

**Mécanique réellement livrée** (voir RD-009, `docs/governance/REGISTRE_DECISIONS.md`, pour l'arbitrage qui explique les écarts ci-dessous) :
1. `GET /auth/me` (`AuthController`/`AuthService.me()`) retourne `{ id, email, roleId, roleName, permissions: string[] }` — `permissions` est une liste à plat de chaînes `"module:action"` (pas un tableau d'objets `{module, action}` comme envisagé ici).
2. **Pas de `AuthContext`** : `App.tsx` porte l'état `permissions`, rechargé à chaque connexion via un `useEffect`, transmis en prop à `AppSidebar` — un seul consommateur au moment de l'implémentation ne justifiait pas un Context dédié (à réintroduire si un second consommateur apparaît, ex. masquage d'action au Lot 3 étendu).
3. `NAV_ITEMS` (existant) est étendu avec un champ `permission: string` (obligatoire, pas optionnel `requiredPermission?`) — chaque item déclare toujours sa permission `:read`, aucun item sans permission déclarée dans la pratique.
4. **Pas de hook `useHasPermission`, pas de masquage d'action à l'intérieur d'un écran** — hors périmètre par arbitrage produit (RD-009), voir Lot 3 ci-dessus.

**Ce que cette logique ne doit pas devenir** (toujours vrai) : une seconde source de vérité RBAC. Si le backend refuse une action que le frontend croyait autorisée (dérive entre le chargement de `GET /auth/me` et l'action réelle, ex. permission retirée entre-temps), le frontend affiche l'erreur 403 renvoyée par le serveur normalement (pattern d'erreur existant) — jamais supposer que son propre état de permissions est toujours à jour. Cohérent avec le choix de ne pas rafraîchir `permissions` en cours de session (seulement à la connexion) : le vrai contrôle reste `PermissionsGuard`, vérifié en base à chaque requête serveur.

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
