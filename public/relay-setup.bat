@echo off
chcp 65001 >nul 2>&1
title QIROX - وكيل الطباعة

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║        QIROX - وكيل الطباعة المحلي          ║
echo  ║     Local Print Relay - Auto Setup           ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: ── Check if Node.js is installed ──────────────────────────────────────
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [1/3] Node.js غير مثبت — جارٍ التحميل التلقائي...
    echo        Downloading Node.js automatically...
    echo.

    :: Download Node.js portable (no admin, no installer)
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip' -OutFile 'node_portable.zip' -UseBasicParsing; Write-Host '  Downloaded.'"

    if not exist node_portable.zip (
        echo  [!] فشل التحميل — تحقق من اتصال الانترنت
        echo      Download failed — check your internet connection
        pause
        exit /b 1
    )

    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "Expand-Archive -Path 'node_portable.zip' -DestinationPath '.' -Force; Write-Host '  Extracted.'"

    del node_portable.zip >nul 2>&1
    set "NODE_EXE=%~dp0node-v20.11.1-win-x64\node.exe"
    echo  [✓] Node.js جاهز
) else (
    set "NODE_EXE=node"
    echo  [✓] Node.js مثبت مسبقاً
)

echo.

:: ── Download print-relay.js if not already here ─────────────────────────
if exist print-relay.js (
    echo  [✓] print-relay.js موجود مسبقاً
) else (
    echo  [2/3] جارٍ تحميل وكيل الطباعة...
    echo        Downloading relay script...

    :: Try to get the server URL from user, or use a default
    set "RELAY_SCRIPT_URL=https://42bfc368-d4c3-410a-a62c-3ca082165bdd-00-34f7ygfgc39ff.riker.replit.dev/print-relay.js"

    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "try { Invoke-WebRequest -Uri '%RELAY_SCRIPT_URL%' -OutFile 'print-relay.js' -UseBasicParsing; Write-Host '  Downloaded.' } catch { Write-Host '  [!] Failed to download from server. Using bundled version.'; exit 1 }"

    if not exist print-relay.js (
        echo  [!] تعذّر التحميل — سيتم استخدام النسخة المدمجة
        call :write_bundled_relay
    )
    echo  [✓] وكيل الطباعة جاهز
)

echo.
echo  [3/3] تشغيل وكيل الطباعة...
echo        Starting print relay...
echo.

:: ── Add to Windows startup (auto-start on boot) ─────────────────────────
set "STARTUP_KEY=HKCU\Software\Microsoft\Windows\CurrentVersion\Run"
set "THIS_BAT=%~f0"
reg add "%STARTUP_KEY%" /v "QIROXPrintRelay" /t REG_SZ /d "\"%THIS_BAT%\"" /f >nul 2>&1
echo  [✓] سيبدأ تلقائياً مع تشغيل الويندوز
echo      Will auto-start with Windows from now on
echo.

:: ── Start the relay ──────────────────────────────────────────────────────
echo  ════════════════════════════════════════════════
echo.
echo  الوكيل يعمل الآن! اتبع الخطوات:
echo  Relay is running! Follow these steps:
echo.
echo  1. اذهب لإعدادات الطابعة في النظام
echo     Go to Printer Settings in the system
echo.
echo  2. اختر وضع: وكيل محلي
echo     Select mode: Local Relay
echo.
echo  3. ادخل رابط الوكيل (IP هذا الجهاز):
echo     Enter relay URL (this device IP):
echo.
echo     انظر السطر التالي بعد التشغيل ↓
echo     Look at the line below after launch ↓
echo.
echo  ════════════════════════════════════════════════
echo.
echo  لإيقاف الوكيل: أغلق هذه النافذة
echo  To stop relay: close this window
echo.

:: Keep window visible
%NODE_EXE% print-relay.js
pause
exit /b 0

:write_bundled_relay
:: Minimal bundled relay in case download fails
(
echo const http = require('http'^);
echo const net = require('net'^);
echo const os = require('os'^);
echo.
echo const PORT = process.env.PORT ^|^| 8089;
echo.
echo const ifaces = os.networkInterfaces(^);
echo const ips = [];
echo Object.values(ifaces^).flat(^).filter(i =^> i.family === 'IPv4' ^&^& !i.internal^).forEach(i =^> ips.push(i.address^)^);
echo.
echo const server = http.createServer((req, res^) =^> {
echo   res.setHeader('Access-Control-Allow-Origin', '*'^);
echo   res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS'^);
echo   res.setHeader('Access-Control-Allow-Headers', 'Content-Type'^);
echo   if (req.method === 'OPTIONS'^) { res.writeHead(204^); return res.end(^); }
echo   if (req.method === 'GET' ^&^& req.url === '/health'^) {
echo     res.writeHead(200, {'Content-Type': 'application/json'}^);
echo     return res.end(JSON.stringify({ ok: true, ips }^)^);
echo   }
echo   if (req.method === 'POST' ^&^& req.url === '/print'^) {
echo     let body = '';
echo     req.on('data', c =^> body += c^);
echo     req.on('end', (^) =^> {
echo       try {
echo         const { data, ip, port } = JSON.parse(body^);
echo         const buf = Buffer.from(data, 'base64'^);
echo         const sock = new net.Socket(^);
echo         sock.setTimeout(5000^);
echo         sock.connect(port ^|^| 9100, ip, (^) =^> {
echo           sock.write(buf^);
echo           sock.end(^);
echo           res.writeHead(200, {'Content-Type': 'application/json'}^);
echo           res.end(JSON.stringify({ ok: true }^)^);
echo         }^);
echo         sock.on('error', e =^> {
echo           res.writeHead(502, {'Content-Type': 'application/json'}^);
echo           res.end(JSON.stringify({ ok: false, error: e.message }^)^);
echo         }^);
echo       } catch(e^) {
echo         res.writeHead(400, {'Content-Type': 'application/json'}^);
echo         res.end(JSON.stringify({ ok: false, error: e.message }^)^);
echo       }
echo     }^);
echo     return;
echo   }
echo   res.writeHead(404^); res.end(^);
echo }^);
echo.
echo server.listen(PORT, '0.0.0.0', (^) =^> {
echo   console.log('\n  ╔══════════════════════════════════════╗'^);
echo   console.log('  ║   QIROX Print Relay - يعمل ✓         ║'^);
echo   console.log('  ╚══════════════════════════════════════╝'^);
echo   console.log('\n  روابط الوكيل / Relay URLs:'^);
echo   ips.forEach(ip =^> console.log(`  → http://${ip}:${PORT}`^)^);
echo   console.log('\n  (أدخل أحد الروابط أعلاه في إعدادات الطابعة)'^);
echo   console.log('  (Enter one of the URLs above in printer settings)\n'^);
echo }^);
) > print-relay.js
exit /b 0
