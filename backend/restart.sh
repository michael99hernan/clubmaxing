#!/bin/bash
# Kills whatever is currently listening on port 8080, then starts a fresh
# `go run .` — use this instead of manually Ctrl+C-ing and re-running
# every time you change a .go file.

PIDS=$(lsof -ti:8080)

if [ -n "$PIDS" ]; then
    echo "Killing existing process(es) on :8080 (PID(s): $PIDS)"
    kill -9 $PIDS
fi

go run .
