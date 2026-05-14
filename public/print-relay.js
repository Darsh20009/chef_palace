#!/usr/bin/env node
/**
 * QIROX Print Relay Agent — v2.1
 * ================================
 * وكيل الطباعة المحلي — يعمل على أي جهاز في الشبكة (ويندوز / ماك / لينكس)
 * يستقبل أوامر الطباعة من المتصفح ويرسلها مباشرة للطابعة عبر TCP/IP
 *
 * ━━━━ طابعة ProPos PP9000E ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  MAC : 46-28-0E-8B-C9-66-B2
 *  IP  : 192.168.1.114
 *  Port: 9100  (RAW ESC/POS standard)
 *  Width: 80mm
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * الإعداد:
 *   1. ثبّت Node.js من https://nodejs.org  (الإصدار 14 أو أحدث)
 *   2. شغّل:  node print-relay.js
 *   3. انسخ رابط الجهاز الظاهر عند التشغيل (مثال: http://192.168.1.5:8089)
 *   4. في إعدادات الطابعة → وضع "وكيل محلي" → الصق الرابط
 *   5. IP الطابعة: 192.168.1.114  |  المنفذ: 9100
 *   6. اضغط "اختبار الاتصال" للتحقق ✅
 *
 * تغيير المنفذ:  PORT=8090 node print-relay.js
 */

'use strict';

const http = require('http');
const net  = require('net');
const os   = require('os');

const PORT    = parseInt(process.env.PORT || '8089', 10);
const TIMEOUT = parseInt(process.env.TIMEOUT || '8000', 10);
const VERSION = '2.1';

// ── ProPos PP9000E default config ─────────────────────────────────────────────
const PROPOS_IP   = '192.168.1.114';
const PROPOS_PORT = 9100;

// ── الحصول على IPs المحلية ────────────────────────────────────────────────────
function getLocalIPs() {
  const ips = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

// ── إرسال ESC/POS bytes للطابعة عبر TCP ─────────────────────────────────────
function sendToThermalPrinter(ip, port, buffer, timeoutMs) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let done = false;
    const finish = (err) => {
      if (done) return;
      done = true;
      client.destroy();
      err ? reject(err) : resolve();
    };

    client.setTimeout(timeoutMs || TIMEOUT);
    client.on('error',   (err) => finish(err));
    client.on('timeout', ()    => finish(new Error(`انتهت مهلة الاتصال بـ ${ip}:${port}`)));

    client.connect(Number(port), ip, () => {
      client.write(buffer, (err) => {
        if (err) return finish(err);
        // انتظر 800ms لضمان استلام الطابعة لجميع البيانات قبل إغلاق الاتصال
        setTimeout(() => finish(null), 800);
      });
    });
  });
}

// ── اختبار TCP بدون إرسال بيانات ─────────────────────────────────────────────
function testTCPConnection(ip, port, timeoutMs) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let done = false;
    const finish = (ok, msg) => {
      if (done) return;
      done = true;
      client.destroy();
      resolve({ ok, msg });
    };
    client.setTimeout(timeoutMs || 5000);
    client.on('error',   (err) => finish(false, err.message));
    client.on('timeout', ()    => finish(false, `انتهت مهلة الاتصال (${timeoutMs || 5000}ms)`));
    client.connect(Number(port), ip, () => finish(true, `✅ الطابعة ${ip}:${port} تستجيب`));
  });
}

// ── CORS headers ──────────────────────────────────────────────────────────────
function addCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ── قراءة body ────────────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => {
      body += c;
      if (body.length > 5_000_000) reject(new Error('Request too large'));
    });
    req.on('end',   () => resolve(body));
    req.on('error', reject);
  });
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  addCORSHeaders(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url.split('?')[0];

  // ── GET /status ─ فحص الوكيل ─────────────────────────────────────────────
  if (req.method === 'GET' && (url === '/' || url === '/status')) {
    res.writeHead(200);
    res.end(JSON.stringify({
      ok:        true,
      status:    'running',
      name:      'QIROX Print Relay Agent',
      version:   VERSION,
      port:      PORT,
      localIPs:  getLocalIPs(),
      printer: {
        model:   'ProPos PP9000E',
        ip:      PROPOS_IP,
        port:    PROPOS_PORT,
        mac:     '46-28-0E-8B-C9-66-B2',
        width:   '80mm',
      },
      uptime: Math.round(process.uptime()),
    }));
    return;
  }

  // ── POST /print ─ إرسال ESC/POS للطابعة ──────────────────────────────────
  if (req.method === 'POST' && url === '/print') {
    try {
      const body = JSON.parse(await readBody(req));
      const ip   = body.ip   || PROPOS_IP;
      const port = body.port || PROPOS_PORT;
      const tmo  = body.timeout || TIMEOUT;

      if (!body.data) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'حقل "data" (base64) مطلوب' }));
        return;
      }

      const buffer = Buffer.from(body.data, 'base64');
      const ts = new Date().toLocaleTimeString('ar-SA');
      console.log(`[${ts}] 🖨  طباعة ${buffer.length} bytes → ${ip}:${port}`);

      await sendToThermalPrinter(ip, port, buffer, tmo);

      console.log(`[${new Date().toLocaleTimeString('ar-SA')}] ✅ تمت الطباعة بنجاح على ${ip}:${port}`);
      res.writeHead(200);
      res.end(JSON.stringify({
        success:   true,
        message:   `✅ تمت الطباعة على ${ip}:${port}`,
        bytes:     buffer.length,
        timestamp: new Date().toISOString(),
      }));
    } catch (err) {
      console.error(`[${new Date().toLocaleTimeString('ar-SA')}] ❌ فشل الإرسال:`, err.message);
      res.writeHead(503);
      res.end(JSON.stringify({
        success: false,
        error:   err.message || 'فشل الاتصال بالطابعة',
        hint:    `تأكد أن الطابعة (${PROPOS_IP}) متصلة بالشبكة وتعمل`,
      }));
    }
    return;
  }

  // ── POST /test ─ اختبار الاتصال بدون طباعة ───────────────────────────────
  if (req.method === 'POST' && url === '/test') {
    try {
      const body = JSON.parse(await readBody(req));
      const ip   = body.ip   || PROPOS_IP;
      const port = body.port || PROPOS_PORT;
      const result = await testTCPConnection(ip, port);
      res.writeHead(result.ok ? 200 : 503);
      res.end(JSON.stringify({
        success: result.ok,
        message: result.msg,
        ip, port,
        model: (ip === PROPOS_IP) ? 'ProPos PP9000E' : 'Unknown',
      }));
    } catch (err) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found', routes: ['/status', '/print', '/test'] }));
});

// ── تشغيل السيرفر ─────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         QIROX Print Relay Agent v' + VERSION + ' — وكيل الطباعة        ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  الطابعة : ProPos PP9000E (N-931 1.00)                      ║');
  console.log('║  IP      : 192.168.1.114   |  Port: 9100                    ║');
  console.log('║  MAC     : 46-28-0E-8B-C9-66-B2                             ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  روابط الوكيل — أدخل أحدها في إعدادات الطابعة:             ║');
  for (const ip of ips) {
    const url  = `http://${ip}:${PORT}`;
    const line = `║    ${url}`;
    console.log(line.padEnd(65) + '║');
  }
  if (ips.length === 0) {
    console.log(`║    http://localhost:${PORT}`.padEnd(65) + '║');
  }
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  الحالة : يعمل ✅  —  في انتظار طلبات الطباعة...           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('  الخطوات التالية:');
  console.log('  1. انسخ أحد الروابط أعلاه');
  console.log('  2. في إعدادات الطابعة ← اختر "وكيل محلي (ProPos)"');
  console.log('  3. الصق الرابط في حقل "رابط وكيل الطباعة"');
  console.log('  4. تأكد أن IP الطابعة: 192.168.1.114 والمنفذ: 9100');
  console.log('  5. اضغط "اختبار الاتصال" 🟢');
  console.log('');
  console.log('  اضغط Ctrl+C لإيقاف الوكيل');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ المنفذ ${PORT} مستخدم بالفعل.`);
    console.error(`   جرب: PORT=${PORT + 1} node print-relay.js\n`);
  } else {
    console.error('❌ خطأ في السيرفر:', err.message);
  }
  process.exit(1);
});

process.on('SIGINT',  () => { console.log('\n👋 تم إيقاف وكيل الطباعة.'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n👋 تم إيقاف وكيل الطباعة.'); process.exit(0); });
