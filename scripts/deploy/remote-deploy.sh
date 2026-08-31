#!/usr/bin/env bash
set -euo pipefail

RELEASE_PATH="${1:?release path is required}"
DEPLOY_PATH="${2:?deploy path is required}"
SERVICE_NAME="${3:?service name is required}"
ENV_FILE=/etc/bora-bilgic-teknik-store/api.env

cd "$RELEASE_PATH"

set -a
source "$ENV_FILE"
set +a

npm ci
npm run prisma:generate
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

ln -sfn "$RELEASE_PATH" "$DEPLOY_PATH/current"
sudo systemctl restart "$SERVICE_NAME"

find "$DEPLOY_PATH/releases" -mindepth 1 -maxdepth 1 -type d | sort -r | tail -n +4 | xargs -r rm -rf
