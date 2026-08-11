# GitHub Actions — invariants locaux

Appliquer d'abord le `AGENTS.md` racine. Les workflows CI/CD et toute décision
pouvant atteindre la production sont au minimum `HIGH`.

## Analyse et modification

- Inspecter l'événement, `needs`, `if`, outputs, permissions et conclusions de
  jobs comme un graphe complet ; ne pas raisonner sur une étape isolée.
- Préserver la séparation entre CI, déploiement sain, promotion `stable` et
  rollback.
- Ne pas classifier un échec distant par simple parsing fragile d'un message si
  un état ou une sortie structurée existe.
- Préserver les mécanismes fail-closed, la concurrence, les verrous et les états
  monotones existants.
- Ne jamais afficher de secret, clé, jeton ou IP sensible dans logs, summaries ou
  rapports.
- Ne pas modifier workflow, secret, VPS, firewall ou environnement au-delà du
  scope explicitement autorisé.

## Validation

- Exécuter `actionlint` et `git diff --check` pour tout diff workflow.
- Ajouter des assertions structurelles ou une table de vérité pour les
  expressions de contrôle critiques.
- Comparer les scripts distants avant/après lorsqu'ils sont hors scope.
- Une revue indépendante est requise pour retry, rollback, migration,
  permissions, concurrence ou conclusion globale du déploiement.
- Un push, rerun, merge ou déploiement exige son autorisation propre.
- Ne jamais lancer un workflow de production pour tester une hypothèse pendant
  une mission read-only ou statique.

Sources : `.github/workflows/`, `docs/operations/OPERATIONS_RUNBOOK.md`,
`docs/execution/RELEASE_CHECKLIST.md` et `infra/`.
