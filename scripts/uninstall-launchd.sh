#!/bin/bash
set -euo pipefail

label="com.jiranon.isekai-office"
launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$label.plist"
echo "isekai-office stopped"
