#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  echo "Missing .env. Copy env.example to .env and fill values." >&2
  exit 1
fi
set -a; . ./.env; set +a

STACKS=(core apps monitoring)
for s in "${STACKS[@]}"; do
  echo "==> Deploying $s"
  docker stack deploy --resolve-image never --compose-file "$s/docker-compose.yml" "$s"
done
echo "All stacks deployed."
