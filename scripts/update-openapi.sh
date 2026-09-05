#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/sonarr-openapi.json}"
SPEC_URL="${SONARR_SPEC_URL:-https://raw.githubusercontent.com/Sonarr/Sonarr/develop/src/Sonarr.Api.V3/openapi.json}"

curl -fsSL "$SPEC_URL" -o "$OUT"

echo "Wrote $OUT (version $(node -p "require('$OUT').info.version"))"
