#!/usr/bin/env bash
set -euo pipefail

RELEASE_PATH="${1:?release path is required}"
DEPLOY_PATH="${2:?deploy path is required}"
SERVICE_NAME="${3:?service name is required}"
ENV_FILE=/etc/bora-bilgic-teknik-store/api.env

cd "$RELEASE_PATH"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "Deploy env file is not readable by $(whoami): $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

npm ci
npm run prisma:generate
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

ln -sfn "$RELEASE_PATH" "$DEPLOY_PATH/current"
sudo -n systemctl restart "$SERVICE_NAME"

current_release="$(readlink -f "$DEPLOY_PATH/current")"
find "$DEPLOY_PATH/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' |
  sort -rn |
  awk -v current="$current_release" 'NR > 3 && $2 != current { print $2 }' |
  xargs -r rm -rf
