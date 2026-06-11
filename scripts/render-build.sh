#!/bin/bash
set -e

echo "=== Step 1: Install packages ==="
npm install --ignore-scripts

echo "=== Step 2: Fix esbuild binary ==="
# Force-install the correct esbuild version that vite needs
./node_modules/.bin/esbuild --version 2>/dev/null || true

# Manually copy the global esbuild binary as a fallback for vite's nested esbuild
VITE_ESBUILD_DIR="node_modules/vite/node_modules/@esbuild/linux-x64/bin"
VITE_ESBUILD_BIN="node_modules/vite/node_modules/esbuild/bin/esbuild"

if [ -d "node_modules/vite/node_modules" ]; then
  # Download esbuild 0.21.5 directly
  mkdir -p "$VITE_ESBUILD_DIR"
  curl -sL https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-0.21.5.tgz | tar -xz -C /tmp
  cp /tmp/package/bin/esbuild "$VITE_ESBUILD_DIR/esbuild"
  chmod +x "$VITE_ESBUILD_DIR/esbuild"
  
  mkdir -p "$(dirname $VITE_ESBUILD_BIN)"
  cp /tmp/package/bin/esbuild "$VITE_ESBUILD_BIN"
  chmod +x "$VITE_ESBUILD_BIN"
  
  # Fix package.json version
  PKG="node_modules/vite/node_modules/@esbuild/linux-x64/package.json"
  if [ -f "$PKG" ]; then
    node -e "const p=JSON.parse(require('fs').readFileSync('$PKG','utf8')); p.version='0.21.5'; require('fs').writeFileSync('$PKG',JSON.stringify(p,null,2));"
  fi
  echo "esbuild 0.21.5 installed for vite"
fi

echo "=== Step 3: Build frontend ==="
./node_modules/.bin/vite build

echo "=== Step 4: Bundle server ==="
./node_modules/.bin/esbuild server/index.ts \
  --platform=node \
  --bundle \
  --format=esm \
  --minify \
  --external:vite \
  --external:sharp \
  --external:@vladmandic/face-api \
  --external:face-api.js \
  --external:bufferutil \
  --external:utf-8-validate \
  --external:@babel/preset-typescript \
  --external:lightningcss \
  "--banner:js=import{createRequire}from'module';import{fileURLToPath}from'url';import{dirname as _dn}from'path';const require=createRequire(import.meta.url);const __filename=fileURLToPath(import.meta.url);const __dirname=_dn(__filename);" \
  --outfile=dist/index.js

echo "=== Build Complete ==="
