#!/bin/bash
set -euo pipefail

project="$(cd "$(dirname "$0")/.." && pwd)"
label="com.jiranon.isekai-office"
target="$HOME/Library/LaunchAgents/$label.plist"

bun --cwd="$project" run build
cp "$project/scripts/launchd/$label.plist" "$target"
launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$target"
launchctl kickstart -k "gui/$(id -u)/$label"
echo "isekai-office runs at http://localhost:4300"
