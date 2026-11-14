#!/usr/bin/env bash
# Setup script for CI - installs dependencies and creates symlinks for devDependencies

set -euo pipefail

echo "Installing dependencies with pnpm..."
pnpm install --frozen-lockfile --shamefully-hoist

echo "Creating symlinks for devDependencies in node_modules/.bin..."
# Ensure node_modules/.bin exists
mkdir -p node_modules/.bin

# List of devDependencies that need to be linked
DEV_DEPS=(
  "prettier"
  "eslint"
  "markdownlint"
  "yamllint"
  "vitest"
  "commitlint"
  "astro"
  "playwright"
  "@astrojs/check"
  "typescript"
  "jsonlint"
  "lefthook"
)

for dep in "${DEV_DEPS[@]}"; do
  # Find the binary in the pnpm virtual store
  BIN_PATH=$(find node_modules/.pnpm -name "$dep" -type f -path "*/bin/*" 2>/dev/null | head -1)
  if [ -n "$BIN_PATH" ]; then
    ln -sf "$BIN_PATH" "node_modules/.bin/$dep"
    echo "Linked $dep -> $BIN_PATH"
  else
    echo "Warning: Could not find binary for $dep"
  fi
done

echo "Setup complete!"