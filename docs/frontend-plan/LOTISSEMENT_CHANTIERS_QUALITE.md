# Lotissement des chantiers qualité frontend (Phase 11) — Lots A à E

Partitionne `CH-028` à `CH-035` + `CH-026(e)` (`docs/governance/REGISTRE_CHANTIERS.md`, `docs/audits/PHASE_11_FRONTEND_QUALITE.md`) en 5 lots exécutables indépendamment, chacun limité à 1-2 sessions. **Aucun code applicatif n'est modifié par ce document** — il organise le travail, ne l'exécute pas. Reprend et détaille la structure déjà esquissée dans `PLAN_DEVELOPPEMENT_FRONTEND.md` §7, sans réinventer les fiches de `REGISTRE_CHANTIERS.md` (ce document n'en est qu'un plan d'ordonnancement).

**Règle de classement** : chaque lot regroupe des chantiers de criticité homogène (sécurité, stabilité, usage quotidien, perception produit) — jamais un chantier critique mélangé à un chantier cosmétique dans le même lot.

---

## Lot A — Qualité critique — ✅ Terminé (session courante)

- **Chantiers inclus** : CH-031 (error boundary transverse), CH-028 (socle de tests Vitest + Testing Library).
- **Critère de criticité** : les deux seuls chantiers de toute la vague dont l'absence peut transformer un incident mineur en interruption de service totale ou en régression silencieuse — sécurité/stabilité prioritaires sur tout le reste.
- **Dépendances entre chantiers** : CH-031 doit être livré avant le premier test de confinement d'erreur de CH-028 (un test qui prouve l'isolation a besoin du composant en place).
- **Prérequis** : aucun arbitrage produit — deux décisions techniques déjà actées dans les fiches.
- **Ordre interne recommandé** : CH-031 (0,5-1 j, rapide) → CH-028 (4-6 j, socle + premiers tests ciblés).
- **Critère de « lot terminé »** : error boundary en place et prouvé par sabotage/restore ; `npm run test` existe et passe à 100 % sur au moins 3 parcours critiques (gating RBAC, refresh token, un flux financier) ; build/lint frontend propres ; aucune régression visuelle sur les écrans existants.

## Lot B — Fondations transverses — ✅ Terminé (4/4 sous-lots, session courante)

- **Chantiers inclus** : CH-032 (composants partagés — dette Lot 0).
- **Critère de criticité** : dette structurelle qui grossit à chaque écran livré depuis 8 chantiers — pas un blocage immédiat, mais le fondement de tout ce qui suit (accessibilité, tests).
- **Dépendances entre chantiers** : aucune interne (chantier unique) ; bénéficie d'être mené après le Lot A (les nouveaux composants sont alors testables via le socle Vitest déjà posé), sans y être strictement bloqué.
- **Prérequis** : aucun arbitrage produit — priorités déjà données par `COMPOSANTS_PARTAGES_MANQUANTS.md`.
- **Sous-découpage recommandé** (pour rester digestible) : B1 `table` + `form` (priorité Haute) → B2 `tabs` + `date-picker` → B3 `toast` + `select` recherche → B4 `file-upload` + `diff-viewer`.
- **Ordre interne recommandé** : B1 → B2 → B3 → B4, chaque sous-lot livrable et vérifiable indépendamment (un sous-lot peut s'étaler sur sa propre session si besoin).
- **Critère de « lot terminé »** : les 7 composants existent dans `components/ui/` ET chacun est réellement consommé par au moins un écran existant (aucun composant construit « en isolation » sans consommateur réel — règle déjà actée dans `PLAN_DEVELOPPEMENT_FRONTEND.md` §5).

## Lot C — UX / accessibilité — ✅ Terminé (CH-034 + CH-029, session courante)

- **Chantiers inclus** : CH-034 (arbitrage responsive/mobile), CH-029 (accessibilité a11y).
- **Critère de criticité** : impact direct sur l'usage quotidien réel (clavier, écran) plutôt que sur la robustesse technique pure — after Lot A/B pour éviter de corriger deux fois le même composant.
- **Dépendances entre chantiers** : aucune technique entre les deux (indépendants sur le fond, regroupés par thème UX).
- **Prérequis** : **CH-034 exige un arbitrage produit explicite avant tout code** (desktop-only assumé vs. investissement responsive réel) — posé via `AskUserQuestion` en ouverture du lot, pas décidé unilatéralement.
- **Ordre interne recommandé** : CH-034 (décision, quasi instantané) → CH-029 (2-3 j).
- **Critère de « lot terminé »** : la décision CH-034 est tranchée et tracée (RD dédiée), développement associé livré si l'option « investir » est retenue ; plugin `jsx-a11y` actif sans violation bloquante ; les 3 parcours prioritaires (check-in, housekeeping, facturation) validés utilisables intégralement au clavier.

## Lot D — Performance / sécurité

- **Chantiers inclus** : CH-030 (code splitting), CH-026(e) (tokens `localStorage` → cookie `httpOnly`).
- **Critère de criticité** : réduisent un risque (sécurité) ou un coût (temps de chargement) sans changer ce que l'utilisateur voit — traités une fois la base (tests, composants) stabilisée.
- **Dépendances entre chantiers** : aucune technique entre les deux, mais CH-026(e) est la refonte la plus large de toute la vague (CSRF à concevoir, carve-out CORS F4/F6 à revoir) — recommandé après le socle de tests (Lot A) pour vérifier la non-régression du flux d'authentification automatiquement.
- **Prérequis** : CH-026(e) nécessite une mini note de conception (protection CSRF, révision du carve-out CORS `main.ts`) avant le premier commit de code — pas un simple refactor mécanique.
- **Ordre interne recommandé** : CH-030 (1 j, indépendant, rapide) → CH-026(e) (3-5 j, le plus risqué de toute la vague).
- **Critère de « lot terminé »** : bundle Vite confirmé multi-chunks par onglet ; flux d'authentification complet (login/refresh/logout) fonctionnel via cookie `httpOnly`, suite e2e backend rejouée sans régression, preuve sabotage/restore sur la protection CSRF.

## Lot E — Finition produit

- **Chantiers inclus** : CH-033 (branding et finitions).
- **Critère de criticité** : cosmétique, sans impact sécurité/stabilité/usage — dernier de la vague par choix explicite de l'utilisateur, pas par nécessité technique.
- **Dépendances entre chantiers** : aucune sur les lots précédents.
- **Prérequis** : le logo source (JPEG, fond blanc) nécessite probablement un retravail graphique (fond transparent, déclinaisons SVG/PNG) avant intégration réelle — à clarifier avec l'utilisateur (qui produit cet asset ?) avant de démarrer, hors compétence de génération d'image de ce projet.
- **Ordre interne recommandé** : chantier unique, pas de sous-ordre.
- **Critère de « lot terminé »** : titre d'onglet, `lang`, favicon et logo `AppSidebar` reflètent l'identité réelle de l'hôtel, vérifié visuellement en navigateur réel (clair/sombre si applicable).

---

## Ordre d'exécution recommandé entre lots

```
Lot A (qualité critique) ✅ → Lot B (fondations) → Lot C (UX/a11y) → Lot D (performance/sécurité) → Lot E (finition)
```

Chaque lot a un début et une fin visibles (critère de « lot terminé » ci-dessus) et se clôture par un compte-rendu avant de démarrer le suivant — format détaillé dans `docs/frontend-plan/PLAN_EXECUTION_LOTS_QUALITE.md`. Aucun lot ne démarre sans feu vert explicite de l'utilisateur — cohérent avec `docs/governance/REGISTRE_DECISIONS.md` (RD-020).

## Compte-rendu — Lot A (session courante)

- **Critère de « lot terminé » vérifié** : error boundary en place et prouvé par sabotage/restore ✅ (en navigateur réel, pas seulement en test unitaire) ; `npm run test` existe et passe à 100 % sur 4 parcours critiques (gating RBAC, refresh token/corps vide, upload multipart, affichage financier) ✅ ; build/lint frontend propres ✅ ; aucune régression visuelle sur les écrans existants ✅.
- **Détail complet** : `docs/governance/REGISTRE_CHANTIERS.md`, fiches CH-031 et CH-028 (section « Résolution »).
- **Écart par rapport au plan initial** : aucun — le lot a été exécuté exactement dans le périmètre et l'ordre interne prévus (CH-031 puis CH-028).

## Compte-rendu — Lot B, sous-lot B1 (session courante)

- **Composants livrés** : `table` (`components/ui/table.tsx`) et `form`/`FormField` (`components/ui/form.tsx`), chacun appliqué immédiatement à un écran réel — critère de « composant sans consommateur réel interdit » respecté.
- **Consommateurs réels** : `StockPage.tsx` (vue « mouvements » — remplace des `<div>` alignées manuellement par une table sémantique, colonnes Date/Mouvement/Quantité/Article/Motif) ; `PoliceRecordForm.tsx` (8 champs, CH-003 — remplace un bouton simplement désactivé sans explication par une erreur par champ manquant, affichée à la tentative de soumission et effacée individuellement à la saisie).
- **Vérifié en navigateur réel avec des données réelles** (pas seulement en test unitaire) : table des mouvements de stock (40 lignes réelles) ; formulaire police d'un séjour réel — soumission vide → erreur affichée, saisie → erreur effacée, aucun appel serveur déclenché par une soumission invalide.
- `npm run build`/`lint`/`test` propres (20/20 tests, +7 depuis le Lot A), aucune régression.
- **Écart par rapport au plan initial** : aucun — sous-lot exécuté dans le périmètre prévu (table + form, priorité Haute de `COMPOSANTS_PARTAGES_MANQUANTS.md`).
- **Reste à faire dans le Lot B** : sous-lots B3 (`toast`+`select` recherche), B4 (`file-upload`+`diff-viewer`).

## Compte-rendu — Lot B, sous-lot B2 (session courante)

- **Composants livrés** : `tabs` (`components/ui/tabs.tsx`, wrapper `@base-ui/react/tabs`) et `date-picker` (`components/ui/date-picker.tsx`, `DateRangeField`), chacun appliqué immédiatement à un écran réel.
- **Consommateurs réels** : `StockPage.tsx` (remplace le bouton unique dont le libellé changeait selon la vue active par deux vrais onglets « Articles »/« Mouvements », navigation clavier flèches gérée nativement par le primitif) ; `CreateSeasonRateForm` dans `ParametersPage.tsx` (grille tarifaire saisonnière — validation croisée début/fin, `canSubmit` bloque désormais aussi une période incohérente, pas seulement des champs vides).
- **Vérifié en navigateur réel** : bascule d'onglet au clic et au clavier (flèche droite) sur Stock, un seul panneau monté à la fois ; formulaire de tarif saisonnier réel — période incohérente (fin avant début) correctement signalée.
- `npm run build`/`lint`/`test` propres (23/23 tests, +3 depuis le sous-lot B1), aucune régression.
- **Écart par rapport au plan initial** : aucun sur `tabs`. Sur `date-picker`, le composant livré est un `DateRangeField` (paire début/fin avec validation croisée) plutôt qu'un simple wrapper de date unique — un `<input type="date">` seul n'avait pas besoin d'un composant dédié (déjà bien géré par `Input`+`FormField` depuis B1) ; la vraie dette identifiée était la duplication de la logique de période (début/fin), pas la sélection d'une date isolée.
- **Reste à faire dans le Lot B** : sous-lot B4 (`file-upload`+`diff-viewer`).

## Compte-rendu — Lot B, sous-lot B3 (session courante)

- **Composants livrés** : `select-search` (`components/ui/select-search.tsx`, `SelectSearch`, wrapper `@base-ui/react/combobox`) et `toast` (`components/ui/toast.tsx`, `toastManager` singleton + `<Toaster />`).
- **Consommateurs réels** : sélecteur de chambre de `WalkinCheckinDialog.tsx` (jusqu'à 24 chambres, remplace le `Select` simple existant par un champ filtrable) ; confirmation de réassort dans `StockPage.tsx` (`ReplenishForm`) — action auparavant silencieuse (fermeture du dialogue sans confirmation), contraire à la règle déjà posée dans `EXIGENCES_UX.md` (« une confirmation dit ce qui s'est passé »).
- **Vérifié en navigateur réel** : recherche "1" dans le sélecteur de chambre filtre correctement la liste et remplit le champ à la sélection ; réassort de stock réel affiche le toast « Réassort enregistré ».
- `npm run build`/`lint`/`test` propres (28/28 tests, +5 depuis B2), aucune régression.
- **Écart par rapport au plan initial** : aucun. `<Toaster />` est montée une seule fois dans `App.tsx` (uniquement dans la branche authentifiée) — les écrans de connexion n'ont pour l'instant aucun besoin de toast, cohérent avec l'unique consommateur actuel.
## Compte-rendu — Lot B, sous-lot B4 (session courante) — dernier sous-lot, Lot B clos

- **Composants livrés** : `diff-viewer` (`components/ui/diff-viewer.tsx`, `DiffViewer`) et `file-upload` (`components/ui/file-upload.tsx`, `FileUpload`).
- **Consommateurs réels** : `AuditPage.tsx` (remplace deux blocs `<pre>` JSON bruts indépendants par une vraie table de comparaison champ par champ, réutilise `components/ui/table.tsx` de B1) ; `DocumentOcrPage.tsx` (remplace l'`<input type="file">` natif par une zone de glisser-déposer réelle, enveloppée dans `FormField` de B1).
- **Vérifié en navigateur réel** : table Champ/Avant/Après affichée correctement sur une vraie entrée d'audit (1681 entrées avec détail disponible en base) ; sélection de fichier par clic **et** par glisser-déposer réel (événement `drop` avec un vrai `DataTransfer`/`File`) toutes deux fonctionnelles sur document-ocr.
- `npm run build`/`lint`/`test` propres (35/35 tests, +7 depuis B3), aucune régression.
- **Écart par rapport au plan initial** : aucun.

## CH-032 clos — Lot B terminé

Les 7 composants prévus par `docs/frontend-plan/COMPOSANTS_PARTAGES_MANQUANTS.md` sont livrés, chacun avec au moins un consommateur réel vérifié en navigateur : `table`, `form`/`FormField`, `date-picker`/`DateRangeField`, `tabs`, `select-search`/`SelectSearch`, `toast`/`toastManager`, `diff-viewer`/`DiffViewer`, `file-upload`/`FileUpload`. La dette structurelle identifiée en Phase 11 §2 (huit écrans ayant chacun contourné l'absence de ces composants avec des primitives ad hoc) est résorbée à la source — les futurs écrans consomment désormais un socle réel plutôt que de le recontourner.

## Compte-rendu — Lot C, CH-034 (session courante)

- **Arbitrage produit** : posé via `AskUserQuestion` en ouverture du lot comme prévu — l'utilisateur a choisi **« Investir dans le responsive »**, contre l'option par défaut recommandée « Desktop-only assumé » (décision tracée : `REGISTRE_DECISIONS.md`, RD-021).
- **Composants/écrans livrés** : `AppSidebar.tsx` (tiroir mobile superposé sous `md` — backdrop, fermeture `Escape`, fermeture auto au clic nav, libellés toujours complets en mode tiroir) et `AppTopbar.tsx` (bouton hamburger, visible seulement sous `md`) ; câblage `mobileNavOpen` dans `App.tsx`. `DashboardPage.tsx` n'a nécessité aucune modification — sa grille KPI était déjà adaptative (`grid gap-3 sm:grid-cols-2 lg:grid-cols-3`), le vrai blocage structurel était la sidebar à largeur fixe toujours affichée.
- **Vérifié en navigateur réel** (Playwright, données seedées réelles, connexion `admin@makarim.test`), deux viewports : mobile (375×812) — sidebar hors écran par défaut, hamburger visible, tiroir s'ouvre avec libellés complets, backdrop visible/cliquable, `Escape` ferme, clic nav navigue et ferme ; desktop (1440×900) — hamburger invisible, sidebar statique, bascule `collapsed` intacte, aucun backdrop. 14/14 assertions.
- `npm run build`/`lint`/`test` propres (42/42 tests, +7 depuis la clôture du Lot B).
- **Écart par rapport au plan initial** : aucun — périmètre exactement celui annoncé par la fiche CH-034 (`AppSidebar.tsx`, `AppTopbar.tsx`, écrans les plus consultés — dashboard n'a in fine rien nécessité).
- **Reste à faire dans le Lot C** : CH-029 (accessibilité — plugin `jsx-a11y`, focus trap/restoration sur `components/ui/dialog.tsx`, 3 parcours clavier prioritaires check-in/housekeeping/facturation).

## Compte-rendu — Lot C, CH-029 (session courante) — dernier chantier du lot, Lot C clos

- **Plugin `eslint-plugin-jsx-a11y`** activé (`jsxA11y.flatConfigs.recommended`) — installé via `--legacy-peer-deps` (la version publiée n'a pas encore de peer range ESLint 10), fonctionnement réel vérifié (9 violations détectées au premier lint, pas un plugin inerte). Effet de bord découvert et corrigé : `--legacy-peer-deps` avait désinstallé `@testing-library/dom` (peer auto-installé de `@testing-library/react`), cassant `tsc -b` sur tous les fichiers de test — corrigé en le déclarant explicitement en devDependency.
- **9 violations réelles corrigées**, transverses (pas limitées aux 3 parcours prioritaires — lint doit rester globalement propre) : `label.tsx` (règle désactivée pour ce seul wrapper générique, association vérifiée à chaque site d'appel) ; 2 `<Label>` sans contrôle converties en texte simple (`CompaniesPage.tsx`, `GuestPicker.tsx`) ; 3 `<Label>`+`<Select>` reliés par `htmlFor`/`id` (`AuditPage.tsx` ×2, `DocumentOcrPage.tsx`) ; 2 `<li onClick>` restructurées en `<li><button>` (`CheckinPage.tsx`) ; `KpiCard` (`DashboardPage.tsx`) — `onKeyDown` ajouté à un `role="button"` déjà présent mais sans clavier ; `ReservationBar` (`ReservationsCalendarPage.tsx`) rendue clavier-opérable, la cellule de grille à glisser-sélectionner a reçu une désactivation ciblée documentée (vrai geste souris sans équivalent clavier simple, chantier de conception à part, hors périmètre).
- **Focus trap/restauration sur `dialog.tsx`** : découverte que `@base-ui/react/dialog` fournit déjà ce comportement nativement (`FloatingFocusManager`, floating-ui, mode modal) — vérifié en lisant le code source du primitif, pas supposé. 3 nouveaux tests Vitest (`dialog.test.tsx`) le prouvent plutôt que d'ajouter du code inutile.
- **Vérifié en navigateur réel** (Playwright, données seedées réelles) sur les 3 parcours prioritaires : check-in (dialogue de séjour ouvert/focus/basculé/fermé au clavier, `SelectSearch` du walk-in filtré au clavier), housekeeping (`Select` de statut ouvert/fermé au clavier). 10/10 assertions.
- `npm run build`/`lint`/`test` propres (45/45 tests, +3 depuis CH-034).
- **Constat documenté, non corrigé ici** : `StayDetailsDialog.tsx` bascule Détails/Facturation/Police avec de simples `<Button>` plutôt que le composant `Tabs` du Lot B2 — déjà clavier-opérable nativement mais sans sémantique ARIA `tablist`/`tab`. Migration non effectuée (élargirait CH-029 à une reprise de composant déjà couverte par CH-032, clos) — dette notée pour un futur passage.

## Lot C clos — CH-034 + CH-029 terminés

Les deux chantiers du lot sont livrés et vérifiés en conditions réelles. Détail complet et bilan : `docs/governance/REGISTRE_CHANTIERS.md` (fiches CH-034, CH-029).

**Prochain lot proposé** : Lot D — performance/sécurité (CH-030, code splitting par onglet ; CH-026(e), migration des tokens JWT vers un cookie `httpOnly` — le chantier le plus risqué de toute la vague, nécessite une note de conception CSRF/CORS avant tout code). En attente de votre feu vert.
