#!/usr/bin/env node
/**
 * QIROX Print Relay Agent — v3.0 (Multi-Printer)
 * ================================================
 * وكيل الطباعة المحلي — يعمل على أي جهاز في الشبكة (ويندوز / ماك / لينكس)
 * يستقبل أوامر الطباعة من المتصفح ويرسلها مباشرة للطابعة عبر TCP/IP
 *
 * ━━━━ طابعات ProPos PP9000E المتصلة ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  طابعة العميل  : 192.168.3.22   MAC: 28-0e-8b-36-55-0a  SubNet: 192.168.3.0/24
 *  طابعة مطبخ 1  : 192.168.1.114  MAC: 28-0e-8b-c9-66-d2  SubNet: 192.168.1.0/24
 *  طابعة مطبخ 2  : (غير محدد - أضف IP الطابعة الثالثة هنا)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * الإعداد السريع:
 *   1. ثبّت Node.js من https://nodejs.org  (الإصدار 16 أو أحدث)
 *   2. شغّل:  node print-relay.js
 *   3. افتح المتصفح على http://localhost:8089 للتحقق
 *   4. انسخ رابط الجهاز الظاهر عند التشغيل (مثال: http://192.168.1.5:8089)
 *   5. في إعدادات الطابعة → وضع "وكيل محلي" → الصق الرابط
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
const VERSION = '3.0';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ⚙️  إعداد الطابعات — عدّل هذا القسم فقط إذا تغيّرت IPs الطابعات
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const PRINTERS = {
  customer: {
    ip:    '192.168.3.22',
    port:  9100,
    mac:   '28-0e-8b-36-55-0a',
    label: 'طابعة العميل (Customer Receipt)',
    model: 'ProPos PP9000E',
  },
  kitchen1: {
    ip:    '192.168.1.114',
    port:  9100,
    mac:   '28-0e-8b-c9-66-d2',
    label: 'طابعة المطبخ 1 (Kitchen 1)',
    model: 'ProPos PP9000E',
  },
  kitchen2: {
    ip:    '',          // ← أضف IP الطابعة الثالثة هنا
    port:  9100,
    mac:   '',
    label: 'طابعة المطبخ 2 (Kitchen 2)',
    model: 'ProPos PP9000E',
  },
};
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

// ── إرسال ESC/POS bytes للطابعة عبر TCP مع إعادة المحاولة ─────────────────
function sendToThermalPrinter(ip, port, buffer, timeoutMs, retries = 2) {
  return new Promise((resolve, reject) => {
    function attempt(left) {
      const client = new net.Socket();
      let done = false;
      const finish = (err) => {
        if (done) return;
        done = true;
        client.destroy();
        if (err && left > 0) {
          console.warn(`[Retry] محاولة أخرى (${left} محاولات متبقية) → ${ip}:${port}`);
          setTimeout(() => attempt(left - 1), 500);
        } else if (err) {
          reject(err);
        } else {
          resolve();
        }
      };

      client.setTimeout(timeoutMs || TIMEOUT);
      client.on('error',   (err) => finish(err));
      client.on('timeout', ()    => finish(new Error(`انتهت مهلة الاتصال بـ ${ip}:${port} (${timeoutMs || TIMEOUT}ms)`)));
      client.connect(Number(port), ip, () => {
        client.write(buffer, (err) => {
          if (err) return finish(err);
          // انتظر 1000ms لضمان استلام الطابعة لجميع البيانات قبل إغلاق الاتصال
          setTimeout(() => finish(null), 1000);
        });
      });
    }
    attempt(retries);
  });
}

// ── اختبار TCP بدون إرسال بيانات ─────────────────────────────────────────────
function testTCPConnection(ip, port, timeoutMs) {
  return new Promise((resolve) => {
    if (!ip || ip.trim() === '') {
      return resolve({ ok: false, msg: 'لم يتم تحديد IP الطابعة' });
    }
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

// ── اختبار جميع الطابعات المهيأة ──────────────────────────────────────────────
async function testAllPrinters() {
  const results = {};
  for (const [role, cfg] of Object.entries(PRINTERS)) {
    if (!cfg.ip) {
      results[role] = { ok: false, msg: 'غير مهيأ', ip: '', port: cfg.port };
      continue;
    }
    const r = await testTCPConnection(cfg.ip, cfg.port, 3000);
    results[role] = { ok: r.ok, msg: r.msg, ip: cfg.ip, port: cfg.port, label: cfg.label };
  }
  return results;
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

// ── HTML Status Page ───────────────────────────────────────────────────────────
async function buildStatusPage() {
  const results = await testAllPrinters();
  const ips = getLocalIPs();

  const rows = Object.entries(PRINTERS).map(([role, cfg]) => {
    const r = results[role] || {};
    const statusBadge = !cfg.ip
      ? `<span style="color:#888;background:#f5f5f5;padding:2px 8px;border-radius:4px;font-size:12px;">غير مهيأ</span>`
      : r.ok
        ? `<span style="color:#fff;background:#2D9B6E;padding:2px 8px;border-radius:4px;font-size:12px;">✅ متصلة</span>`
        : `<span style="color:#fff;background:#e53e3e;padding:2px 8px;border-radius:4px;font-size:12px;">❌ لا تستجيب</span>`;

    return `<tr>
      <td style="padding:10px 14px;font-weight:bold;">${cfg.label}</td>
      <td style="padding:10px 14px;font-family:monospace;">${cfg.ip || '—'}</td>
      <td style="padding:10px 14px;font-family:monospace;">${cfg.port}</td>
      <td style="padding:10px 14px;font-family:monospace;font-size:11px;color:#666;">${cfg.mac || '—'}</td>
      <td style="padding:10px 14px;">${statusBadge}</td>
    </tr>`;
  }).join('');

  const urlLinks = ips.map(ip => `<li><a href="http://${ip}:${PORT}" style="color:#2D9B6E;">http://${ip}:${PORT}</a></li>`).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QIROX Print Relay v${VERSION}</title>
  <meta http-equiv="refresh" content="10">
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background:#f0f4f8; color:#1a202c; direction:rtl; }
    .container { max-width:800px; margin:0 auto; padding:20px; }
    .header { background:linear-gradient(135deg,#1a202c,#2D9B6E); color:#fff; padding:24px; border-radius:12px; margin-bottom:20px; }
    .header h1 { font-size:22px; margin-bottom:4px; }
    .header p { opacity:0.8; font-size:13px; }
    .card { background:#fff; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.08); overflow:hidden; margin-bottom:16px; }
    .card-title { background:#f7fafc; padding:12px 16px; font-weight:700; font-size:14px; border-bottom:1px solid #e2e8f0; color:#2d3748; }
    table { width:100%; border-collapse:collapse; }
    th { background:#f7fafc; padding:10px 14px; font-size:12px; color:#718096; text-align:right; border-bottom:1px solid #e2e8f0; }
    td { border-bottom:1px solid #f0f4f8; }
    tr:last-child td { border-bottom:none; }
    .badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:12px; }
    .url-list { padding:12px 16px; }
    .url-list li { margin:4px 0; font-size:13px; }
    .info-box { padding:12px 16px; font-size:12px; color:#718096; line-height:1.7; }
    .refresh { font-size:11px; color:#a0aec0; text-align:center; padding:8px; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>🖨️ QIROX Print Relay Agent v${VERSION}</h1>
    <p>وكيل الطباعة المحلي — يعمل على منفذ ${PORT} — يتحدّث تلقائياً كل 10 ثوانٍ</p>
  </div>

  <div class="card">
    <div class="card-title">حالة الطابعات (ProPos PP9000E)</div>
    <table>
      <thead>
        <tr>
          <th>الطابعة</th>
          <th>IP</th>
          <th>البورت</th>
          <th>MAC</th>
          <th>الحالة</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="card">
    <div class="card-title">روابط الوكيل (أدخل أحدها في إعدادات الطابعة)</div>
    <ul class="url-list">
      ${urlLinks || `<li><a href="http://localhost:${PORT}" style="color:#2D9B6E;">http://localhost:${PORT}</a></li>`}
    </ul>
  </div>

  <div class="card">
    <div class="card-title">Endpoints المتاحة</div>
    <div class="info-box">
      <b>POST /print</b> — إرسال بيانات ESC/POS للطبعة<br>
      &nbsp;&nbsp;{ "role": "customer" | "kitchen1" | "kitchen2", "data": "base64..." }<br>
      &nbsp;&nbsp;أو: { "ip": "192.168.x.x", "port": 9100, "data": "base64..." }<br><br>
      <b>POST /test</b> — اختبار اتصال الطابعة<br>
      &nbsp;&nbsp;{ "role": "customer" | "kitchen1" | "kitchen2" }<br>
      &nbsp;&nbsp;أو: { "ip": "192.168.x.x", "port": 9100 }<br><br>
      <b>GET /status</b> — حالة الوكيل (JSON)<br>
      <b>GET /</b> — هذه الصفحة (HTML)
    </div>
  </div>

  <p class="refresh">آخر تحديث: ${new Date().toLocaleTimeString('ar-SA')} — الصفحة تتحدث كل 10 ثوانٍ تلقائياً</p>
</div>
</body>
</html>`;
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  addCORSHeaders(res);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url.split('?')[0];

  // ── GET / ─ صفحة الحالة HTML ─────────────────────────────────────────────
  if (req.method === 'GET' && url === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.writeHead(200);
    res.end(await buildStatusPage());
    return;
  }

  // كل النقاط الباقية تُعيد JSON
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // ── GET /status ─ حالة JSON ───────────────────────────────────────────────
  if (req.method === 'GET' && url === '/status') {
    res.writeHead(200);
    res.end(JSON.stringify({
      ok:       true,
      status:   'running',
      name:     'QIROX Print Relay Agent',
      version:  VERSION,
      port:     PORT,
      localIPs: getLocalIPs(),
      printers: PRINTERS,
      uptime:   Math.round(process.uptime()),
    }));
    return;
  }

  // ── POST /print ─ إرسال ESC/POS للطابعة ──────────────────────────────────
  if (req.method === 'POST' && url === '/print') {
    try {
      const body = JSON.parse(await readBody(req));

      if (!body.data) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'حقل "data" (base64) مطلوب' }));
        return;
      }

      // تحديد IP الطابعة: إما عن طريق الدور (role) أو مباشرة
      let ip, port;
      if (body.role && PRINTERS[body.role]) {
        const cfg = PRINTERS[body.role];
        ip   = body.ip   || cfg.ip;
        port = body.port || cfg.port;
        if (!ip) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: `طابعة "${body.role}" غير مهيأة — أضف IP في ملف print-relay.js` }));
          return;
        }
      } else {
        ip   = body.ip   || PRINTERS.customer.ip;
        port = body.port || 9100;
      }

      const buffer = Buffer.from(body.data, 'base64');
      const tmo    = body.timeout || TIMEOUT;
      const ts     = new Date().toLocaleTimeString('ar-SA');
      const role   = body.role || 'direct';
      console.log(`[${ts}] 🖨  [${role}] طباعة ${buffer.length} bytes → ${ip}:${port}`);

      await sendToThermalPrinter(ip, port, buffer, tmo);

      console.log(`[${new Date().toLocaleTimeString('ar-SA')}] ✅ [${role}] تمت الطباعة بنجاح → ${ip}:${port}`);
      res.writeHead(200);
      res.end(JSON.stringify({
        success:   true,
        message:   `✅ تمت الطباعة [${role}] على ${ip}:${port}`,
        role,
        bytes:     buffer.length,
        timestamp: new Date().toISOString(),
      }));
    } catch (err) {
      console.error(`[${new Date().toLocaleTimeString('ar-SA')}] ❌ فشل الإرسال:`, err.message);
      res.writeHead(503);
      res.end(JSON.stringify({
        success: false,
        error:   err.message || 'فشل الاتصال بالطابعة',
        hint:    'تأكد أن الطابعة متصلة بالكهرباء وبالشبكة ومضاءة (غير في وضع standby)',
      }));
    }
    return;
  }

  // ── POST /test ─ اختبار الاتصال بدون طباعة ────────────────────────────────
  if (req.method === 'POST' && url === '/test') {
    try {
      const body = JSON.parse(await readBody(req));

      let ip, port, label;
      if (body.role && PRINTERS[body.role]) {
        const cfg = PRINTERS[body.role];
        ip    = body.ip   || cfg.ip;
        port  = body.port || cfg.port;
        label = cfg.label;
      } else {
        ip    = body.ip   || '';
        port  = body.port || 9100;
        label = `${ip}:${port}`;
      }

      const result = await testTCPConnection(ip, port, 5000);
      res.writeHead(result.ok ? 200 : 503);
      res.end(JSON.stringify({
        success: result.ok,
        message: result.msg,
        ip, port, label,
        model: 'ProPos PP9000E',
      }));
    } catch (err) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found', routes: ['/', '/status', '/print', '/test'] }));
});

// ── تشغيل السيرفر ─────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', async () => {
  const ips = getLocalIPs();
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║      QIROX Print Relay Agent v' + VERSION + ' — وكيل الطباعة المتعدد       ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log('║  طابعة العميل  : 192.168.3.22   MAC: 28-0e-8b-36-55-0a         ║');
  console.log('║  طابعة مطبخ 1  : 192.168.1.114  MAC: 28-0e-8b-c9-66-d2         ║');
  console.log('║  طابعة مطبخ 2  : (غير محدد — عدّل PRINTERS في الملف)           ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log('║  روابط الوكيل — أدخل أحدها في إعدادات الطابعة:                 ║');
  for (const ip of ips) {
    const url  = `http://${ip}:${PORT}`;
    const line = `║    ${url}`;
    console.log(line.padEnd(67) + '║');
  }
  if (ips.length === 0) {
    console.log(`║    http://localhost:${PORT}`.padEnd(67) + '║');
  }
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log('║  صفحة الحالة: افتح الرابط في المتصفح للتحقق من حالة الطابعات  ║');
  console.log('║  الحالة : يعمل ✅  —  في انتظار طلبات الطباعة...               ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  // اختبار تلقائي لجميع الطابعات عند التشغيل
  console.log('  🔍 جارٍ اختبار الاتصال بجميع الطابعات...');
  const results = await testAllPrinters();
  for (const [role, r] of Object.entries(results)) {
    const cfg = PRINTERS[role];
    if (!cfg.ip) {
      console.log(`  ⚪ [${role}] ${cfg.label} — غير مهيأ`);
    } else if (r.ok) {
      console.log(`  ✅ [${role}] ${cfg.label} (${cfg.ip}) — متصلة وتستجيب`);
    } else {
      console.log(`  ❌ [${role}] ${cfg.label} (${cfg.ip}) — لا تستجيب! تأكد من التوصيل`);
    }
  }
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
