---
name: esbuild-vite-replit-fix
description: How to fix Vite 5 + esbuild version conflict in the Replit environment where the global esbuild binary is 0.28.0 but Vite 5 requires 0.21.5.
---

## The Problem
Replit's NixOS environment has esbuild 0.28.0 pre-installed globally. Vite 5 bundles and requires esbuild 0.21.5 internally. When npm runs install scripts, the esbuild 0.21.5 shim detects the 0.28.0 binary and fails. Even if install succeeds with `--ignore-scripts`, Vite's `lib/main.js` has the version hardcoded and rejects the 0.28.0 binary at runtime with: `Cannot start service: Host version "0.21.5" does not match binary version "0.28.0"`.

## The Fix
A pre-start patch script `scripts/patch-esbuild.cjs` that:
1. Checks if `node_modules/vite/node_modules/esbuild/bin/esbuild` is the correct 0.21.5 ELF binary
2. Also checks `node_modules/vite/node_modules/@esbuild/linux-x64/bin/esbuild` (which is what Vite resolves via Node module resolution)
3. If either is wrong, copies the correct 0.21.5 native binary from `scripts/esbuild-0.21.5` (cached) or downloads from the Replit package firewall
4. The 0.21.5 binary is cached at `scripts/esbuild-0.21.5` in git

**Why:** The `dev` script is `node scripts/patch-esbuild.cjs && NODE_ENV=development tsx server/index.ts` — the patch runs every startup (fast no-op if already correct).

## Install Strategy
- `npm install --legacy-peer-deps --ignore-scripts` to bypass install script failures
- Then run the patch script to fix binaries

## Key paths
- Patch script: `scripts/patch-esbuild.cjs`
- Cached binary: `scripts/esbuild-0.21.5`
- Download URL: `http://package-firewall.replit.local/npm/@esbuild/linux-x64/-/linux-x64-0.21.5.tgz`
