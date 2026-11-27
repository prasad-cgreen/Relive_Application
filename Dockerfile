# syntax=docker/dockerfile:1
#
# Relive: one Dockerfile, three images. Build from the repository root.
#
#   docker build --target backend  -t relive-api .
#   docker build --target frontend -t relive-web \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 \
#     --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key> .
#   docker build --target migrate  -t relive-migrate .
#
# Or use docker-compose.yml, which builds and runs all three. Secrets are never baked into an image:
# .env files are excluded by .dockerignore and passed at run time instead.

ARG NODE_IMAGE=node:22-bookworm-slim

# ---------------------------------------------------------------- backend ----

FROM ${NODE_IMAGE} AS backend-build
# openssl: Prisma's migration engine needs it.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Manifests first, so dependency layers are cached until a package.json or the lockfile changes.
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY shared/package.json shared/
COPY frontend/package.json frontend/
RUN npm ci -w backend -w shared --no-audit --no-fund
COPY shared shared
COPY backend backend
RUN npm run build -w shared
# prisma generate only reads the schema; the URL just has to parse.
RUN cd backend \
 && DATABASE_URL_UNPOOLED=postgresql://build:build@localhost:5432/build npm run db:generate \
 && npm run build

# Production dependencies only (no Prisma CLI, TypeScript or test tools).
FROM ${NODE_IMAGE} AS backend-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY shared/package.json shared/
COPY frontend/package.json frontend/
RUN npm ci -w backend -w shared --omit=dev --no-audit --no-fund

# Runs pending database migrations (production + audit), then exits.
FROM backend-build AS migrate
WORKDIR /app/backend
USER node
CMD ["npm", "run", "db:migrate"]

FROM ${NODE_IMAGE} AS backend
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4100
WORKDIR /app
COPY --from=backend-deps /app/node_modules node_modules
COPY package.json ./
COPY shared/package.json shared/
COPY --from=backend-build /app/shared/dist shared/dist
COPY backend/package.json backend/
COPY --from=backend-build /app/backend/dist backend/dist
# The AI summary prompt is read from backend/prompts at run time.
COPY backend/prompts backend/prompts
# The API resolves prompts/ and .env relative to its working directory.
WORKDIR /app/backend
USER node
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/server.js"]

# ----------------------------------------------------------------- shared ----
# @relive/shared is a workspace package, not published to npm. The frontend imports it (e.g. the agents admin page)
# but is built standalone below, so it can't resolve the workspace symlink. This stage builds shared on its own (no
# Prisma or backend compile), and the frontend stage drops the result into its node_modules.
FROM ${NODE_IMAGE} AS shared-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w shared --no-audit --no-fund
COPY shared shared
RUN npm run build -w shared

# --------------------------------------------------------------- frontend ----

FROM ${NODE_IMAGE} AS frontend-build
WORKDIR /app/frontend
# The frontend has its own lockfile. Only frontend/ is copied, so npm treats it as a standalone project.
COPY frontend/package.json frontend/package-lock.json frontend/.npmrc ./
RUN npm ci --no-audit --no-fund
COPY frontend ./
# @relive/shared isn't on npm and this stage installed only frontend/, so place the package built in shared-build into
# node_modules, where Node and Vite resolve it. Its one dependency (zod) is already a frontend dependency.
COPY --from=shared-build /app/shared/package.json ./node_modules/@relive/shared/package.json
COPY --from=shared-build /app/shared/dist ./node_modules/@relive/shared/dist
# NEXT_PUBLIC_* values are compiled into the browser code, so they are build arguments, not run-time env.
ARG NEXT_PUBLIC_API_URL=http://localhost:4100/api/v1
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=
# Google Tag Manager container (public id) that carries Google Analytics. Blank = no tracking.
ARG NEXT_PUBLIC_GTM_ID=GTM-WSP875VS
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY} \
    NEXT_PUBLIC_GTM_ID=${NEXT_PUBLIC_GTM_ID}
RUN npm run build

FROM ${NODE_IMAGE} AS frontend
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app/frontend
# vinext's production server needs React and its own runtime at start-up, so the installed packages ship with it.
COPY --from=frontend-build /app/frontend/node_modules node_modules
COPY --from=frontend-build /app/frontend/dist dist
COPY frontend/package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# Plain Node server for the built app (listens on 0.0.0.0:$PORT); no Cloudflare runtime needed.
CMD ["node", "node_modules/vinext/dist/cli.js", "start"]
