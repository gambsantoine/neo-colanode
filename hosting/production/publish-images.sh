#!/usr/bin/env bash
#
# Builds the server and web images from the current commit and pushes them.
#
#   docker login ghcr.io -u gambsantoine
#   hosting/production/publish-images.sh 1.0.0
#
# Tags pushed: <version> and latest.
#
# Optional variables:
#   COLANODE_REGISTRY  target registry (default: ghcr.io/gambsantoine)
#   PLATFORMS          target platforms (default: linux/amd64)
#
# Builds from a clean export of HEAD: the repository has no .dockerignore, so
# building from the working tree would copy local files such as
# apps/server/.env into the published image.

set -euo pipefail

version="${1:-}"
registry="${COLANODE_REGISTRY:-ghcr.io/gambsantoine}"
platforms="${PLATFORMS:-linux/amd64}"

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: $0 <version>   (e.g. $0 1.0.0)" >&2
  exit 1
fi

cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Warning: uncommitted changes will not be included in the images." >&2
fi

sha="$(git rev-parse HEAD)"
context="$(mktemp -d)"
trap 'rm -rf "$context"' EXIT

git archive HEAD | tar -x -C "$context"

cat > "$context/packages/core/src/types/build.ts" <<EOF
const VERSION = '$version';
const SHA = '$sha';

export const build = {
  version: VERSION,
  sha: SHA,
};
EOF

for app in server web; do
  image="$registry/colanode-$app"
  echo "==> Building $image:$version ($platforms)"
  docker buildx build \
    --file "$context/apps/$app/Dockerfile" \
    --platform "$platforms" \
    --tag "$image:$version" \
    --tag "$image:latest" \
    --push \
    "$context"
done

echo "==> Published $version (commit $sha)"
