FROM node:22.14.0-bookworm-slim AS dependencies

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci --workspace=@automotive-search/api --include-workspace-root

FROM dependencies AS build

COPY apps/api apps/api
COPY database/migrations database/migrations
COPY database/seeds database/seeds

RUN npm run build --workspace=@automotive-search/api \
    && npm prune --omit=dev --workspace=@automotive-search/api --include-workspace-root

FROM node:22.14.0-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV API_PORT=3000

WORKDIR /workspace

COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /workspace/database/migrations ./database/migrations
COPY --from=build --chown=node:node /workspace/database/seeds ./database/seeds

USER node

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
