#!/usr/bin/env node
// Ensures both Vite's (0.21.5) and tsx's (0.28.0) esbuild native binaries are present.
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

// ── esbuild 0.21.5 (Vite) ────────────────────────────────────────────────────
const CACHE_021 = path.join(__dirname, 'esbuild-0.21.5');
const URLS_021 = [
  'http://package-firewall.replit.local/npm/@esbuild/linux-x64/-/linux-x64-0.21.5.tgz',
  'https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-0.21.5.tgz',
];
const TARGETS_021 = [
  path.join(__dirname, '../node_modules/vite/node_modules/esbuild/bin/esbuild'),
  path.join(__dirname, '../node_modules/vite/node_modules/@esbuild/linux-x64/bin/esbuild'),
];

// ── esbuild 0.28.0 (tsx) ─────────────────────────────────────────────────────
const CACHE_028 = path.join(__dirname, 'esbuild-0.28.0');
const URLS_028 = [
  'http://package-firewall.replit.local/npm/@esbuild/linux-x64/-/linux-x64-0.28.0.tgz',
  'https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-0.28.0.tgz',
];
const TARGETS_028 = [
  path.join(__dirname, '../node_modules/@esbuild/linux-x64/bin/esbuild'),
];

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function isCorrect(p, version) {
  return fs.existsSync(p) && isELF(p) && getBinVersion(p) === version;
}

function ensureCorrectBin(target, sourceBin, version) {
  if (isCorrect(target, version)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourceBin, target);
  fs.chmodSync(target, 0o755);
  console.log('[patch-esbuild] Fixed: ' + target);
}

function tryDownload(urls, cacheBin, version) {
  for (const url of urls) {
    console.log('[patch-esbuild] Trying: ' + url);
    const tmpTar = `/tmp/esbuild-${version}.tgz`;
    const tmpDir = `/tmp/esbuild-pkg-${version.replace(/\./g, '')}`;
    const result = spawnSync('curl', ['-sf', '--max-time', '30', '-o', tmpTar, url]);
    if (result.status !== 0 || !fs.existsSync(tmpTar)) continue;
    spawnSync('rm', ['-rf', tmpDir]);
    fs.mkdirSync(tmpDir, { recursive: true });
    if (spawnSync('tar', ['-xzf', tmpTar, '-C', tmpDir]).status !== 0) continue;
    const extracted = path.join(tmpDir, 'package/bin/esbuild');
    if (!fs.existsSync(extracted)) continue;
    fs.copyFileSync(extracted, cacheBin);
    fs.chmodSync(cacheBin, 0o755);
    console.log('[patch-esbuild] Downloaded esbuild ' + version);
    return cacheBin;
  }
  return null;
}

function getOrDownload(cacheBin, urls, version) {
  if (isCorrect(cacheBin, version)) return cacheBin;
  console.log('[patch-esbuild] Downloading esbuild ' + version + '...');
  const bin = tryDownload(urls, cacheBin, version);
  if (!bin) throw new Error('[patch-esbuild] Failed to download esbuild ' + version);
  return bin;
}

function fixPackageJsonVersion(pkgPath, version) {
  if (!fs.existsSync(pkgPath)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.version !== version) {
    pkg.version = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log('[patch-esbuild] Fixed package.json version at: ' + pkgPath);
  }
}

// ── Apply patches ─────────────────────────────────────────────────────────────

// 1. esbuild 0.21.5 — for Vite
const all021Correct = TARGETS_021.every(t => isCorrect(t, '0.21.5'));
if (!all021Correct) {
  const bin021 = getOrDownload(CACHE_021, URLS_021, '0.21.5');
  for (const t of TARGETS_021) ensureCorrectBin(t, bin021, '0.21.5');
  fixPackageJsonVersion(
    path.join(__dirname, '../node_modules/vite/node_modules/@esbuild/linux-x64/package.json'),
    '0.21.5'
  );
}

// 2. esbuild 0.28.0 — for tsx (main node_modules/esbuild)
const all028Correct = TARGETS_028.every(t => isCorrect(t, '0.28.0'));
if (!all028Correct) {
  const bin028 = getOrDownload(CACHE_028, URLS_028, '0.28.0');
  for (const t of TARGETS_028) ensureCorrectBin(t, bin028, '0.28.0');
  // Create minimal package.json for @esbuild/linux-x64 if missing
  const pkg028 = path.join(__dirname, '../node_modules/@esbuild/linux-x64/package.json');
  if (!fs.existsSync(pkg028)) {
    fs.writeFileSync(pkg028, JSON.stringify({ name: '@esbuild/linux-x64', version: '0.28.0' }, null, 2));
    console.log('[patch-esbuild] Created @esbuild/linux-x64/package.json');
  }
}

console.log('[patch-esbuild] All esbuild binaries are correct. Done.');
