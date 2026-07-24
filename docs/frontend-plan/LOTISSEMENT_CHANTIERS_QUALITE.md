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

## Lot B — Fondations transverses

- **Chantiers inclus** : CH-032 (composants partagés — dette Lot 0).
- **Critère de criticité** : dette structurelle qui grossit à chaque écran livré depuis 8 chantiers — pas un blocage immédiat, mais le fondement de tout ce qui suit (accessibilité, tests).
- **Dépendances entre chantiers** : aucune interne (chantier unique) ; bénéficie d'être mené après le Lot A (les nouveaux composants sont alors testables via le socle Vitest déjà posé), sans y être strictement bloqué.
- **Prérequis** : aucun arbitrage produit — priorités déjà données par `COMPOSANTS_PARTAGES_MANQUANTS.md`.
- **Sous-découpage recommandé** (pour rester digestible) : B1 `table` + `form` (priorité Haute) → B2 `tabs` + `date-picker` → B3 `toast` + `select` recherche → B4 `file-upload` + `diff-viewer`.
- **Ordre interne recommandé** : B1 → B2 → B3 → B4, chaque sous-lot livrable et vérifiable indépendamment (un sous-lot peut s'étaler sur sa propre session si besoin).
- **Critère de « lot terminé »** : les 7 composants existent dans `components/ui/` ET chacun est réellement consommé par au moins un écran existant (aucun composant construit « en isolation » sans consommateur réel — règle déjà actée dans `PLAN_DEVELOPPEMENT_FRONTEND.md` §5).

## Lot C — UX / accessibilité

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
- **Prochain lot proposé** : Lot B (composants partagés), en attente de feu vert.
