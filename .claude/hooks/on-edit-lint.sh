#!/bin/bash
# PostToolUse hook - auto-check after file edits
# Customize the linter command for your project
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
echo "[$TIMESTAMP] File changed: $(cat -)" >> .claude/logs/changes.txt
