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

# Install dependencies. Install scripts are skipped because better-sqlite3
# (only used by the scripts workspace) cannot compile on Alpine without Python.
RUN npm ci --ignore-scripts && npm run postinstall

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

# connect-src stays open because the app connects to any server the user adds.
RUN cat <<'EOF' > /etc/nginx/security-headers.conf
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src * data: blob:; media-src * data: blob:; font-src 'self' data:; connect-src 'self' http: https: ws: wss: data: blob:; worker-src 'self' blob:; frame-src 'self' blob: https://accounts.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
EOF

RUN cat <<'EOF' > /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    include /etc/nginx/security-headers.conf;

    location = /servers.json {
        include /etc/nginx/security-headers.conf;
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
