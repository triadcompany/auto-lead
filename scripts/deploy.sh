#!/bin/bash
# Deploy script — builds and pushes to Easypanel VPS via git
# Run from the repo root.
set -e

echo "==> Building TypeScript..."
npm run build --prefix api

echo "==> Build successful. Committing..."
git add -A
git commit -m "chore: production build $(date +%Y-%m-%d)" --allow-empty

echo "==> Pushing to origin..."
git push origin main

echo ""
echo "Deploy triggered. Easypanel will pull and rebuild automatically."
echo "Monitor progress in the Easypanel dashboard."
