# Self-hosting image (Render, Railway, Fly.io, a VPS…). Vercel does not need this.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node scripts/copy-pdf-worker.mjs && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# File storage lives here; mount a volume at /app/.data to keep it between deploys.
RUN mkdir -p .data && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "server.js"]
