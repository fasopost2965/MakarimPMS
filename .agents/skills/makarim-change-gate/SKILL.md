---
name: makarim-change-gate
description: Applique le gate complet de changement MakarimPMS lorsqu'une mission demande explicitement préflight, triage, safety ou QA, ou concerne un risque concurrence, sécurité, migration, CI/CD ou production. Utiliser aussi pour décider formellement CHANGE, NO CHANGE ou STOP avant une livraison ; ne pas déclencher pour chaque édition ordinaire sans demande de gate.
---

# Makarim change gate

Orchestrer les règles des `AGENTS.md` applicables sans les recopier. La matrice
de risque, les exigences de preuve et les validations proportionnées du routeur
racine font autorité.

## Gate

1. **Préflight**
   - Résoudre racine, worktree, branche, `HEAD`, base et état Git.
   - Extraire scope, autorisations, interdictions et dépendances de validation.
   - Arrêter avant édition si l'un de ces éléments est ambigu.

2. **Triage**
   - Formuler l'hypothèse testable et chercher la preuve minimale pertinente.
   - Classer `CONFIRMED`, `REFUTED`, `NOT REPRODUCIBLE` ou `NOT VERIFIED`.
   - Retourner `NO CHANGE` si aucun défaut pertinent n'est démontré ; ne pas
     inventer une correction préventive.

3. **Risque et stratégie**
   - Appliquer `LOW`, `MEDIUM`, `HIGH` ou `CRITICAL` selon `AGENTS.md`.
   - Définir avant édition : comportement préservé, preuve ciblée, validations
     justifiées, condition d'arrêt et actions interdites.
   - Exiger MySQL/Redis réels seulement lorsque leur sémantique constitue la
     preuve ; ne pas remplacer un environnement absent par une preuve plus faible.

4. **Décision d'implémenter**
   - Continuer seulement pour un défaut `CONFIRMED` ou une capacité explicitement
     arbitrée, avec scope et autorisation compatibles.
   - Réaliser le plus petit diff cohérent, sans nettoyage opportuniste.
   - Rester en lecture seule lorsque la mission est un audit, un test du gate ou
     une conception.

5. **QA**
   - Exécuter les contrôles prévus du plus ciblé au plus large.
   - Ajouter sabotage/restore, environnement réel et reviewer uniquement lorsque
     la matrice les exige.
   - Distinguer PASS, FAIL et non vérifié. Ne déclarer `QA RESULT: PASS` que si
     toutes les preuves obligatoires existent.

6. **Livraison**
   - Vérifier le diff final et les changements étrangers.
   - Commit, push, PR, merge, rerun et déploiement restent des autorisations
     distinctes.

## Rapport

```text
Base / HEAD:
Classification preuve:
Risque:
Décision: CHANGE / NO CHANGE / STOP
Fichiers:
Validations:
Reviewer:
QA RESULT:
Risques résiduels:
Actions non effectuées:
```

Pour `NO CHANGE`, citer la preuve qui rend la correction non démontrée ou non
pertinente. Cette conclusion est réussie, pas incomplète.
