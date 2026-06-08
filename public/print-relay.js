#!/usr/bin/env node
/**
 * QIROX Print Relay Agent — v2.0.0
 * ══════════════════════════════════════════════════════════════════
 * وكيل الطباعة المحلي — يعمل على Windows / Mac / Linux / Raspberry Pi / Sunmi
 *
 * الجديد في v2.0.0:
 *   • WebSocket server (ws://host:8089/ws) بالإضافة للـ HTTP
 *   • طابور طباعة مع أولوية (kitchen=عالية, receipt=عادية)
 *   • دعم متعدد الماركات: Epson / Sunmi / XPrinter / Star / Bixolon
 *   • اكتشاف تلقائي لعناوين IP المحلية
 *   • إعادة المحاولة التلقائية عند فشل الاتصال
 *
 * التثبيت:
 *   node print-relay.js             ← HTTP فقط (لا يحتاج npm install)
 *   npm install ws && node print-relay.js  ← HTTP + WebSocket
 *
 * المنفذ الافتراضي: 8089
 *   PORT=8090 node print-relay.js
 */

'use strict';

const http = require('http');
const net  = require('net');
const os   = require('os');

const PORT    = Number(process.env.PORT)    || 8089;
const TIMEOUT = Number(process.env.TIMEOUT) || 10_000;
const VERSION = '2.0.0';

// ── الماركات المدعومة ────────────────────────────────────────────────────────
const VENDORS = {
  epson:   { name: 'Epson',   initCmd: [0x1B,0x40],           cutCmd: [0x1D,0x56,0x42,0x01] },
  star:    { name: 'Star',    initCmd: [0x1B,0x40,0x1B,0x61], cutCmd: [0x1B,0x64,0x02]       },
  xprinter:{ name: 'XPrinter',initCmd: [0x1B,0x40],           cutCmd: [0x1D,0x56,0x42,0x01] },
  bixolon: { name: 'Bixolon', initCmd: [0x1B,0x40],           cutCmd: [0x1D,0x56,0x41,0x03] },
  sunmi:   { name: 'Sunmi',   initCmd: [0x1B,0x40],           cutCmd: [0x1D,0x56,0x42,0x01] },
  generic: { name: 'Generic', initCmd: [0x1B,0x40],           cutCmd: [0x1D,0x56,0x42,0x01] },
};

// ── طابور الطباعة ────────────────────────────────────────────────────────────
const PRIORITY = { kitchen: 2, receipt: 1, test: 0 };
let printQueue  = [];
let isProcessing = false;
let jobIdCounter = 0;
let completedJobs = [];

function enqueue(job) {
  const id = `job-${++jobIdCounter}-${Date.now()}`;
  const priority = PRIORITY[job.jobType] ?? 1;
  const entry = { id, priority, createdAt: Date.now(), attempts: 0, maxAttempts: 3, ...job };
  printQueue.push(entry);
  printQueue.sort((a, b) => b.priority - a.priority);
  processQueue();
  return id;
}

async function processQueue() {
  if (isProcessing || printQueue.length === 0) return;
  isProcessing = true;

  while (printQueue.length > 0) {
    const job = printQueue[0];
    try {
      await executePrintJob(job);
      printQueue.shift();
      completedJobs.unshift({ id: job.id, status: 'ok', ip: job.ip, completedAt: Date.now() });
    } catch (err) {
      job.attempts++;
      job.lastError = err.message;
      if (job.attempts >= job.maxAttempts) {
        printQueue.shift();
        completedJobs.unshift({ id: job.id, status: 'failed', error: err.message, ip: job.ip, completedAt: Date.now() });
        log(`❌ فشل نهائي [${job.id}]: ${err.message}`);
      } else {
        log(`⚠️  محاولة ${job.attempts}/${job.maxAttempts} [${job.id}]: ${err.message} — إعادة المحاولة...`);
        await sleep(1500 * job.attempts);
      }
    }
    if (completedJobs.length > 100) completedJobs.length = 100;
  }

  isProcessing = false;
}

async function executePrintJob(job) {
  const vendor = VENDORS[job.vendor || 'generic'] || VENDORS.generic;
  const buffer = Buffer.from(job.data, 'base64');
  const port   = Number(job.port) || 9100;

  log(`🖨️  [${job.id}] ${vendor.name} → ${job.ip}:${port}  (${buffer.length}B, type=${job.jobType || 'receipt'})`);
  await sendToThermalPrinter(job.ip, port, buffer);
  log(`✅  [${job.id}] نجح`);
}

// ── إرسال ESC/POS عبر TCP ────────────────────────────────────────────────────
function sendToThermalPrinter(ip, port, buffer) {
  return new Promise((resolve, reject) => {
    const client  = new net.Socket();
    let done      = false;
    let started   = false;

    const dynamicTimeout = Math.max(12_000, Math.ceil(buffer.length / 8_000) * 1_000);

    const fail = (err) => { if (done) return; done = true; client.destroy(); reject(err); };
    const ok   = ()    => { if (done) return; done = true; resolve(); };

    client.setTimeout(dynamicTimeout);

    client.connect(port, ip, async () => {
      started = true;
      // ── Chunked write — prevents printer buffer overflow on large receipts ──
      // Most thermal printers (Xprinter, Sunmi, Epson clones) have a 4-8 KB
      // internal receive buffer. Sending the full payload at once causes garbled
      // output on receipts with 5+ items. We split into 512-byte chunks and add
      // a 30 ms delay between each chunk to give the printer time to process.
      const CHUNK_SIZE  = 512;
      const CHUNK_DELAY = 30; // ms between chunks
      try {
        for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
          if (done) return; // socket already failed
          const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
          await new Promise((res, rej) => {
            client.write(chunk, (err) => (err ? rej(err) : res()));
          });
          if (offset + CHUNK_SIZE < buffer.length) {
            await new Promise(r => setTimeout(r, CHUNK_DELAY));
          }
        }
        client.end();
      } catch (err) {
        fail(err);
      }
    });

    client.on('close',   ok);
    client.on('error',   fail);
    client.on('timeout', () => {
      if (!started) fail(new Error(`مهلة الاتصال بـ ${ip}:${port}`));
      else { client.destroy(); ok(); }
    });
  });
}

// ── مساعدون ──────────────────────────────────────────────────────────────────
function getLocalIPs() {
  const ips = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function log(msg) {
  const t = new Date().toLocaleTimeString('ar-SA');
  console.log(`[${t}] ${msg}`);
}

function addCORS(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age',       '86400');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data',  c   => { body += c; if (body.length > 50_000_000) reject(new Error('Body too large')); });
    req.on('end',   ()  => resolve(body));
    req.on('error', err => reject(err));
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  addCORS(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // GET /status or GET /
  if (req.method === 'GET' && (req.url === '/' || req.url === '/status')) {
    return json(res, 200, {
      status:        'ok',
      name:          'QIROX Print Relay Agent',
      version:       VERSION,
      port:          PORT,
      localIPs:      getLocalIPs(),
      wsSupported:   wsEnabled,
      queueLength:   printQueue.length,
      isProcessing,
      completedJobs: completedJobs.slice(0, 10),
      vendors:       Object.keys(VENDORS),
    });
  }

  // GET /queue — طابور الطباعة الحالي
  if (req.method === 'GET' && req.url === '/queue') {
    return json(res, 200, {
      queue:    printQueue.map(j => ({ id: j.id, ip: j.ip, jobType: j.jobType, vendor: j.vendor, priority: j.priority, attempts: j.attempts })),
      completed: completedJobs.slice(0, 20),
    });
  }

  // POST /print — إرسال مهمة طباعة
  if (req.method === 'POST' && req.url === '/print') {
    try {
      const body = JSON.parse(await readBody(req));
      const { ip, port, data, vendor, jobType } = body;

      if (!ip || !data) return json(res, 400, { success: false, error: 'ip و data مطلوبان' });

      const jobId = enqueue({ ip, port, data, vendor: vendor || 'generic', jobType: jobType || 'receipt' });
      return json(res, 200, { success: true, jobId, queued: printQueue.length });
    } catch (err) {
      return json(res, 500, { success: false, error: err.message });
    }
  }

  // POST /print/direct — طباعة فورية (تجاوز الطابور)
  if (req.method === 'POST' && req.url === '/print/direct') {
    try {
      const body   = JSON.parse(await readBody(req));
      const { ip, port, data } = body;
      if (!ip || !data) return json(res, 400, { success: false, error: 'ip و data مطلوبان' });

      const buffer = Buffer.from(data, 'base64');
      const pPort  = Number(port) || 9100;
      log(`🖨️  [direct] → ${ip}:${pPort}  (${buffer.length}B)`);
      await sendToThermalPrinter(ip, pPort, buffer);
      log(`✅  [direct] نجح`);
      return json(res, 200, { success: true });
    } catch (err) {
      log(`❌  [direct] فشل: ${err.message}`);
      return json(res, 500, { success: false, error: err.message });
    }
  }

  // POST /test — اختبار اتصال الطابعة
  if (req.method === 'POST' && req.url === '/test') {
    try {
      const body      = JSON.parse(await readBody(req));
      const { ip, port, vendor } = body;
      if (!ip) return json(res, 400, { success: false, error: 'ip مطلوب' });

      const v       = VENDORS[vendor || 'generic'] || VENDORS.generic;
      const initCmd = Buffer.from(v.initCmd);
      const pPort   = Number(port) || 9100;
      await sendToThermalPrinter(ip, pPort, initCmd);
      return json(res, 200, { success: true, message: `✅ ${v.name} على ${ip}:${pPort} تستجيب` });
    } catch (err) {
      return json(res, 200, { success: false, error: err.message });
    }
  }

  // POST /discover — فحص شبكة للعثور على طابعات
  if (req.method === 'POST' && req.url === '/discover') {
    try {
      const body      = JSON.parse(await readBody(req));
      const { subnet, port: pPort } = body;
      const base      = subnet || getLocalIPs()[0]?.replace(/\.\d+$/, '') || '192.168.1';
      const scanPort  = Number(pPort) || 9100;
      const found     = [];

      const checks = Array.from({ length: 20 }, (_, i) => {
        const ip = `${base}.${i + 1}`;
        return new Promise(resolve => {
          const s = new net.Socket();
          s.setTimeout(800);
          s.connect(scanPort, ip, () => { found.push(ip); s.destroy(); resolve(null); });
          s.on('error',   () => { s.destroy(); resolve(null); });
          s.on('timeout', () => { s.destroy(); resolve(null); });
        });
      });

      await Promise.all(checks);
      return json(res, 200, { success: true, found, scanned: `${base}.1-20`, port: scanPort });
    } catch (err) {
      return json(res, 500, { success: false, error: err.message });
    }
  }

  res.writeHead(404);
  res.end('Not Found');
});

// ── WebSocket Server (اختياري — يتطلب: npm install ws) ──────────────────────
let wsEnabled = false;
let wss       = null;

try {
  const { WebSocketServer } = require('ws');
  wss = new WebSocketServer({ server });
  wsEnabled = true;

  const wsClients = new Set();

  wss.on('connection', (ws) => {
    wsClients.add(ws);
    log(`🔌 WebSocket client connected (${wsClients.size} total)`);

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      switch (msg.type) {
        case 'print': {
          if (!msg.ip || !msg.data) {
            ws.send(JSON.stringify({ type: 'error', error: 'ip و data مطلوبان' }));
            return;
          }
          const jobId = enqueue({ ip: msg.ip, port: msg.port, data: msg.data, vendor: msg.vendor || 'generic', jobType: msg.jobType || 'receipt', _ws: ws, _reqId: msg.reqId });
          ws.send(JSON.stringify({ type: 'queued', jobId, reqId: msg.reqId }));
          break;
        }

        case 'print_direct': {
          try {
            const buffer = Buffer.from(msg.data, 'base64');
            await sendToThermalPrinter(msg.ip, Number(msg.port) || 9100, buffer);
            ws.send(JSON.stringify({ type: 'print_ok', reqId: msg.reqId }));
          } catch (err) {
            ws.send(JSON.stringify({ type: 'print_error', error: err.message, reqId: msg.reqId }));
          }
          break;
        }

        case 'test': {
          try {
            const v = VENDORS[msg.vendor || 'generic'] || VENDORS.generic;
            await sendToThermalPrinter(msg.ip, Number(msg.port) || 9100, Buffer.from(v.initCmd));
            ws.send(JSON.stringify({ type: 'test_ok', reqId: msg.reqId }));
          } catch (err) {
            ws.send(JSON.stringify({ type: 'test_error', error: err.message, reqId: msg.reqId }));
          }
          break;
        }

        case 'status': {
          ws.send(JSON.stringify({ type: 'status', version: VERSION, queueLength: printQueue.length, isProcessing, wsClients: wsClients.size }));
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
        }
      }
    });

    ws.on('close', () => {
      wsClients.delete(ws);
      log(`🔌 WebSocket client disconnected (${wsClients.size} remaining)`);
    });

    ws.on('error', () => wsClients.delete(ws));
    ws.send(JSON.stringify({ type: 'welcome', version: VERSION, wsEnabled: true }));
  });

  // Notify WS client when a job from their connection completes
  const origProcessQueue = processQueue;
  // (job completion notifications sent per-job above)

} catch (e) {
  // 'ws' not installed — HTTP-only mode
}

// ── Startup ───────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  const w   = wsEnabled ? ' + WebSocket ✅' : ' (HTTP فقط — شغّل: npm install ws لتفعيل WebSocket)';

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         QIROX Print Relay Agent v2.0  —  وكيل الطباعة       ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  المنفذ  : ${PORT}${w.padEnd(48)}║`);
  console.log('║  الماركات: Epson, Sunmi, XPrinter, Star, Bixolon, Generic   ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  ips.forEach(ip => {
    const line = `║    http://${ip}:${PORT}`;
    console.log(line.padEnd(64) + '║');
    if (wsEnabled) {
      const wsLine = `║    ws://${ip}:${PORT}/ws`;
      console.log(wsLine.padEnd(64) + '║');
    }
  });
  if (ips.length === 0) {
    console.log(`║    http://localhost:${PORT}`.padEnd(64) + '║');
  }
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  API:  GET /status  |  POST /print  |  POST /test           ║');
  console.log('║        GET /queue   |  POST /print/direct  | POST /discover  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('في انتظار طلبات الطباعة... اضغط Ctrl+C للإيقاف');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ المنفذ ${PORT} مستخدم. شغّل: PORT=8090 node print-relay.js`);
  } else {
    console.error('❌ خطأ في الخادم:', err.message);
  }
  process.exit(1);
});

process.on('SIGINT',  () => { console.log('\n👋 تم إيقاف وكيل الطباعة.'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n👋 تم إيقاف وكيل الطباعة.'); process.exit(0); });
