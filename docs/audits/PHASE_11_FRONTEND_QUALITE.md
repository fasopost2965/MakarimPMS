# Audit technique — Makarim PMS v1
## Phase 11 — Qualité et fiabilité du frontend (post-couverture fonctionnelle)

Audit demandé explicitement par l'utilisateur *après* la clôture de la quasi-totalité des écrans manquants identifiés en Phase 8 (CH-003, CH-007, CH-008, CH-009, CH-011, CH-014, CH-015, CH-022). Question posée : *« ce qui est prévu, ce qui est fait, ce qui devrait être, ce que je n'ai pas pris en compte mais qui devrait l'être »*. Contrairement aux Phases 1-10 (constat de complétude fonctionnelle), cette phase porte sur la **qualité structurelle et non fonctionnelle** du frontend une fois la couverture d'écrans jugée quasi complète — c'est une deuxième couche d'audit, pas une répétition de la Phase 8.

**Méthode** : lecture directe du code réel (pas de la documentation seule) — inventaire exhaustif de `frontend/src/features/`, `frontend/src/components/`, `frontend/src/lib/` ; `grep` exhaustif sur les marqueurs de qualité (`ErrorBoundary`, `aria-*`, `role=`, `React.lazy`, fichiers `*.test.*`/`*.spec.*`, préfixes responsive Tailwind `sm:`/`md:`/`lg:`) ; lecture intégrale de `package.json` (dépendances déclarées, absence de dépendances de test) ; lecture de `index.html`, `vite.config.ts`, `token-storage.ts`. Comparaison systématique avec les quatre documents de planification frontend pré-existants (`CARTOGRAPHIE_ECRANS.md`, `EXIGENCES_UX.md`, `COMPOSANTS_PARTAGES_MANQUANTS.md`, `PLAN_DEVELOPPEMENT_FRONTEND.md`, `MATRICE_MODULE_API_ECRAN.md`, `MATRICE_ROLE_PERMISSIONS_ECRANS.md`) pour distinguer ce qui était *prévu et fait*, *prévu et contourné*, et *jamais prévu du tout*. Aucune modification de fichier applicatif effectuée pendant cette phase (constat seul, comme les Phases 1-10) — les corrections font l'objet des chantiers CH-028 à CH-035 (`docs/governance/REGISTRE_CHANTIERS.md`).

---

## 1. Ce qui était prévu (rappel du plan d'origine)

`docs/frontend-plan/PLAN_DEVELOPPEMENT_FRONTEND.md` structurait l'exécution en 8 lots, avec un principe explicite en tête de Lot 0 : *« le Lot 0 [fondations transverses — `error-boundary`, `AuthContext`, composant `form`/`date-picker`] ne livre aucune valeur métier visible immédiatement, mais chaque lot suivant en dépend [...]. Le construire en dernier obligerait à retoucher tous les écrans déjà livrés pour y greffer le gating après coup — plus coûteux que de le poser en fondation. »*

`docs/frontend-plan/COMPOSANTS_PARTAGES_MANQUANTS.md` listait, par priorité : `table` (Haute), `form` structuré (Haute), `error-boundary` (Haute, transverse), `select` avec recherche (Moyenne), `date-picker` (Moyenne), `toast` (Moyenne), `tabs` (Moyenne), `file-upload` (Moyenne), badge sémantique étendu (Basse), `diff-viewer` (Basse).

Ces deux documents n'abordent en revanche **jamais** : les tests automatisés, l'accessibilité, la sécurité du stockage des tokens côté client, le découpage de bundle, ou l'identité visuelle (titre d'onglet, favicon, `lang`). Ce ne sont donc pas des écarts par rapport au plan — ce sont des angles morts du plan lui-même, découverts uniquement par la lecture directe du code réel (§4 ci-dessous).

---

## 2. Ce qui est fait aujourd'hui (vérifié dans le code réel)

**Couverture fonctionnelle — confirmée quasi complète.** 18 dossiers dans `frontend/src/features/` (contre 14 à la Phase 8), les 8 écrans identifiés manquants (É-01 à É-08 de `CARTOGRAPHIE_ECRANS.md`) existent tous et appellent des endpoints réels — aucune donnée simulée détectée, cohérent avec le constat déjà établi en Phase 8 et jamais contredit depuis.

**Le Lot 0 n'a en réalité jamais été construit — il a été contourné à chaque écran, pas remplacé par une alternative équivalente.**
- `grep -r ErrorBoundary frontend/src` → **zéro résultat**. Aucune limite de récupération d'erreur de rendu n'existe nulle part dans l'arbre React.
- Pas d'`AuthContext` : décision RD-009 documentée pour CH-011, mais l'écart s'est reproduit à l'identique pour chaque chantier suivant sans jamais être reconsidéré — `permissions` reste un `useState` local à `App.tsx`, transmis en prop.
- `frontend/src/components/ui/` contient exactement **6 primitives** (`badge`, `button`, `dialog`, `input`, `label`, `select`) — un nombre inchangé depuis la Phase 8, malgré 8 écrans construits depuis, dont deux (CH-003 police, CH-022 document-ocr) que le plan citait explicitement comme consommateurs prioritaires d'un composant `form`/`file-upload` dédié.
- Aucun `table`, `tabs`, `toast`, `file-upload`, `diff-viewer` n'a été construit. CH-015 (audit) affiche un diff avant/après en `<pre>{JSON.stringify(...)}</pre>` brut ; CH-022 (document-ocr) utilise un `<input type="file">` HTML natif sans zone de dépôt ni composant réutilisable ; `StockPage.tsx` simule des onglets via `useState` local + boutons plutôt qu'un composant `tabs`.

---

## 3. Ce qui devrait être mais ne l'est pas (écarts vs. le plan existant)

- **Gating RBAC réduit à la granularité onglet** (RD-009, arbitrage assumé) : un rôle avec une permission `:read` mais pas `:write` sur un module partagé (ex. Gouvernante sur Maintenance) voit toujours les mêmes actions de création/résolution que le rôle qui a le droit — l'échec se produit en 403 serveur au clic, jamais avant. Choix produit tranché, pas un oubli, mais une expérience dégradée que le plan avait anticipée et explicitement mise de côté (`MATRICE_ROLE_PERMISSIONS_ECRANS.md`).
- **`docs/frontend-plan/MATRICE_MODULE_API_ECRAN.md` était obsolète au moment de cet audit** : la version relue affichait encore 6 lignes 🔴 (police, audit, self-checkin staff, notifications, document-ocr, channel-manager) alors que les six sont ✅ depuis les chantiers de la session précédente — personne n'avait remis à jour ce document après leur clôture. **Corrigé directement dans le cadre de cette même session de documentation** (voir CH-035, fermé, ci-dessous), pas laissé comme un chantier ouvert supplémentaire.
- **CH-001 (avoir/credit-note) et le Lot 7 financier** : toujours sans interface, cohérent — aucun changement depuis la Phase 8, le backend ne dépend d'aucun chantier frontend distinct pour l'instant.

---

## 4. Angles morts — ce qu'aucun document de planification n'avait anticipé

Vérifiés directement dans le code, pas déduits de la documentation :

### 4.1 Zéro test automatisé frontend
`find frontend/src -iname "*.test.*" -o -iname "*.spec.*"` → 0 résultat. `package.json` ne déclare aucune dépendance de test (pas de Vitest, pas de Testing Library, pas de Playwright en CI — l'usage de Playwright fait cette session l'a été en pilotage manuel ad hoc, jamais committé comme suite reproductible). Le backend a une discipline de test rigoureuse et non négociable (e2e réels contre MySQL, `CLAUDE.md`) ; le frontend n'a **aucune** garantie automatisée équivalente — chaque vérification de chantier frontend cette session a été manuelle, en navigateur, non reproductible en CI.

### 4.2 Accessibilité quasi nulle
2 fichiers sur 38 `.tsx` utilisent un attribut `aria-*`, 0 fichier utilise `role=`, aucun plugin ESLint `jsx-a11y` dans la configuration. Aucune gestion de focus documentée sur les dialogues (`components/ui/dialog.tsx`), aucune navigation clavier vérifiée. Pour un outil utilisé quotidiennement par la réception, potentiellement au clavier sous pression, ce n'est pas seulement une question de conformité — c'est un risque d'usage réel.

### 4.3 Stockage des tokens JWT en `localStorage` (access **et** refresh)
`frontend/src/lib/token-storage.ts` stocke les deux jetons en clair dans `localStorage`, documenté comme un choix « suffisant pour cette itération ». C'est un axe déjà identifié et **formellement reporté** côté backend (CH-026(e), `docs/governance/REGISTRE_DECISIONS.md` RD-016) mais jusqu'ici jamais formalisé comme un sujet frontend à part entière dans `docs/frontend-plan/`. Risque concret : toute injection de script (dépendance compromise, faille dans un futur composant tiers) peut exfiltrer les deux jetons — y compris le refresh, ce qui donne une session persistante volée, pas seulement 15 minutes d'access token.

### 4.4 Aucun découpage de bundle (code splitting)
`App.tsx` importe les 18 features en top-level ; `grep -r "React.lazy\|lazy(" frontend/src` → 0 résultat. Un utilisateur qui n'a accès qu'à une poignée d'onglets télécharge quand même le JavaScript des 18 modules (RH, channel-manager, audit, document-ocr compris) au premier chargement. Sur une connexion hôtelière modeste, c'est un coût réel de temps de chargement initial pour une application qui, par ailleurs, n'a aucune contrainte technique de routeur empêchant un découpage par onglet.

### 4.5 Absence totale d'error boundary
Confirmé en 4.2 ci-dessus (le grep global) — une exception de rendu React dans n'importe quel écran fait planter toute l'application (écran blanc complet), pas seulement l'onglet concerné. C'était le premier point du Lot 0 du plan d'origine, jamais livré.

### 4.6 Identité visuelle jamais mise à jour (branding/finition)
`index.html` : `<title>frontend</title>` (valeur par défaut de Vite, jamais changée), `<html lang="en">` alors que 100 % de l'interface applicative est en français. `public/favicon.svg` est le logo générique dégradé violet du template shadcn/vite, pas celui de l'hôtel. Le logo officiel fourni par l'utilisateur est stocké (`frontend/src/assets/brand/logo-makarim-source.jpg`) mais rien n'est câblé — ni titre d'onglet, ni favicon, ni sidebar (toujours le badge « M » générique).

### 4.7 Responsive/mobile quasi absent, jamais tranché explicitement
9 fichiers `.tsx` sur 38 utilisent un préfixe responsive Tailwind (`sm:`/`md:`/`lg:`). `AppSidebar` a des largeurs fixes en pixels (`w-60`/`w-16`), aucun mode replié en dessous d'un seuil d'écran. Cohérent avec le fait que F9 (app mobile housekeeping) a son propre client mobile séparé côté backend — mais aucun document n'énonce explicitement *« ce frontend admin est desktop-only, choix assumé »* : c'est un renoncement implicite, jamais écrit noir sur blanc ni validé par l'utilisateur.

### 4.8 Documentation frontend partiellement désynchronisée du code
Au-delà de `MATRICE_MODULE_API_ECRAN.md` (§3 ci-dessus), aucun mécanisme ne garantit que les documents de `docs/frontend-plan/` restent à jour à chaque clôture de chantier — contrairement à `docs/governance/STATUT_MODULES.md`/`MATRICE_TRACABILITE.md`, qui portent une note explicite *« à mettre à jour à chaque clôture de chantier »*.

---

## 5. Évaluation globale

**Constat central** : le motif déjà identifié en Phase 9 pour le backend (« un mécanisme commencé puis jamais complété jusqu'à son point d'usage réel ») se retrouve à l'identique côté frontend, sur un axe différent — ici, ce n'est pas une fonctionnalité métier laissée à mi-chemin, mais une **fondation transverse** (Lot 0) que chaque chantier suivant a contournée individuellement plutôt que de la construire une fois pour toutes. Le résultat fonctionne à chaque fois pris isolément (rien n'est cassé, l'UX reste cohérente en apparence), mais la dette ne s'est jamais résorbée — elle s'est reproduite huit fois sans jamais être remboursée.

**Points forts confirmés (inchangés depuis la Phase 8)** : zéro donnée simulée, homogénéité stricte du pattern `features/<domaine>/{api,types,components,pages}`, cohérence terminologique avec le vocabulaire métier backend, RBAC frontend qui ne réimplémente jamais sa propre logique (consomme `(module, action)` du serveur).

**Points faibles nouveaux, non couverts par la Phase 8** : absence totale de tests, accessibilité quasi nulle, stockage token en `localStorage`, absence de code splitting, absence d'error boundary — cinq axes non fonctionnels qu'aucun audit précédent n'avait examinés parce que la Phase 8 s'était concentrée sur la couverture d'écrans, pas sur la qualité structurelle de ce qui existe déjà.

**Note globale** : **6,5/10** — comparable à la note Phase 8 d'origine (6,5/10), mais pour une raison différente : la couverture fonctionnelle est aujourd'hui bien meilleure, ce qui aurait dû faire monter la note ; elle est retenue au même niveau parce que cinq lacunes structurelles nouvellement examinées (tests, a11y, sécurité du stockage token, résilience aux erreurs de rendu, performance de chargement) n'existaient pas comme axes d'évaluation en Phase 8 et pèsent chacune significativement sur la fiabilité en usage réel d'un outil utilisé quotidiennement par plusieurs rôles.

---

## 6. Liens vers la suite

Chantiers dérivés de ce constat, avec fiche complète (priorité, criticité, impacts, effort, critères de validation) : `docs/governance/REGISTRE_CHANTIERS.md`, section « Chantiers frontend — issus de l'audit qualité (Phase 11) », CH-028 à CH-035, plus l'enrichissement de CH-026(e) (déjà existant, RD-016) pour le stockage des tokens. Ordre d'exécution recommandé : `docs/governance/BACKLOG_PRIORISE.md`, Vague 4. Plan frontend révisé (5 catégories) : `docs/frontend-plan/PLAN_DEVELOPPEMENT_FRONTEND.md`, section 7.
