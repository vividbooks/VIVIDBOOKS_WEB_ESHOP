#!/usr/bin/env bash
# Vypíše ID štítků dealu z Pipedrive (GET /v1/dealFields).
# Použití z kořene repa:
#   export PIPEDRIVE_API_TOKEN='váš_token_z_Pipedrive'
#   ./scripts/fetch-pipedrive-label-ids.sh
# Nebo: načte PIPEDRIVE_API_TOKEN z souboru .env (pokud existuje).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${PIPEDRIVE_API_TOKEN:-}" ]]; then
  echo "Chybí PIPEDRIVE_API_TOKEN. Nastav ho nebo ho dej do .env v kořeni repa." >&2
  exit 1
fi

JSON="$(curl -fsS "https://api.pipedrive.com/v1/dealFields?limit=500&api_token=${PIPEDRIVE_API_TOKEN}")"

if command -v jq >/dev/null 2>&1; then
  echo "=== Systémové pole „label“ (štítky dealu) ==="
  echo "$JSON" | jq -r '
    .data[] | select(.key == "label")
    | "field_key: \(.key)\nfield_name: \(.name)\nfield_type: \(.field_type // .type // "n/a")\n",
      (.options // [] | sort_by(.id)[] | "  id=\(.id)\t\(.label)")
  '
else
  echo "Nainstaluj jq (brew install jq) pro hezký výpis; nebo ulož výstup do souboru a hledej \"key\":\"label\"."
  echo "$JSON" > /tmp/pipedrive-dealFields.json
  echo "Raw JSON: /tmp/pipedrive-dealFields.json"
fi
