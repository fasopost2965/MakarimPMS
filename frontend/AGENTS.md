# Frontend — invariants locaux

Appliquer d'abord le `AGENTS.md` racine. Vérifier l'API, les permissions et les
composants existants avant de créer une nouvelle abstraction.

## Produit et intégration

- Évolution visuelle progressive : ne pas réécrire un écran hors du scope.
- Consommer les endpoints et contrats réels ; ne pas inventer de données ou de
  capacité backend pour compléter une maquette.
- Respecter le filtrage RBAC et les conventions de navigation existantes.
- Réutiliser les primitives partagées avant d'en ajouter de nouvelles.
- Un mockup est une intention UX, pas une preuve de comportement métier.

## Validation proportionnée

- Texte ou documentation seulement : contrôle du diff et lint pertinent.
- Logique de composant : Vitest ciblé, puis lint et build selon la portée.
- Parcours, responsive ou interaction réelle : Playwright avec backend réel si
  le comportement dépend de l'API.
- Vérifier les viewports concernés, l'absence d'overflow et les états erreur,
  vide, chargement et permission lorsque la mission les touche.
- Ne pas exiger captures multi-viewports et reviewer UX pour un changement
  documentaire `LOW`.
- Ne pas valider une expérience réelle uniquement depuis le DOM statique si le
  risque concerne navigation, focus, responsive ou action utilisateur.

Sources utiles : `docs/MAKARIM_DESIGN_SYSTEM_2026.md`, `docs/frontend-plan/`,
`frontend/e2e/`, `frontend/src/components/ui/` et le module fonctionnel visé.
