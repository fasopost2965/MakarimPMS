# syntax=docker/dockerfile:1

# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL factice : uniquement nécessaire pour que `prisma generate`
# résolve la variable d'env référencée dans schema.prisma, pas pour se connecter.
ENV DATABASE_URL="mysql://user:password@localhost:3306/db"
RUN npx prisma generate
RUN npm run build

# ---- production ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

# TODO: pointer sur /api/health une fois le module core (5.1/5.2) livré
# (voir docs/plan-execution-claude-code.md §7.2 et skill deploiement-vps).
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api || exit 1

CMD ["node", "dist/main"]
