FROM node:22-alpine

# Lets the entrypoint drop root privileges
RUN apk add --no-cache su-exec

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./

# Copy scripts
COPY ../../scripts scripts

# Copy all package.json files first
COPY ../../packages/core/package.json packages/core/package.json
COPY ../../packages/api/package.json packages/api/package.json
COPY ../../packages/crdt/package.json packages/crdt/package.json
COPY ../../apps/server/package.json apps/server/package.json

# Install dependencies
RUN npm ci

# Copy source files
COPY ../../packages/core packages/core
COPY ../../packages/api packages/api
COPY ../../packages/crdt packages/crdt
COPY ../../apps/server apps/server
COPY ../../tsconfig.base.json ./

# Build packages
RUN npm run build -w @colanode/core && \
    npm run build -w @colanode/api && \
    npm run build -w @colanode/crdt && \
    npm run build -w @colanode/server && \
    npm prune --production

# Default locations of the file storage, writable by the runtime user
RUN mkdir -p /var/lib/colanode/storage /app/data && \
    chown node:node /var/lib/colanode/storage /app/data

ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["sh", "/app/apps/server/docker-entrypoint.sh"]
CMD ["node", "apps/server/dist/index.js"]
