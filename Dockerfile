# syntax=docker/dockerfile:1
#
# Multi-stage build for an Express + Vite React app. Targets Google Cloud Run.
#
# Key constraints honored here:
#  - server.ts does `import { createServer as createViteServer } from "vite"`
#    at the TOP LEVEL, unconditionally, even though it's only called in dev.
#    The `vite` package must therefore exist in node_modules at runtime too --
#    it's listed under "dependencies" in package.json for exactly this reason,
#    so a plain `npm ci --omit=dev` in the runner stage still installs it.
#  - server.ts runs directly via `node --experimental-strip-types` (no bundling),
#    so server.ts and server/ are copied into the runner as source, not built.
#  - Cloud Run injects PORT; server.ts reads process.env.PORT (falls back to
#    3000 for local `npm run dev`/`npm start`). Never hardcode PORT here.
#  - firebase-applet-config.json is imported as a static JSON import by
#    src/firebase.ts, so it must be present at BUILD time (vite build inlines it).

ARG NODE_VERSION=22-alpine

# ---------------------------------------------------------------------------
# Stage 1: deps -- full dependency tree (incl. devDeps: vite, typescript, tailwind
# live there and are needed for `npm run build`).
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2: builder -- vite build the client bundle into dist/.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: runner -- production deps only + built client assets + server source.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY server.ts ./server.ts
COPY server ./server

RUN chown -R node:node /app
USER node

# Documentation only; Cloud Run routes to $PORT regardless of EXPOSE.
EXPOSE 8080

CMD ["node", "--experimental-strip-types", "server.ts"]
