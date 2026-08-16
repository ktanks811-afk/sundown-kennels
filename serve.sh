#!/usr/bin/env bash
# Run this to play locally. The game's source is split across several files
# that Babel compiles in the browser, so it has to be served over http://
# rather than opened straight off disk.

cd "$(dirname "$0")" || exit 1

PORT=8000

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo
  echo "Python was not found on this machine."
  echo "Install it from https://python.org, or serve this folder with any"
  echo "other static server, e.g.:  npx serve ."
  echo
  exit 1
fi

echo
echo "  Sundown Kennels  --  http://localhost:$PORT"
echo "  Press Ctrl+C to stop."
echo

# Open the browser once the server has had a moment to bind.
( sleep 2
  if command -v open >/dev/null 2>&1; then open "http://localhost:$PORT"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:$PORT"
  fi ) &

exec "$PY" -m http.server "$PORT"
