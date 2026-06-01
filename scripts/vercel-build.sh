#!/bin/bash
set -e
npm run build
cp -r public/. dist/public/ 2>/dev/null || true
cp -r attached_assets dist/public/attached_assets 2>/dev/null || true
node_modules/.bin/esbuild server/vercel-entry.ts \
  --bundle \
  --packages=external \
  --platform=node \
  --format=cjs \
  --outfile=api/index.js \
  --tsconfig=tsconfig.json \
  --external:bufferutil \
  --external:utf-8-validate \
  --external:fsevents \
  --external:@google-cloud/storage \
  --alias:@shared=./shared \
  --alias:@=./client/src
