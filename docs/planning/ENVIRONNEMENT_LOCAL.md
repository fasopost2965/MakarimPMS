# Environnement local de développement — Makarim PMS v1

**Statut au moment de la rédaction : opérationnel et vérifié.** Backend et frontend lancés et testés end-to-end dans cette session (connexion réelle avec un compte de seed, réponse 201 avec access/refresh token).

## Ce qui était déjà en place (aucune intervention nécessaire)

- Dépendances npm installées (`backend/node_modules`, `frontend/node_modules`).
- Client Prisma déjà généré (`backend/node_modules/.prisma/client`).
- `backend/.env` déjà configuré (voir contenu ci-dessous — pointe vers MySQL en port natif 3306, Redis en port 6380).
- `frontend/.env.local` déjà configuré (`VITE_API_URL=http://127.0.0.1:3000/api`).
- Base de données `pms_makarim` déjà créée avec l'utilisateur `pms`, **26 migrations déjà appliquées** (`npx prisma migrate status` → « Database schema is up to date! »).
- Données de seed déjà présentes (connexion réussie avec `admin@makarim.test` / `Password123!`).

## Interventions effectuées dans cette session

Les deux seuls services système nécessaires n'étaient pas démarrés (environnement de conteneur réinitialisé) :

1. `service mysql start` — MySQL 8.0.46 démarré via le socket UNIX natif (pas de Docker : le daemon Docker n'est pas disponible dans cet environnement, `docker compose` échoue avec « failed to connect to the docker API »). **À noter pour la suite** : le port utilisé (3306, natif) diffère de celui documenté dans `backend/.env.example` pour un usage Docker Compose (3307) — le `.env` réel du projet a déjà été adapté au mode natif, cohérent avec l'absence de Docker ici.
2. `redis-server --daemonize yes --port 6380` — Redis démarré en arrière-plan sur le port attendu par `backend/.env` (`REDIS_HOST=127.0.0.1`, `REDIS_PORT=6380`).

**Aucune modification de code, de configuration, ou de migration n'a été nécessaire.** Ces deux commandes suffisent à chaque redémarrage du conteneur/de la machine.

## Comment relancer l'ensemble (procédure complète depuis zéro)

```bash
# 1. Démarrer MySQL (si arrêté)
service mysql start

# 2. Démarrer Redis sur le port attendu par backend/.env
redis-server --daemonize yes --port 6380

# 3. Vérifier que le schéma est à jour (ne réapplique rien si déjà à jour)
cd /home/user/MakarimPMS/backend
npx prisma migrate status

# 4. Démarrer le backend (NestJS, watch mode)
npm run start:dev
# → écoute sur http://127.0.0.1:3000 (préfixe /api)

# 5. Dans un second terminal — démarrer le frontend (Vite)
cd /home/user/MakarimPMS/frontend
npm run dev -- --host 127.0.0.1
# → écoute sur http://127.0.0.1:5173
```

## URLs locales utiles

| Service | URL |
|---|---|
| Frontend (React/Vite) | http://127.0.0.1:5173 |
| Backend API (préfixe global `/api`) | http://127.0.0.1:3000/api |
| Documentation Swagger (hors production uniquement) | http://127.0.0.1:3000/api/docs |
| Healthcheck rapide (route publique) | http://127.0.0.1:3000/api/auth/roles-actifs |

## Comptes de connexion (seed, `backend/prisma/seed.ts`)

Mot de passe commun : `Password123!`

| Rôle | Email |
|---|---|
| Administrateur | `admin@makarim.test` |
| Réception | `reception@makarim.test` |
| Gouvernante | `gouvernante@makarim.test` |
| Comptable | `comptable@makarim.test` |
| Maintenance | `maintenance@makarim.test` |
| RH | `rh@makarim.test` |

*(Liste reprise de `CLAUDE.md` — connexion Administrateur vérifiée en direct dans cette session, les 5 autres comptes n'ont pas été testés individuellement mais suivent le même mécanisme d'authentification déjà confirmé fonctionnel.)*

## Vérification effectuée dans cette session

```
$ curl -s -X POST http://127.0.0.1:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@makarim.test","motDePasse":"Password123!"}'
→ HTTP 201, { accessToken, refreshToken } reçus normalement
```

Frontend et backend répondent tous deux HTTP 200 sur leurs URLs racine respectives.

## Blocages rencontrés et comment ils ont été résolus

- **Docker indisponible** dans cet environnement (`/var/run/docker.sock` absent) → contournement : MySQL et Redis lancés nativement (binaires déjà présents sur l'image), sans passer par `docker-compose.yml`. **Ce contournement est spécifique à cet environnement de session** — sur un poste de développement standard avec Docker fonctionnel, `docker compose up -d` (voir `docker-compose.yml` à la racine) reste la méthode documentée par le projet et probablement préférable pour un usage prolongé (isolation, reproductibilité).
- Aucun autre blocage — l'environnement était déjà entièrement configuré par les sessions de travail précédentes (dépendances, `.env`, migrations, seed).

## Ce que ce document ne couvre pas

Le déploiement en production (VPS Hostinger, Docker Compose + Nginx + Certbot) est couvert par `docs/deploiement-vps` (skill dédiée) et `docs/execution/GO_LIVE_CHECKLIST.md` — sans rapport avec cet environnement de développement local.

## Suivi visuel du rendu frontend pendant le développement

Le frontend tourne en mode `vite dev` avec hot-module-reload — toute modification de fichier sous `frontend/src/` se reflète immédiatement sur `http://127.0.0.1:5173` sans redémarrage manuel. C'est la configuration recommandée pour le suivi visuel continu demandé (Phase E, `docs/frontend-plan/PLAN_DEVELOPPEMENT_FRONTEND.md` §5).
