# syntax=docker/dockerfile:1

# ---- build ----
# node:22-alpine : aligné sur .github/workflows/ci.yml (node-version: 22,
# tous jobs) — sans lien de cause avec le bug ci-dessous (npm ci échouait
# aussi sous Node 22 avant ce correctif), gardé par cohérence d'environnement.
FROM node:22-alpine AS build
WORKDIR /app
# .npmrc DOIT être copié avant `npm ci` : legacy-peer-deps=true y est défini
# spécifiquement pour tolérer un conflit de peer dependency réel et déjà
# assumé (eslint@10 / eslint-plugin-jsx-a11y@6.10.2, voir le commentaire
# dans .npmrc) — sans ce fichier, npm ci échoue en ERESOLVE à l'intérieur du
# conteneur alors que le job frontend de la CI (checkout complet du dépôt,
# .npmrc présent dès le départ) ne rencontre jamais l'erreur. Bug réel
# détecté au premier déclenchement effectif de deploy.yml (jamais exécuté
# avant CH-058, faute de CI verte) — mon premier correctif (Node 20→22)
# n'était qu'une coïncidence de timing, pas la cause réelle.
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
# VITE_API_URL est une variable Vite résolue au build (import.meta.env),
# jamais lisible au runtime du conteneur nginx qui ne sert que du HTML/JS
# statique — sans cet ARG, le pipeline de déploiement (.github/workflows/deploy.yml)
# construirait silencieusement une image pointant vers le fallback de dev
# (http://localhost:3000/api, voir lib/api-client.ts) en production.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- production ----
FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:80/ || exit 1
