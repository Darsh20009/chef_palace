#!/usr/bin/env node
/**
 * QIROX Cloud Print Agent
 * ────────────────────────
 * Polls the QIROX server for pending print jobs and sends them
 * via TCP to the local thermal printer.
 *
 * Usage:
 *   node print-agent.js --server https://your-app.replit.app --key YOUR_KEY --ip 192.168.8.77 --port 9100
 *
 * Or set environment variables:
 *   QIROX_SERVER, QIROX_KEY, PRINTER_IP, PRINTER_PORT
 */

const net  = require('net');
const http = require('http');
const https = require('https');
const os   = require('os');

// ── Config (from args or env) ──────────────────────────────────────────────
const args = {};
process.argv.slice(2).forEach((v, i, a) => {
  if (v.startsWith('--')) args[v.slice(2)] = a[i + 1];
});

const SERVER_URL  = args.server  || process.env.QIROX_SERVER  || 'REPLACE_SERVER_URL';
const AGENT_KEY   = args.key     || process.env.QIROX_KEY     || 'REPLACE_AGENT_KEY';
const PRINTER_IP  = args.ip      || process.env.PRINTER_IP    || '192.168.8.77';
const PRINTER_PORT = parseInt(args.port || process.env.PRINTER_PORT || '9100', 10);
const POLL_MS     = parseInt(args.poll || process.env.POLL_MS || '2000', 10);

// ── Helpers ────────────────────────────────────────────────────────────────
function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-print-agent-key': AGENT_KEY,
        ...(options.headers || {}),
      },
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { reject(new Error(`Bad JSON: ${body.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function sendToPrinter(base64Data, ip, port) {
  return new Promise((resolve, reject) => {
    const buf  = Buffer.from(base64Data, 'base64');
    const sock = new net.Socket();
    sock.setTimeout(8000);
    sock.connect(port, ip, () => {
      sock.write(buf);
      sock.end();
    });
    sock.on('close', () => resolve());
    sock.on('error', reject);
    sock.on('timeout', () => {
      sock.destroy();
      reject(new Error(`TCP timeout connecting to ${ip}:${port}`));
    });
  });
}

// ── Main loop ──────────────────────────────────────────────────────────────
async function poll() {
  try {
    const { status, data } = await fetchJson(`${SERVER_URL}/api/print-queue/pending`);
    if (status === 401) {
      console.error('[✗] Invalid agent key — check QIROX_KEY');
      return;
    }
    if (!data.job) return; // nothing pending

    const job = data.job;
    const ip   = job.printerIp   || PRINTER_IP;
    const port = job.printerPort || PRINTER_PORT;

    process.stdout.write(`[→] Printing job ${job._id} to ${ip}:${port} ... `);

    try {
      await sendToPrinter(job.data, ip, port);
      await fetchJson(`${SERVER_URL}/api/print-queue/${job._id}/done`, {
        method: 'PATCH', body: '{}',
      });
      console.log('✓ Done');
    } catch (printErr) {
      console.log(`✗ ${printErr.message}`);
      await fetchJson(`${SERVER_URL}/api/print-queue/${job._id}/done`, {
        method: 'PATCH',
        body: JSON.stringify({ error: printErr.message }),
      });
    }
  } catch (e) {
    // Network error polling server — suppress after first show
    if (!poll._quiet) {
      console.error('[!] Cannot reach QIROX server:', e.message);
      poll._quiet = true;
      setTimeout(() => { poll._quiet = false; }, 30000);
    }
  }
}
poll._quiet = false;

// ── Startup Banner ─────────────────────────────────────────────────────────
const ifaces = os.networkInterfaces();
const localIps = [];
Object.values(ifaces).flat().filter(i => i && i.family === 'IPv4' && !i.internal).forEach(i => localIps.push(i.address));

console.log('\n  ╔══════════════════════════════════════════════════════╗');
console.log('  ║         QIROX Cloud Print Agent  ✓                   ║');
console.log('  ╚══════════════════════════════════════════════════════╝');
console.log(`\n  السيرفر / Server : ${SERVER_URL}`);
console.log(`  الطابعة / Printer: ${PRINTER_IP}:${PRINTER_PORT}`);
console.log(`  استطلاع / Poll   : كل ${POLL_MS / 1000} ثانية`);
console.log('\n  الجهاز يعمل الآن — لا تغلق هذه النافذة');
console.log('  Agent is running — do NOT close this window\n');

if (SERVER_URL === 'REPLACE_SERVER_URL' || AGENT_KEY === 'REPLACE_AGENT_KEY') {
  console.error('  [!] تحذير: SERVER_URL أو AGENT_KEY غير مضبوط بشكل صحيح!');
  console.error('      Warning: SERVER_URL or AGENT_KEY is not configured!');
  console.error('      Use the download button in Printer Settings to get a pre-configured file.\n');
}

setInterval(poll, POLL_MS);
poll(); // first poll immediately
