#!/bin/bash
set -e
echo "=== QIROX Build Start ==="
rm -rf node_modules
npm install --ignore-scripts
node scripts/patch-esbuild.cjs
npm run build
echo "=== QIROX Build Complete ==="
