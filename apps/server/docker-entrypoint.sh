#!/bin/sh
set -eu

# Runs the server as the unprivileged `node` user. Volumes created by earlier
# images belong to root, so they are handed over first. A storage directory
# outside of the defaults is declared with COLANODE_STORAGE_DIR.
if [ "$(id -u)" = "0" ]; then
  node_uid="$(id -u node)"

  for dir in "${COLANODE_STORAGE_DIR:-/var/lib/colanode/storage}" /app/data; do
    if [ -d "$dir" ] && [ "$(stat -c %u "$dir")" != "$node_uid" ]; then
      chown -R node:node "$dir"
    fi
  done

  exec su-exec node "$@"
fi

exec "$@"
