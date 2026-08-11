# MakarimPMS — instructions pour agents

Ce fichier est le routeur permanent de travail du dépôt. Il reste volontairement
court : charger ensuite seulement les sources utiles à la mission.

## Philosophie

- Faire évoluer MakarimPMS progressivement, dans l'architecture existante.
- Ne jamais transformer une demande locale en refonte implicite.
- Vérifier le code et les tests avant de suivre une hypothèse documentaire.
- Chercher la plus petite solution qui démontre le résultat demandé.
- Considérer `NO CHANGE` comme un résultat valide lorsqu'aucun défaut pertinent
  n'est démontré.
- Signaler et expliquer une hypothèse fausse, une instruction inutile ou une
  solution plus sûre au lieu de l'appliquer mécaniquement.

## Préflight obligatoire avant changement

1. Résoudre la racine Git réelle et le worktree actif.
2. Afficher la branche, le `HEAD`, la base attendue et l'état du worktree.
3. Vérifier que la mission vise bien ce worktree et cette révision.
4. Préserver tout changement existant qui n'appartient pas à la mission.
5. Identifier les fichiers autorisés, les actions externes autorisées et les
   interdictions explicites.

Ne pas modifier de fichier tant que le périmètre Git est ambigu.

## Preuve avant correction

- Reproduire ou établir le défaut avec la preuve la moins coûteuse adaptée.
- Classer l'hypothèse : `CONFIRMED`, `REFUTED`, `NOT REPRODUCIBLE` ou
  `NOT VERIFIED`.
- Ne pas corriger un risque seulement plausible comme s'il était confirmé.
- Si l'hypothèse est réfutée ou sans impact dans le périmètre : conclure
  `NO CHANGE` et fournir la preuve.
- Ne jamais affaiblir un test, contourner une erreur d'environnement ou utiliser
  la production pour fabriquer une validation.

## Classification du risque

Classer le changement au niveau le plus élevé qui s'applique.

| Niveau | Exemples | Validation minimale | Safety / review / humain |
|---|---|---|---|
| `LOW` | documentation, commentaire, libellé sans comportement | contrôle du diff, liens ou lint ciblé | pas de sabotage ; reviewer non requis sauf demande |
| `MEDIUM` | bug métier localisé, composant UI, endpoint sans concurrence | test ciblé + lint/build du périmètre ; intégration si frontière réelle touchée | reviewer selon portée ; validation humaine seulement pour arbitrage ou extension de scope |
| `HIGH` | concurrence, auth/sécurité, migration, transaction, CI/CD ou rollback | reproduction, tests d'intégration réalistes, régression et sabotage/restore lorsque le mécanisme est testable | reviewer indépendant requis ; stratégie explicitement autorisée |
| `CRITICAL` | production, données réelles, accès/modification de secrets réels, action destructive ou irréversible | préflight spécifique, plan de retour et vérification externe autorisée | autorisation humaine exacte avant action ; jamais d'expérimentation en production |

La présence du mot « sécurité » dans un document ne suffit pas à classer un
changement documentaire en `HIGH`. Classer l'effet réel du diff.

## Scope et autorisations

- Une mission d'audit, diagnostic ou revue est en lecture seule.
- Une demande de correction autorise seulement les changements nécessaires à
  l'objectif et dans les sources placées en scope.
- Ne pas modifier backend, frontend, Prisma, Docker, CI/CD, VPS ou secrets par
  simple opportunité.
- Toute expansion matérielle de scope exige un nouvel accord.
- Commit, push, PR, merge, rerun, déploiement et modification externe sont des
  autorisations distinctes ; ne pas les déduire les unes des autres.
- Ne jamais modifier la production sans autorisation explicite visant l'action
  et la cible exactes.

## Tests proportionnés

- Commencer par le contrôle le plus ciblé qui peut réfuter le changement.
- Ajouter lint, typecheck, build et suites plus larges selon la surface touchée.
- Utiliser MySQL/Redis réels pour démontrer transactions, verrous, concurrence,
  migrations et interactions qui dépendent de leur sémantique.
- Un test mocké ou statique ne prouve pas un comportement concurrent réel.
- Exiger sabotage/restore seulement lorsqu'il prouve qu'un garde critique agit
  réellement ; ne pas en faire une cérémonie pour les changements `LOW`.
- Si l'environnement requis est indisponible, rapporter la limite et arrêter ;
  ne pas remplacer la preuve par un test plus faible sans le dire.
- Rapporter séparément ce qui a été exécuté, ce qui a réussi et ce qui reste non
  vérifié.

## Escalade safety

Pour concurrence, sécurité, migration, transaction financière, déploiement ou
production :

1. établir l'état initial et le scénario de défaillance ;
2. identifier les invariants et les opérations irréversibles ;
3. prévoir les tests réalistes et les conditions fail-closed ;
4. faire une revue indépendante du diff stabilisé ;
5. obtenir l'autorisation humaine requise avant toute action externe ou
   destructive ;
6. conclure `QA RESULT: PASS` seulement lorsque toutes les preuves obligatoires
   existent.

## Instructions par répertoire

- Sous `backend/`, lire `backend/AGENTS.md`.
- Sous `frontend/`, lire `frontend/AGENTS.md`.
- Sous `.github/`, lire `.github/AGENTS.md`.
- Le fichier le plus proche du fichier modifié précise ces règles sans annuler
  les contraintes racine.

## Sources de vérité à charger selon la mission

- Vue projet et navigation documentaire : `README.md`, `docs/README.md`.
- Contexte technique détaillé historique : `CLAUDE.md` ; confirmer les faits
  susceptibles d'avoir dérivé dans le code.
- Architecture : `docs/SYSTEM_ARCHITECTURE.md`, `docs/DEPENDENCY_GRAPH.md` et
  ADR pertinents via `docs/ADR_INDEX.md`.
- Métier : `docs/BUSINESS_RULES.md`, `docs/modules/` et
  `docs/state-machines/STATE_MACHINES.md`.
- Décisions, risques et dette : `docs/governance/REGISTRE_DECISIONS.md`,
  `REGISTRE_RISQUES.md`, `DETTE_TECHNIQUE.md` et `ECARTS_DOC_VS_CODE.md`.
- Tests : `docs/testing/TEST_STRATEGY.md` et scripts `package.json` du périmètre.
- Production et déploiement : `docs/operations/OPERATIONS_RUNBOOK.md`,
  `infra/` et workflows GitHub ; lecture seule sans autorisation supplémentaire.
- UX : `docs/MAKARIM_DESIGN_SYSTEM_2026.md`, `docs/frontend-plan/` et tests
  Playwright existants.

Ne pas lire tous ces documents par défaut. Charger uniquement ceux qui répondent
à la mission, puis vérifier les affirmations importantes dans le code réel.

## Sortie attendue

Toujours distinguer : faits vérifiés, inconnus, changements effectués, tests,
risques résiduels et actions non autorisées. Une mission terminée sans diff doit
indiquer explicitement `NO CHANGE`.
