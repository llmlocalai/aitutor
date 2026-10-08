#!/bin/bash
# Installs a launchd job that runs the sync every 30 minutes on this Mac.
#   bash sync/install_schedule.sh            install or update
#   bash sync/install_schedule.sh remove     uninstall
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.aitutor.sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PY="$(command -v python3)"
ROOT="${AI_DATA_ROOT:-/Volumes/AI_DATA}"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
if [ "${1:-}" = "remove" ]; then rm -f "$PLIST"; echo "removed $LABEL"; exit 0; fi

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$PY</string><string>$REPO/sync/sync.py</string><string>--push</string><string>--machine</string></array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>AI_DATA_ROOT</key><string>$ROOT</string>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>StartInterval</key><integer>1800</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$REPO/sync/sync.log</string>
  <key>StandardErrorPath</key><string>$REPO/sync/sync.log</string>
</dict></plist>
PL
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "installed $LABEL. It runs every 30 minutes. Log: $REPO/sync/sync.log"
