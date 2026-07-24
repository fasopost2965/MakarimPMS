# Plan d'exécution par lot — Qualité frontend (Phase 11)

Détaille, pour chacun des 5 lots définis dans `docs/frontend-plan/LOTISSEMENT_CHANTIERS_QUALITE.md`, l'objectif, le périmètre technique, les risques, la stratégie de test et le format de compte-rendu attendu. **Document de préparation uniquement — aucun lot n'est exécuté par ce document.** L'exécution démarre chantier par lot, sur feu vert explicite, dans l'ordre A → B → C → D → E (sauf réordonnancement demandé).

---

## Lot A — Qualité critique — ✅ Terminé (session courante)

**Objectif** : empêcher qu'une erreur de rendu isolée n'interrompe tout le service, et poser un socle de test automatisé reproductible sur les parcours à risque financier/RBAC.

**Chantiers inclus** : CH-031 (error boundary transverse) + CH-028 (socle de tests).

**Périmètre technique** :
- Fichiers nouveaux : `frontend/src/components/ErrorBoundary.tsx` ; `frontend/vitest.config.ts` (ou intégration dans `vite.config.ts`) ; premiers fichiers `*.test.tsx`/`*.test.ts`.
- Fichiers modifiés : `frontend/src/App.tsx` (l'`ErrorBoundary` enveloppe le rendu par onglet) ; `frontend/package.json` (nouvelles devDependencies : `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`).
- Interfaces métier concernées : navigation par onglet et gating RBAC (`AppSidebar`/`NAV_ITEMS`), rafraîchissement de token (`lib/api-client.ts`).
- Tests à créer (départ ciblé, pas une couverture exhaustive) : test de confinement de l'`ErrorBoundary` (une erreur provoquée dans un onglet n'empêche pas la navigation vers les autres) ; test du filtrage RBAC de `AppSidebar` (un rôle sans permission ne voit pas l'onglet) ; test de `lib/api-client.ts` reproduisant un bug réel déjà rencontré cette session (corps de réponse vide hors 204, CH-007) ; test d'un flux financier simple (ex. affichage du solde d'un folio).

**Risques principaux et mitigation** :
- Mal choisir la frontière de l'`ErrorBoundary` (trop large masque des erreurs utiles, trop étroit ne protège pas assez) → l'envelopper au niveau du switch d'onglet dans `App.tsx`, périmètre déjà arbitré dans la fiche CH-031.
- Alourdir inutilement le pipeline avec une suite trop ambitieuse d'entrée → démarrer avec 3-5 tests ciblés, pas une couverture large immédiate (CH-028 reste une pratique continue au-delà de ce lot).
- Faux sentiment de sécurité si les tests ne couvrent que des cas triviaux → au moins un test doit reproduire une régression réelle déjà rencontrée dans ce projet, pas uniquement un cas de démonstration.

**Stratégie de test (barre à 100 % avant clôture du lot)** :
- `npm run test` (nouveau script) passe à 100 % sur l'ensemble des tests écrits dans ce lot.
- Preuve sabotage/restore sur l'`ErrorBoundary` : retirer temporairement le composant, confirmer le crash total (comme aujourd'hui), le remettre, reconfirmer le confinement — même discipline que les règles non négociables du backend (`CLAUDE.md`).
- `npm run build` et `npm run lint` (frontend) propres.
- Vérification manuelle en navigateur réel que la navigation entre onglets existants n'est pas affectée.

**Format de compte-rendu attendu** : même structure que les fiches de `REGISTRE_CHANTIERS.md` (Résolution, Critères de validation vérifiés un par un, Éléments testés, Documents liés) pour chaque chantier du lot, plus un court résumé de lot en tête (objectif atteint, écarts découverts s'il y en a, statut des deux fiches mis à jour dans `REGISTRE_CHANTIERS.md`/`BACKLOG_PRIORISE.md`).

**Compte-rendu réel (session courante)** :
- Objectif atteint : `ErrorBoundary` livré et intégré (`App.tsx`, `resetKey={tab}`) ; socle Vitest + Testing Library livré (`vitest.config.ts`, `src/test/setup.ts`, script `npm run test`).
- 4 tests ciblés livrés, tous verts (13 assertions) : `components/ErrorBoundary.test.tsx`, `components/layout/AppSidebar.test.tsx`, `lib/api-client.test.ts`, `features/billing/components/BillingTabContent.test.tsx` — voir le détail dans `REGISTRE_CHANTIERS.md` (CH-028, CH-031).
- Preuve sabotage/restore réalisée **en navigateur réel** (Playwright, pas seulement en test unitaire) : `throw` temporaire dans `StockPage.tsx`, crash confirmé confiné (fallback affiché, sidebar/navigation vers les autres onglets fonctionnelles, bouton de retour opérationnel), sabotage retiré, comportement normal revérifié (`git status` confirmant un fichier identique à l'original après restauration).
- `npm run build`/`lint`/`test` propres, aucune régression détectée.
- Aucun écart par rapport au plan de ce lot — périmètre et ordre interne (CH-031 puis CH-028) respectés tels que prévus.
- Statuts mis à jour dans `REGISTRE_CHANTIERS.md` (fiches CH-031/CH-028), `BACKLOG_PRIORISE.md` (Vague 4) et `REGISTRE_RISQUES.md` (R-13 fermé, R-15 réduit).

---

## Lot B — Fondations transverses

**Objectif** : rembourser la dette des composants partagés jamais construits (Lot 0 d'origine), chacun appliqué immédiatement à un écran réel existant.

**Chantiers inclus** : CH-032 uniquement, sous-découpé en 4 sous-lots pour rester digestible :
- **B1** — `table` + `form` (priorité Haute).
- **B2** — `tabs` + `date-picker`.
- **B3** — `toast` + `select` avec recherche.
- **B4** — `file-upload` + `diff-viewer`.

**Périmètre technique** :
- Fichiers nouveaux : `frontend/src/components/ui/{table,form,date-picker,tabs,toast,file-upload,diff-viewer}.tsx`.
- Fichiers modifiés (un consommateur réel par composant, pas de composant construit en isolation) : `StockPage.tsx` ou `GuestsPage.tsx` (table), `PoliceRecordForm.tsx` ou tout formulaire multi-champs existant (form), `StockPage.tsx` (tabs, remplace le pattern `useState`+boutons actuel), un écran avec sélection de date (date-picker), `DocumentOcrPage.tsx` (file-upload, remplace l'`<input type="file">` natif), `AuditPage.tsx` (diff-viewer, remplace le `<pre>{JSON.stringify(...)}</pre>` actuel).
- Interfaces métier concernées : toutes les features déjà livrées consommant une liste, un formulaire, un onglet simulé, une sélection de date, une notification, un upload ou un diff.
- Tests à créer/étendre : un test Vitest + Testing Library par composant partagé (rendu, interactions clavier de base), en s'appuyant sur le socle posé au Lot A.

**Risques principaux et mitigation** :
- Sur-ingénierie (composants trop génériques/abstraits pour un besoin réel) → dériver chaque composant strictement du besoin de l'écran qui le consomme immédiatement, aucune API spéculative pour un usage futur hypothétique.
- Régression visuelle sur les écrans déjà livrés lors du remplacement d'une primitive ad hoc → vérification manuelle en navigateur réel systématique après chaque remplacement, écran par écran.

**Stratégie de test (barre à 100 % avant clôture de chaque sous-lot)** :
- Test Vitest dédié à chaque composant livré, passant à 100 %.
- Vérification manuelle en navigateur réel de chaque écran modifié (aucune régression fonctionnelle ni visuelle).
- Build/lint frontend propres après chaque sous-lot.

**Format de compte-rendu attendu** : idem Lot A, plus un tableau récapitulatif « composant → écran consommateur → statut » prouvant qu'aucun composant n'est resté sans consommateur réel (règle déjà actée dans `PLAN_DEVELOPPEMENT_FRONTEND.md` §5) — un tableau par sous-lot (B1 à B4) ou un tableau consolidé si le lot est mené d'un seul tenant.

---

## Lot C — UX / accessibilité

**Objectif** : trancher explicitement la portée responsive du frontend admin, puis fiabiliser l'accessibilité clavier des parcours prioritaires.

**Chantiers inclus** : CH-034 (arbitrage responsive/mobile) + CH-029 (accessibilité).

**Périmètre technique** :
- CH-034 (avant tout code) : question `AskUserQuestion` — desktop-only assumé (coût nul, une ligne dans `EXIGENCES_UX.md`) vs. investissement responsive réel (coût réel, à chiffrer une fois le périmètre connu). Si « investir » : `AppSidebar.tsx`, `AppTopbar.tsx`, écrans les plus consultés (dashboard en priorité).
- CH-029 : `components/ui/dialog.tsx` (gestion de focus — trap + restauration à la fermeture, composant le plus réutilisé de l'application) ; `frontend/eslint.config.*` (activation de `eslint-plugin-jsx-a11y`) ; attributs `aria-label`/`aria-describedby` sur les contrôles interactifs sans texte visible dans les 3 parcours prioritaires (check-in, housekeeping, facturation).
- Interfaces métier concernées : tous les dialogues de l'application (via `dialog.tsx`), les 3 parcours prioritaires listés ci-dessus.
- Tests à créer/étendre : test Vitest du focus trap/restauration sur `dialog.tsx` (s'appuie sur le socle du Lot A) ; si CH-034 « investir » : vérification manuelle sur viewport réduit (devtools responsive) des écrans concernés.

**Risques principaux et mitigation** :
- Sur-cadrer CH-034 en développement complet avant même la réponse de l'arbitrage → séparer strictement la question (posée en ouverture de lot) du développement (qui ne démarre qu'après la réponse).
- Accessibilité « cosmétique » (attributs ajoutés sans vérification réelle du comportement) → vérification manuelle réelle au clavier des 3 parcours prioritaires de bout en bout, pas seulement un lint qui passe.

**Stratégie de test (barre à 100 % avant clôture du lot)** :
- `eslint-plugin-jsx-a11y` sans violation bloquante sur les fichiers touchés.
- Test Vitest du focus trap de `dialog.tsx` passant à 100 %.
- Vérification manuelle réelle : les 3 parcours prioritaires utilisables intégralement au clavier (tab, entrée, échap), sans piège de focus.
- Si CH-034 « investir » : vérification manuelle sur viewport réduit sans régression sur desktop.

**Format de compte-rendu attendu** : idem Lot A, avec en tête la trace explicite de la décision CH-034 (renvoi vers la `RD` correspondante dans `REGISTRE_DECISIONS.md`) avant le détail du travail CH-029.

---

## Lot D — Performance / sécurité

**Objectif** : réduire le temps de chargement initial par découpage de bundle, et éliminer l'exposition des tokens JWT à un vol par XSS.

**Chantiers inclus** : CH-030 (code splitting) + CH-026(e) (tokens → cookie `httpOnly`).

**Périmètre technique** :
- CH-030 : `frontend/src/App.tsx` uniquement (`React.lazy` + `Suspense` par onglet, état de chargement cohérent avec `EXIGENCES_UX.md`).
- CH-026(e) — le chantier le plus large de toute la vague, touche backend **et** frontend :
  - Backend : nouvelle route de login/refresh posant un cookie `httpOnly`+`SameSite` plutôt que de renvoyer les jetons en JSON ; conception d'une protection CSRF (absente aujourd'hui, ex. pattern double-submit cookie ou header personnalisé) ; révision du carve-out CORS documenté pour F4 (`booking-engine`)/F6 (`self-checkin`) dans `main.ts`.
  - Frontend : `lib/api-client.ts` (ne lit/n'envoie plus le token manuellement, s'appuie sur le cookie du navigateur), `lib/token-storage.ts` (à retirer ou fortement simplifier), tous les appelants qui lisaient `getAccessToken()` explicitement.
- Une **mini note de conception** (CSRF + révision CORS) est un prérequis écrit avant le premier commit de code CH-026(e) — pas un simple refactor mécanique, cohérent avec la discipline ADR déjà en place pour tout changement architectural de ce projet.

**Risques principaux et mitigation** :
- CH-026(e) touche l'authentification de bout en bout (le risque le plus élevé de toute la vague) → le mener en dernier de ce lot, après le socle de tests (Lot A) déjà posé, avec la note de conception écrite et relue avant tout code.
- Casser le carve-out CORS public existant (F4/F6) → relire `main.ts` et les 2 specs de module concernées (`booking-engine.md`, `self-checkin.md`) avant tout changement, tests e2e dédiés sur ces deux surfaces publiques.

**Stratégie de test (barre à 100 % avant clôture du lot)** :
- CH-030 : chunks séparés par onglet confirmés dans la sortie `npm run build` ; onglet réseau du navigateur confirmant qu'un utilisateur à permissions réduites ne télécharge plus le JS des onglets inaccessibles ; aucune régression de navigation.
- CH-026(e) : suite e2e backend complète rejouée sans régression (`auth.e2e-spec.ts` étendu) ; flux complet login → refresh → logout fonctionnel via cookie, vérifié manuellement et par test automatisé ; preuve sabotage/restore explicite sur la protection CSRF (retirer temporairement la garde, confirmer l'exploitation possible, la remettre, reconfirmer bloqué — même discipline que les règles de sécurité non négociables du projet) ; vérification que le carve-out CORS public (F4/F6) reste fonctionnel après la révision.

**Format de compte-rendu attendu** : idem Lot A ; pour CH-026(e) spécifiquement, la note de conception CSRF/CORS doit être annexée ou renvoyée en tête du compte-rendu, avant le détail d'implémentation.

---

## Lot E — Finition produit

**Objectif** : câbler l'identité visuelle réelle de l'hôtel (titre d'onglet, favicon, langue, logo) dans l'application.

**Chantiers inclus** : CH-033 uniquement.

**Périmètre technique** : `frontend/index.html` (`<title>`, `lang="fr"`), `frontend/public/favicon.*` (nouveau fichier dérivé du logo), `frontend/src/components/layout/AppSidebar.tsx` (remplacement du badge « M » générique). Aucune interface métier concernée (chantier purement cosmétique).

**Risques principaux et mitigation** :
- Bloquer sur l'absence d'un asset graphique prêt à l'emploi (le logo source est un JPEG fond blanc, probablement à retravailler en SVG/PNG avec fond transparent) → clarifier avec l'utilisateur, avant de démarrer ce lot, qui produit cet asset (hors compétence de génération d'image de ce projet).

**Stratégie de test** : vérification visuelle manuelle uniquement (onglet navigateur, sidebar repliée/dépliée, contraste clair/sombre si applicable) — pas de test automatisé pertinent pour ce périmètre.

**Format de compte-rendu attendu** : court, cohérent avec le périmètre limité — captures ou description de l'état avant/après suffisent, pas besoin du format complet des autres lots.

---

## Rappel — discipline commune à tous les lots

- Aucun lot ne démarre sans feu vert explicite de l'utilisateur, y compris le Lot A.
- Chaque lot se clôture par la mise à jour du statut des fiches concernées dans `docs/governance/REGISTRE_CHANTIERS.md` (champ *Statut*, section « Suivi d'avancement ») et `docs/governance/BACKLOG_PRIORISE.md` (Vague 4) — jamais un chantier marqué *terminé* sur la seule base d'un « ça compile »/« ça a l'air de marcher », cohérent avec `docs/governance/CRITERES_GO_LIVE.md` §Critères de « done ».
- Build + lint (frontend, et backend si CH-026(e) est concerné) propres avant toute clôture de lot.
- Un compte-rendu de lot ne remplace pas la fiche individuelle de chaque chantier dans le registre — il la complète avec une vue d'ensemble du lot.
