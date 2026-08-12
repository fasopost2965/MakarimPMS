# DESIGN-005 — Prototypes d'exploration Desktop UX

Ce dossier contient TROIS prototypes visuels isolés, comparant des directions
de design pour le Login et le Dashboard desktop de MakarimPMS.

**Aucun de ces fichiers n'est branché sur l'application réelle.** Aucune
donnée n'est chargée depuis le backend — tout est mocké localement dans
`mock-data.ts`, avec des formes calquées sur les vrais contrats API
(`DashboardResume`, `Room`, `MaintenanceTicket`, `RoleActif`, prévision
d'occupation) pour que la comparaison reste honnête sur ce qui est
réellement affichable en production.

## Comment consulter les prototypes

En local (`npm run dev`), ouvrir :

- `/design-preview/a` — Prototype A, "Premium Hôtelier"
- `/design-preview/b` — Prototype B, "Operations Command Center"
- `/design-preview/c` — Prototype C, "Living Operations" (recommandation)

Le branchement se fait dans `frontend/src/main.tsx`, par test de préfixe
d'URL — même mécanisme déjà utilisé pour les apps mobiles autonomes
(`/mobile/housekeeping`, `/mobile/maintenance`). Rien dans `App.tsx`,
`AppSidebar.tsx`, `LoginPage.tsx` ni `DashboardPage.tsx` n'est modifié.

## Suppression après décision

Une fois une direction choisie (ou si l'exploration est abandonnée) :

1. Supprimer ce dossier `frontend/src/design-prototypes/`.
2. Retirer les 3 lignes de branchement `/design-preview/*` dans `main.tsx`.

Aucune autre trace dans le reste du code.
