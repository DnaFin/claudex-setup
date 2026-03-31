#!/bin/bash
# SessionStart hook - prepares logs and records session entry

LOG_DIR=".claude/logs"
LOG_FILE="$LOG_DIR/sessions.log"

mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
echo "[$TIMESTAMP] session started" >> "$LOG_FILE"

exit 0
