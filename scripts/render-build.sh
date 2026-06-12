#!/bin/bash
echo "=== Step 1: Install packages (may report errors - that is OK) ==="
npm install --ignore-scripts --omit=optional 2>&1 || true

echo "=== Step 2: Ensure vite is installed ==="
if [ ! -f "node_modules/vite/bin/vite.js" ]; then
  echo "Vite missing — installing separately..."
  npm install vite --no-save --ignore-scripts 2>&1 || true
fi

echo "=== Step 3: Ensure esbuild is installed ==="
if [ ! -f "node_modules/esbuild/bin/esbuild" ]; then
  echo "esbuild missing — installing separately..."
  npm install esbuild --no-save --ignore-scripts 2>&1 || true
fi

echo "=== Step 4: Patch esbuild ==="
node scripts/patch-esbuild.cjs

echo "=== Step 5: Build frontend ==="
node node_modules/vite/bin/vite.js build

echo "=== Step 6: Build server ==="
node node_modules/esbuild/bin/esbuild server/index.ts \
  --platform=node --bundle --format=esm --minify \
  --external:vite --external:sharp --external:@vladmandic/face-api \
  --external:face-api.js --external:bufferutil --external:utf-8-validate \
  --external:@babel/preset-typescript --external:lightningcss \
  "--banner:js=import{createRequire}from'module';import{fileURLToPath}from'url';import{dirname as _dn}from'path';const require=createRequire(import.meta.url);const __filename=fileURLToPath(import.meta.url);const __dirname=_dn(__filename);" \
  --outfile=dist/index.js

echo "=== Build complete! ==="
