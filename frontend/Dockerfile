# syntax=docker/dockerfile:1

# ---- build ----
FROM node:20-alpine AS build
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
