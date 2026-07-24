# CH-026(e) — Configuration domaine/sous-domaine pour la production (VPS Hostinger)

**Statut : clarification demandée avant implémentation, prérequis à la note de conception.** Complète `docs/security/CH-026E_NOTE_CONCEPTION_COOKIES_HTTPONLY.md` §7, sur confirmation explicite de l'utilisateur (voir `REGISTRE_DECISIONS.md`, RD-022) : frontend et backend partageront le même domaine racine en production, avec des sous-domaines dédiés. Ce document ne modifie aucun fichier de code — c'est un prérequis documentaire, comme la note de conception elle-même.

## 1. Schéma retenu

| Composant | Sous-domaine (exemple) | Sert |
|---|---|---|
| Frontend (SPA statique) | `pms.mondomaine.ma` | `frontend/nginx.conf` (déjà en place — sert `dist/`, réécrit vers `index.html`) |
| Backend (API) | `api.mondomaine.ma` | NestJS, port interne 3000 |

Les deux sous-domaines partagent le même domaine enregistrable (`mondomaine.ma`) — c'est la seule exigence posée par `SameSite` pour les cookies (§2 ci-dessous), pas une exigence de même hôte ni de même port. Remplacer `mondomaine.ma` par le domaine réel choisi par l'utilisateur au moment de l'implémentation.

## 2. Pourquoi ce schéma suffit — et pourquoi le cookie ne doit *pas* être élargi au domaine racine

Le §2.1 de la note de conception explique que `SameSite` définit le « site » par domaine enregistrable (eTLD+1) : `pms.mondomaine.ma` et `api.mondomaine.ma` sont **same-site** l'un par rapport à l'autre (ils partagent `mondomaine.ma`), donc un cookie `SameSite=Lax` posé par `api.mondomaine.ma` part normalement sur les requêtes `fetch`/XHR initiées depuis une page chargée sur `pms.mondomaine.ma`.

**Conséquence pratique, précisée ici** : cela ne veut *pas* dire qu'il faut poser l'attribut `Domain=.mondomaine.ma` sur les cookies pour les « élargir » à tout le domaine racine. Au contraire :

- Seul `api.mondomaine.ma` lit et écrit ces cookies (`AuthCookieService`, `CsrfGuard`) — le frontend statique (`pms.mondomaine.ma`) n'y touche jamais directement, il ne fait que déclencher des requêtes `fetch(..., {credentials:'include'})` vers l'API, qui reçoit alors ses propres cookies normalement.
- Omettre l'attribut `Domain` (comportement par défaut) donne un cookie **host-only**, strictement scopé à `api.mondomaine.ma` — c'est déjà tout ce dont l'application a besoin.
- Poser explicitement `Domain=.mondomaine.ma` rendrait au contraire le cookie visible par **tout** sous-domaine futur de `mondomaine.ma` (un site vitrine, un blog, une autre application hébergée un jour sur un autre sous-domaine) — une exposition inutile, sans aucun bénéfice fonctionnel puisque rien d'autre que `api.mondomaine.ma` n'a besoin de le lire.

**Décision retenue** : `AuthCookieService.setAuthCookies()` (à implémenter, §4 de la note de conception) ne fixe **jamais** l'attribut `Domain` — cookies host-only par défaut, scopés exactement à `api.mondomaine.ma`. Ceci referme le point de vigilance laissé ouvert au §7 de la note de conception (risque lié à la portée eTLD+1 de `SameSite`) : la portée du cookie **lui-même** reste plus étroite que la portée `SameSite`, ce qui est la posture la plus sûre des deux.

## 3. Variables d'environnement (valeurs de production, une fois le domaine réel choisi)

| Variable | Composant | Valeur (exemple) |
|---|---|---|
| `FRONTEND_URL` | Backend (`main.ts`, `CorsOptionsDelegate` déjà en place) | `https://pms.mondomaine.ma` |
| `VITE_API_URL` | Frontend (build-time, `lib/api-client.ts`) | `https://api.mondomaine.ma/api` |

**Aucun changement de code requis sur `main.ts`** : le `CorsOptionsDelegate` existant (`origin: FRONTEND_URL, credentials: true` pour la surface privée) fonctionne déjà correctement pour deux sous-domaines distincts — c'est exactement le cas d'usage pour lequel CORS avec origine explicite + `credentials:true` existe. Seules les *valeurs* de ces deux variables changent entre le développement local (`localhost:5173`/`localhost:3000`, déjà same-site trivialement) et la production.

## 4. Infrastructure réseau nécessaire — écart à combler avant le premier déploiement sous domaine

**Constat** : `docker-compose.yml` actuel expose directement les ports des conteneurs sur l'hôte (`8081:80` pour le frontend, `3000:3000` pour le backend) — il n'existe aujourd'hui **aucune couche de routage par nom d'hôte** (`server_name`) sur le VPS. `frontend/nginx.conf` ne fait que servir le SPA *à l'intérieur* du conteneur frontend ; il ne route pas entre deux sous-domaines. C'est un écart d'infrastructure à combler, pas un simple changement de variable d'environnement.

**Ajout nécessaire** : un nginx **au niveau de l'hôte** (VPS, hors des conteneurs Docker Compose — ou un conteneur reverse-proxy dédié), qui termine le TLS (Certbot) et route par `server_name` vers les deux conteneurs existants :

```nginx
server {
    listen 443 ssl;
    server_name pms.mondomaine.ma;

    ssl_certificate     /etc/letsencrypt/live/mondomaine.ma/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mondomaine.ma/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
    }
}

server {
    listen 443 ssl;
    server_name api.mondomaine.ma;

    ssl_certificate     /etc/letsencrypt/live/mondomaine.ma/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mondomaine.ma/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name pms.mondomaine.ma api.mondomaine.ma;
    return 301 https://$host$request_uri;
}
```

- **Un seul certificat Certbot** couvrant les deux sous-domaines (`certbot --nginx -d pms.mondomaine.ma -d api.mondomaine.ma`, certificat SAN) plutôt que deux certificats séparés — un seul renouvellement à surveiller (`certbot renew`, déjà mentionné comme prérequis dans `CLAUDE.md`).
- **DNS** : deux enregistrements A (ou un `A` + un `CNAME`) pointant vers l'IP du VPS — `pms.mondomaine.ma` et `api.mondomaine.ma`.
- `X-Forwarded-Proto` transmis à NestJS : nécessaire pour que le backend sache que la connexion d'origine est bien en HTTPS derrière le proxy (pertinent pour l'attribut `Secure` des cookies — `Secure` regarde le protocole vu par le navigateur, pas par le conteneur backend, qui lui ne voit que du HTTP en interne ; NestJS n'a besoin de `X-Forwarded-Proto` que si une logique applicative future teste explicitement le protocole — pas le cas aujourd'hui pour la pose des cookies, qui se base sur `NODE_ENV`, pas sur le protocole de la requête entrante).

**Ce document ne modifie pas `docker-compose.yml`** — la configuration nginx ci-dessus est un artefact de référence à déployer sur le VPS au moment de la bascule vers le domaine réel (hors périmètre de ce chantier applicatif CH-026(e), qui porte sur le code backend/frontend, pas sur l'infrastructure réseau du VPS). Documenté ici pour que l'implémentation applicative (cookies `Secure`/`SameSite`) et l'infrastructure qui la rend possible (routage par domaine + TLS) soient explicitement mises en correspondance avant de coder.

## 5. Ce qui reste inchangé par ce schéma

- `CsrfGuard` (§2.2 de la note de conception) — logique entièrement auto-contenue sur `api.mondomaine.ma` (compare un en-tête à un cookie, tous deux lus sur la même requête), aucune interaction avec le sous-domaine frontend.
- Carve-out CORS F4/F6 (`/api/booking`, `/api/self-checkin`) — toujours `origin: true` réfléchie, `credentials: false`, aucun cookie en jeu, indépendant du schéma de sous-domaines.
- Développement local — `localhost:5173`/`localhost:3000`, déjà same-site (même nom d'hôte, ports différents), aucun changement nécessaire pour que les cookies fonctionnent en dev.

## 6. Écart de documentation constaté en passant (non traité ici)

`docs/operations/OPERATIONS_RUNBOOK.md` §1 décrit une architecture générique (Load Balancer cloud, Cloud Run, Cloud SQL) qui ne correspond pas au stack réel de ce projet (VPS Hostinger unique, Docker Compose, Nginx, Certbot — `CLAUDE.md`). Ce document (`CH-026E_DEPLOIEMENT_DOMAINE.md`) décrit le stack réel pour le seul besoin de CH-026(e) ; la mise à jour complète d'`OPERATIONS_RUNBOOK.md` reste hors périmètre de ce chantier — signalé ici pour traçabilité, pas corrigé.
