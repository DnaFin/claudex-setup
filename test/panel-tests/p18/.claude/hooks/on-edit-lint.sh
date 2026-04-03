#!/bin/bash
# PostToolUse hook - runs linter after file edits
# Detects which linter is available and runs it

if command -v npx &>/dev/null; then
  if [ -f "package.json" ] && grep -q '"lint"' package.json 2>/dev/null; then
    npm run lint --silent 2>/dev/null
  elif [ -f ".eslintrc" ] || [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f "eslint.config.js" ]; then
    npx eslint --fix . --quiet 2>/dev/null
  fi
elif command -v ruff &>/dev/null; then
  ruff check --fix . 2>/dev/null
fi
