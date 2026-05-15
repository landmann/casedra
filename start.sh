#!/usr/bin/env bash
set -euo pipefail

SESSION="casedra"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v tmux >/dev/null 2>&1; then
  echo "tmux is not installed. Install it (e.g. 'brew install tmux') and try again." >&2
  exit 1
fi

if tmux has-session -t "$SESSION" 2>/dev/null; then
  exec tmux attach -t "$SESSION"
fi

tmux new-session -d -s "$SESSION" -c "$PROJECT_DIR" -n dev
tmux send-keys -t "$SESSION:dev.0" "pnpm convex dev" C-m

tmux split-window -h -t "$SESSION:dev" -c "$PROJECT_DIR"
tmux send-keys -t "$SESSION:dev.1" "pnpm dev --filter web" C-m

tmux select-pane -t "$SESSION:dev.0"
exec tmux attach -t "$SESSION"
