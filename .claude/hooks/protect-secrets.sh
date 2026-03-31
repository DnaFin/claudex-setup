#!/bin/bash
# PreToolUse hook - blocks reads of secret files
INPUT=$(cat -)
FILE_PATH=$(echo "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

if echo "$FILE_PATH" | grep -qiE '\.env$|\.env\.|secrets/|credentials|\.pem$|\.key$'; then
  echo '{"decision": "block", "reason": "Blocked: accessing secret/credential files is not allowed."}'
  exit 0
fi
echo '{"decision": "allow"}'
