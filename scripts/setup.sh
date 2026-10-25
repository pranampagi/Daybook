#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f .env ]]; then
  printf '.env already exists; leaving it unchanged.\n'
  exit 0
fi
umask 077
jwt_secret="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
database_password="$(python3 -c 'import secrets; print(secrets.token_hex(24))')"
sed \
  -e "s/replace-with-a-random-secret-at-least-32-characters/$jwt_secret/" \
  -e "s/replace-with-a-random-password/$database_password/" \
  .env.example > .env
printf 'Created .env with random secrets. Start with: docker compose up --build -d\n'
