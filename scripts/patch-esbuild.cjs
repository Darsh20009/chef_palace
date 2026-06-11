#!/usr/bin/env node
// Ensures vite's nested esbuild resolves the correct 0.21.5 native binary.
// Vite 5 uses esbuild 0.21.5 internally. Works on both Replit and Render/CI.
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const CACHE_BIN = path.join(__dirname, 'esbuild-0.21.5');
// Try Replit-local first, fall back to public npm registry
const TARBALL_URLS = [
  'http://package-firewall.replit.local/npm/@esbuild/linux-x64/-/linux-x64-0.21.5.tgz',
  'https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-0.21.5.tgz',
];
const EXPECTED_VERSION = '0.21.5';

const TARGETS = [
  path.join(__dirname, '../node_modules/vite/node_modules/esbuild/bin/esbuild'),
  path.join(__dirname, '../node_modules/vite/node_modules/@esbuild/linux-x64/bin/esbuild'),
];

function getBinVersion(p) {
  try { return execFileSync(p, ['--version'], { stdio: 'pipe' }).toString().trim(); } catch { return null; }
}

function isELF(p) {
  try {
    const buf = Buffer.alloc(4);
    const fd = fs.openSync(p, 'r');
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    return buf[0] === 0x7f && buf[1] === 0x45;
  } catch { return false; }
}

function ensureCorrectBin(target, sourceBin) {
  if (fs.existsSync(target) && isELF(target) && getBinVersion(target) === EXPECTED_VERSION) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourceBin, target);
  fs.chmodSync(target, 0o755);
  console.log('[patch-esbuild] Fixed: ' + target);
}

function tryDownload(url) {
  const tmpTar = '/tmp/esbuild-0.21.5.tgz';
  const tmpDir = '/tmp/esbuild-pkg-021';
  const result = spawnSync('curl', ['-sf', '--max-time', '30', '-o', tmpTar, url]);
  if (result.status !== 0 || !fs.existsSync(tmpTar)) return null;
  spawnSync('rm', ['-rf', tmpDir]);
  fs.mkdirSync(tmpDir, { recursive: true });
  const tar = spawnSync('tar', ['-xzf', tmpTar, '-C', tmpDir]);
  if (tar.status !== 0) return null;
  const extracted = path.join(tmpDir, 'package/bin/esbuild');
  if (!fs.existsSync(extracted)) return null;
  fs.copyFileSync(extracted, CACHE_BIN);
  fs.chmodSync(CACHE_BIN, 0o755);
  return CACHE_BIN;
}

function getOrDownloadBinary() {
  if (fs.existsSync(CACHE_BIN) && isELF(CACHE_BIN) && getBinVersion(CACHE_BIN) === EXPECTED_VERSION) {
    return CACHE_BIN;
  }
  console.log('[patch-esbuild] Downloading esbuild 0.21.5...');
  for (const url of TARBALL_URLS) {
    console.log('[patch-esbuild] Trying: ' + url);
    const bin = tryDownload(url);
    if (bin) {
      console.log('[patch-esbuild] Downloaded esbuild 0.21.5.');
      return bin;
    }
  }
  throw new Error('[patch-esbuild] Failed to download esbuild 0.21.5 from all sources.');
}

// Check if all targets are already correct
const allCorrect = TARGETS.every(t => fs.existsSync(t) && isELF(t) && getBinVersion(t) === EXPECTED_VERSION);
if (allCorrect) {
  console.log('[patch-esbuild] All esbuild binaries are correct (0.21.5). Done.');
  process.exit(0);
}

const sourceBin = getOrDownloadBinary();
for (const target of TARGETS) {
  ensureCorrectBin(target, sourceBin);
}

// Also fix nested @esbuild/linux-x64 package.json version
const nestedPkgPath = path.join(__dirname, '../node_modules/vite/node_modules/@esbuild/linux-x64/package.json');
if (fs.existsSync(nestedPkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(nestedPkgPath, 'utf8'));
  if (pkg.version !== EXPECTED_VERSION) {
    pkg.version = EXPECTED_VERSION;
    fs.writeFileSync(nestedPkgPath, JSON.stringify(pkg, null, 2));
    console.log('[patch-esbuild] Fixed @esbuild/linux-x64 package.json version.');
  }
}

console.log('[patch-esbuild] Done.');
