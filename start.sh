#!/usr/bin/env bash
# ConversionScan lokal starten. Doppelklick im Finder oder: ./start.sh
cd "$(dirname "$0")"
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; nvm use --lts --silent 2>/dev/null
# Eigene Anthropic-/Browser-Keys aus .env.local nutzen (nicht aus der Umgebung):
exec env -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL -u ANTHROPIC_AUTH_TOKEN -u ANTHROPIC_CUSTOM_HEADERS \
  npm run dev
