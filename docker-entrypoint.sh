#!/bin/sh
# Volume recém-criado (ou criado por outro usuário) pode ficar como root e o app,
# que roda como "node", não consegue gravar o fleet.db. Corrige o dono e troca de usuário.
set -e
DATA_DIR="${DATA_DIR:-/app/data}"
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR"
  exec su-exec node "$@"
fi
exec "$@"
