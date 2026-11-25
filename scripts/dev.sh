#!/bin/bash
set -uo pipefail

project="$(cd "$(dirname "$0")/.." && pwd)"
label="com.jiranon.isekai-office"
target="$HOME/Library/LaunchAgents/$label.plist"
domain="gui/$(id -u)"
server_pid=""
vite_pid=""

stop_process() {
  [ -n "$1" ] || return 0
  kill "$1" 2>/dev/null
  wait "$1" 2>/dev/null
}

restore_service() {
  trap - EXIT INT TERM
  stop_process "$vite_pid"
  stop_process "$server_pid"
  bun --cwd="$project" run build
  launchctl bootout "$domain/$label" 2>/dev/null
  launchctl bootstrap "$domain" "$target"
  launchctl kickstart -k "$domain/$label"
  echo "isekai-office service is back on http://localhost:4300"
  exit 0
}

trap restore_service EXIT INT TERM

launchctl bootout "$domain/$label" 2>/dev/null

cd "$project" || exit 1
PORT=4302 PUBLIC_PORT=4300 bun --watch server/main.ts --dev &
server_pid=$!

SERVER_PORT=4302 bun --bun "$project/node_modules/.bin/vite" &
vite_pid=$!

wait "$vite_pid"
