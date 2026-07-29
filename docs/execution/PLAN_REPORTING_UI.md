# PLAN_REPORTING_UI.md — CH-054, écrans manquants du module reporting

**Origine** : audit comparatif `main` vs `MakarimPMS_v2` demandé par l'utilisateur (session courante) — le point le plus significatif remonté n'est pas dans v2 du tout : c'est le backend `reporting` de **`main` lui-même** qui a 4 endpoints réels, documentés (`docs/modules/reporting.md` §17, marqués « implémenté »), jamais consommés par le frontend. Même schéma déjà rencontré 3 fois cette session (CH-038/039/040) : capacité backend réelle, zéro UI.

**Vérifié dans le code, pas supposé** (`backend/src/modules/reporting/reporting.controller.ts`, lu en entier) :

| Endpoint | Permission | Appelé par le frontend aujourd'hui ? |
|---|---|---|
| `GET /reporting/financial-summary` | `reporting:read` | Oui |
| `GET /reporting/export` (grand livre CSV) | `reporting:export` | Oui |
| `GET /reporting/police-report` (arrivées du jour) | `reporting:export` | Oui |
| `GET /reporting/taxes` | `reporting:read` | **Non** |
| `GET /reporting/police-register` (registre légal, CSV/JSON) | `reporting:export` | **Non** |
| `GET /reporting/yield-forecast` (F3, Revenue Management) | `reporting:read` | **Non** |
| `GET /reporting/export/async` + `/export/async/:jobId` | `reporting:export` | **Non** |

## Portée retenue

3 des 4 lacunes sont de vraies capacités métier absentes de l'écran actuel — ajoutées comme 3 nouvelles cartes dans `ReportingPage.tsx`, même convention de mise en page que l'existant (cartes empilées, pas d'onglets — la page n'en avait pas besoin jusqu'ici) :

1. **Détail des taxes collectées** (`GET /reporting/taxes`) — tableau par taxe (type, mode, montant collecté, nb de lignes), avec la section « Trésor » (taxes reversées à l'État, `collectePourTresor`) isolée visuellement pour la déclaration DGI — exactement l'usage documenté côté backend. Filtre optionnel par taxe (réutilise `listTaxRates()` déjà existant dans `parameters/api.ts`, pas de nouvel appel).
2. **Registre légal police** (`GET /reporting/police-register`) — vue JSON tabulaire (nom, pièce, nationalité, chambre, arrivée/départ) en plus du CSV déjà supporté côté backend, avec bouton d'export CSV à côté. Distinct de la carte « Rapport de police (arrivées du jour) » déjà existante : celle-ci couvre une plage de dates et les personnes réellement enregistrées (`PoliceRecord`), pas seulement les arrivées d'une journée.
3. **Prévision de revenu (Yield Management, F3)** — tableau par type de chambre × jour (taux d'occupation, prix actuel, recommandation HAUSSE/BAISSE/STABLE, prix suggéré), purement consultatif (INV-REP-001, aucune écriture). Filtre optionnel par type de chambre (réutilise `listRooms()` pour dériver la liste des types, même pattern que `SeasonRatesSection`).

**Écarté de cette itération** : `export/async` + `/async/:jobId` — chemin technique alternatif (file BullMQ) vers le **même** CSV que `GET /reporting/export` déjà exposé et déjà consommé de façon synchrone ; n'ajoute aucune capacité métier nouvelle pour l'utilisateur, seulement de la résilience pour un export volumineux. Pas de scénario métier concret remonté qui le justifierait maintenant — dette technique documentée, pas un oubli.

## Découvertes v2 explicitement écartées (pour mémoire, jamais à réutiliser)

L'audit comparatif a identifié plusieurs endroits où `v2` invente des données présentées comme réelles — aucun n'est repris ici ni ailleurs :
- `HrAnalyticsChart.tsx` : 12 mois de chiffres RH/paie fabriqués, export qui ne fait qu'un `alert()`.
- `CompanyDetailView.tsx` : rattachement client↔entreprise par correspondance de texte heuristique (`preferences.includes(raisonSociale)`), solde de compte courant à `0,00 MAD` codé en dur.
- `specimenGenerator.ts` : génère de fausses pièces d'identité avec des noms inventés.
- `QrCheckinScannerDialog.tsx` : badges « Pièce ID ✓ / Fiche Police ✓ / Chambre Prête ✓ » jamais réellement vérifiés.

Ces 4 points sont documentés ici uniquement pour qu'aucun futur chantier ne les propose par erreur — le module reporting de cette itération n'en reprend aucun (ses 3 nouvelles cartes s'appuient exclusivement sur des endpoints `main` déjà réels).

## Tests prévus

- Vitest : rendu du tableau des taxes (section Trésor isolée), rendu du registre police (colonnes attendues), rendu de la prévision (badge de recommandation par seuil).
- Vérification navigateur réelle (Playwright, données seedées réelles) : les 3 nouvelles cartes renvoient des données cohérentes avec l'état réel de la base (comparaison avec une requête Prisma directe si besoin), export CSV du registre déclenché avec succès.
- `npm run build`/`lint`/`test` clean, aucune régression sur les 2 cartes existantes.
