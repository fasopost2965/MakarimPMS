# Guide de reprise · travailler sur MakarimPMS avec un assistant IA

Ce document répond à une question simple : *si je rouvre ce dépôt dans six mois avec
un autre assistant (Claude, Codex, Cursor…), a-t-il assez d'informations pour
continuer sans me faire répéter le contexte ?* Oui, à condition de lui donner le bon
point d'entrée, et c'est l'objet de cette page.

## 1. Ce que contient le dépôt

Trois choses distinctes cohabitent, et il faut savoir laquelle on touche :

| Dossier | Nature | Technologie | État |
| --- | --- | --- | --- |
| `backend/` | API du PMS réel | NestJS 11, TypeScript, Prisma 6, MySQL 8, Redis/BullMQ, JWT (access + refresh), Swagger, Jest (unitaires + e2e sur vraie base) | 24 modules métier, migrations Prisma versionnées, seed de démonstration |
| `frontend/` | Interface du PMS réel | React 19, Vite, TypeScript, Tailwind 4, shadcn/ui (Base UI), `fetch` via `src/lib/api-client.ts`, Vitest + Playwright | Consomme l'API, authentification JWT |
| `prototype/` | Maquette cliquable de refonte | React 19, Vite, Tailwind 4, **sans backend** : tout l'état vit dans `localStorage` | 13 écrans + portail, c'est ce que le commanditaire utilise pour valider |

**Point à ne jamais confondre** : le prototype ne parle pas à l'API. Il simule les
règles métier (tarification, folios, TVA, RBAC) dans `prototype/src/store.jsx`. Les
allers-retours de conception se font sur le prototype ; la mise en production se fait
dans `backend/` + `frontend/`.

## 2. Par où commencer la lecture

1. `AGENTS.md` : règles de travail communes (priorité en cas de divergence).
2. `CLAUDE.md` : contexte technique détaillé, commandes, invariants.
3. `docs/SYSTEM_ARCHITECTURE.md` puis `docs/DEPENDENCY_GRAPH.md`.
4. `docs/BUSINESS_RULES.md` et `docs/modules/` : les règles métier, numérotées `BR-*`.
5. `docs/governance/REGISTRE_DECISIONS.md` : chaque arbitrage, avec sa raison et les
   alternatives écartées. **C'est le document qui évite de refaire les débats.**
6. `prototype/README.md` : ce que la maquette sait faire, écran par écran.
7. `docs/audits/` : état des lieux, écarts assumés, audit des routes, audits de design.

## 3. Commandes utiles

```bash
# Prototype (aucune base de données nécessaire)
cd prototype && npm install && npm run dev      # http://localhost:5173
cd prototype && npx vite build                  # vérifie que tout compile
cd prototype && npx esbuild src/main.jsx --bundle --format=esm --jsx=automatic \
  --loader:.css=empty --outfile=/tmp/app.mjs    # bundle de test pour jsdom

# API réelle
cd backend && npm install && npx prisma migrate dev && npx prisma db seed
cd backend && npm run start:dev                 # port 3000

# Interface réelle
cd frontend && npm install && npm run dev       # port 5173 (proxy vers l'API)

# Tout l'environnement
docker compose up -d                            # MySQL 3307, Redis 6380, API, Nginx
```

Comptes de démonstration du prototype : `y.benali` (direction), `s.idrissi`
(réception), `n.chafik` (gouvernante), `k.azzouzi` (restaurant), `h.loukili`
(comptable), `r.amrani` (maintenance), mot de passe `makarim2026`. Code de
déverrouillage de la grille tarifaire : `MAKARIM`.

## 4. Les règles de travail non négociables

- **Branche dédiée**, jamais `main` ; commits détaillés et commentés.
- Chaque fichier de `prototype/src/` porte un en-tête qui explique son rôle et les
  règles `BR-*` qu'il matérialise. Toute décision non évidente est commentée sur place.
- Ne pas modifier `backend/` ni `frontend/` pour une demande de conception : la
  maquette est le lieu d'essai.
- On **cherche dans la documentation avant de poser une question** ; on ne revient
  vers l'humain que si l'information est absente.
- Toute décision produit se consigne dans `docs/governance/REGISTRE_DECISIONS.md`
  (format RD-0XX : décision, raison, alternatives, conséquence, date).
- Le commanditaire a délégué les arbitrages : trancher, appliquer, expliquer.

## 5. Ce qui est fait, ce qui reste

Fait et validé sur le prototype : parcours réservation → check-in → folio →
restaurant → encaissement → check-out, housekeeping, clôture de journée avec
non-présentations enregistrées et suivies, fiche de police, tours de quart, caisse et
régie, restauration et salle paramétrables, RBAC et comptes nominatifs, exports
PDF/CSV/Excel partout, design system Apple avec apparence réglable, identité
(logo + coordonnées + identifiants fiscaux) reprise sur tous les documents.

Reste à faire pour passer du prototype à la production : brancher chaque écran sur
les endpoints réels, reprendre les règles validées dans `backend/` (facturation
no-show, TVA paramétrée, journal de caisse), migrer les paramètres d'apparence vers
la table `Parameter`, puis écrire les tests e2e Playwright des parcours critiques.

## 6. Comment formuler la demande à un assistant

Un prompt qui fonctionne, à copier tel quel :

> Lis `AGENTS.md`, `CLAUDE.md`, `docs/governance/REGISTRE_DECISIONS.md` et
> `prototype/README.md`. Travaille sur une branche dédiée. La demande : <décrire>.
> Applique les règles de design de `docs/audits/DESIGN_SYSTEM_APPLE_2026-11.md`,
> documente la décision dans le registre, vérifie avec un build suivi d'un smoke
> jsdom, et explique ce que tu as tranché.

Sans cette phrase de cadrage, un assistant risque de réinventer une palette, de
recoder des règles déjà arbitrées ou de casser la cohérence des écrans.
