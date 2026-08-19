#!/bin/zsh
set -eu

SCRIPT_DIR="${0:A:h}"
APP_PATH="/Applications/ChatGPT.app"
PORT="${CHATGPT_THEME_PORT:-${CODEX_THEME_PORT:-9229}}"

if [[ ! -d "$APP_PATH" ]]; then
  print -u2 "ChatGPT.app was not found in /Applications."
  exit 1
fi

if pgrep -f "$APP_PATH/Contents/MacOS/ChatGPT" >/dev/null 2>&1; then
  print -u2 "ChatGPT is already running. Quit it completely (Cmd+Q), then run this file again."
  exit 2
fi

if [[ ! -f "$SCRIPT_DIR/assets/wallpaper.jpg" ]]; then
  print -u2 "Missing wallpaper: $SCRIPT_DIR/assets/wallpaper.jpg"
  print -u2 "Copy a JPG there, or edit this launcher to pass another image path."
  exit 3
fi

CHATGPT_THEME_PORT="$PORT" node "$SCRIPT_DIR/src/injector.mjs" "$SCRIPT_DIR/src/theme.css" "$SCRIPT_DIR/assets/wallpaper.jpg" &
INJECTOR_PID=$!
trap 'kill "$INJECTOR_PID" 2>/dev/null || true' EXIT INT TERM

open -na "$APP_PATH" --args --remote-debugging-port="$PORT"

PORT_READY=0
for ATTEMPT in {1..20}; do
  if curl -fsS --max-time 1 "http://127.0.0.1:$PORT/json" >/dev/null 2>&1; then
    PORT_READY=1
    break
  fi
  sleep 1
done

if [[ "$PORT_READY" -ne 1 ]]; then
  print -u2 "ChatGPT did not open its theme port."
  print -u2 "Make sure every existing ChatGPT window is closed with Cmd+Q, then run this file again."
  exit 4
fi

print "Theme connection ready. Keep this window open while using ChatGPT."
wait "$INJECTOR_PID"
