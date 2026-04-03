#!/bin/bash
# PostToolUse hook - logs all file changes with timestamps
# Appends to .claude/logs/file-changes.log

INPUT=$(cat -)
TOOL_NAME=$(echo "$INPUT" | sed -n 's/.*"tool_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
TOOL_NAME=${TOOL_NAME:-unknown}
FILE_PATH=$(echo "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

LOG_DIR=".claude/logs"
LOG_FILE="$LOG_DIR/file-changes.log"

mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
echo "[$TIMESTAMP] $TOOL_NAME: $FILE_PATH" >> "$LOG_FILE"

exit 0
