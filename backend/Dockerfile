# syntax=docker/dockerfile:1
#
# API de Luminance (NestJS + Prisma) — imagen de producción multistage.
#
#   docker build -t luminance-api backend/                        → API (target por defecto)
#   docker build -t luminance-migrate --target migrate backend/    → migraciones
#
#   docker run --rm --env-file backend/.env luminance-migrate      → prisma migrate deploy
#   docker run --rm -p 3000:3000 --env-file backend/.env luminance-api
#
# La imagen de la API no incluye el CLI de Prisma (más de 200 MB que solo sirven para
# migrar): las migraciones corren con la imagen `migrate` antes de cada deploy
# (ver docs/DEPLOY.md).

ARG NODE_IMAGE=node:24.13.0-alpine3.22

# ---- 1. Dependencias completas (para compilar y migrar) -------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# El postinstall genera el cliente de Prisma en src/generated.
RUN npm ci --no-audit --no-fund

# ---- 2. Compilación ------------------------------------------------------------
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- 3. Dependencias de producción ----------------------------------------------
# El cliente de Prisma ya está compilado en dist/generated: no hace falta ningún script.
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
# --omit=optional/peer: @prisma/client declara como peers opcionales al CLI de Prisma y a
# TypeScript (+200 MB que no se usan en runtime; lo que la app necesita es dependencia directa).
RUN npm ci --omit=dev --omit=optional --omit=peer --ignore-scripts --no-audit --no-fund && npm cache clean --force

# ---- 4. Migraciones (job previo al deploy) --------------------------------------
FROM deps AS migrate
ENV NODE_ENV=production
# Diagnóstico solo lectura previo al baseline: `docker run … luminance-migrate npm run db:diagnose`.
COPY tsconfig.json ./
COPY scripts ./scripts
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# ---- 5. API (target por defecto) ------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

# Sin privilegios de root.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1
CMD ["node", "dist/main"]
