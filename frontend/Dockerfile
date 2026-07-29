# syntax=docker/dockerfile:1

# ---- build ----
# node:22-alpine (pas 20) : doit matcher exactement la version Node de
# .github/workflows/ci.yml (node-version: 22, tous jobs) — npm ci sous
# Node 20 échoue en ERESOLVE sur eslint@10/eslint-plugin-jsx-a11y (résolution
# de peer dependencies différente entre les versions de npm embarquées),
# alors que le job frontend de la CI (Node 22) installe les mêmes
# package.json/package-lock.json sans erreur. Bug resté invisible tant que
# deploy.yml ne s'était jamais réellement déclenché (CI historiquement
# toujours rouge avant CH-058) — découvert au premier run réel du pipeline.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
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
