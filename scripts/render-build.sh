#!/bin/bash
set -e

echo "=== Switching to npm v9 (fixes Exit handler bug) ==="
npm install -g npm@9 --quiet 2>&1 | tail -3

echo "=== Installing all dependencies ==="
npm install --ignore-scripts --omit=optional

echo "=== Patching esbuild ==="
node scripts/patch-esbuild.cjs

echo "=== Building frontend ==="
node node_modules/vite/bin/vite.js build

echo "=== Building server ==="
node node_modules/esbuild/bin/esbuild server/index.ts \
  --platform=node --bundle --format=esm --minify \
  --external:vite --external:sharp --external:@vladmandic/face-api \
  --external:face-api.js --external:bufferutil --external:utf-8-validate \
  --external:@babel/preset-typescript --external:lightningcss \
  "--banner:js=import{createRequire}from'module';import{fileURLToPath}from'url';import{dirname as _dn}from'path';const require=createRequire(import.meta.url);const __filename=fileURLToPath(import.meta.url);const __dirname=_dn(__filename);" \
  --outfile=dist/index.js

echo "=== SUCCESS ==="
