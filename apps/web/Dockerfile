FROM node:22-alpine AS build

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./

# Copy scripts
COPY ../../scripts scripts

# Copy assets
COPY ../../assets assets

# Copy all package.json files first
COPY ../../packages/core/package.json packages/core/package.json
COPY ../../packages/crdt/package.json packages/crdt/package.json
COPY ../../packages/client/package.json packages/client/package.json
COPY ../../packages/ui/package.json packages/ui/package.json
COPY ../../apps/web/package.json apps/web/package.json

# Install dependencies
RUN npm ci

# Copy source files
COPY ../../packages/core packages/core
COPY ../../packages/crdt packages/crdt
COPY ../../packages/client packages/client
COPY ../../packages/ui packages/ui
COPY ../../apps/web apps/web
COPY ../../tsconfig.base.json ./

# Build packages
RUN npm run build -w @colanode/core && \
    npm run build -w @colanode/crdt && \
    npm run build -w @colanode/client && \
    npm run build -w @colanode/ui && \
    npm run build -w @colanode/web && \
    npm prune --production


FROM nginx:1.27-alpine

COPY --from=build /app/apps/web/dist /usr/share/nginx/html

RUN cat <<'EOF' > /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location = /servers.json {
        add_header Cache-Control "no-store";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Generate servers.json at container start from COLANODE_SERVER_URL
# (comma-separated list of server config URLs, e.g. https://api.example.com/config).
RUN cat <<'EOF' > /docker-entrypoint.d/40-colanode-servers.sh
#!/bin/sh
set -eu
out=/usr/share/nginx/html/servers.json
list=""
IFS=','
for url in ${COLANODE_SERVER_URL:-}; do
    url=$(echo "$url" | tr -d ' ')
    [ -z "$url" ] && continue
    list="${list:+$list,}\"$url\""
done
printf '{"servers":[%s]}\n' "$list" > "$out"
echo "colanode: default servers -> $(cat "$out")"
EOF
RUN chmod +x /docker-entrypoint.d/40-colanode-servers.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
