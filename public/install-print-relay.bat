@echo off
chcp 65001 > nul
title QIROX Print Relay — مُثبّت وكيل الطباعة

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║        QIROX Print Relay Agent — مُثبّت ويندوز              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] Node.js غير مثبّت. جارٍ فتح صفحة التحميل...
    start https://nodejs.org/en/download
    echo.
    echo بعد تثبيت Node.js، شغّل هذا الملف مجدداً.
    pause
    exit /b 1
)

echo [OK] Node.js مثبّت:
node --version
echo.

REM Check if print-relay.js exists
if not exist "%~dp0print-relay.js" (
    echo [!] ملف print-relay.js غير موجود في نفس المجلد.
    echo     حمّله من النظام: الإعدادات ^ الطابعة ^ وكيل محلي
    pause
    exit /b 1
)

echo [OK] ملف الوكيل موجود: print-relay.js
echo.

REM Ask user what to do
echo اختر خياراً:
echo   [1] تشغيل الوكيل الآن (في نافذة منفصلة)
echo   [2] تثبيت كخدمة ويندوز (يعمل تلقائياً عند بدء التشغيل)
echo   [3] إلغاء التثبيت
echo.
set /p CHOICE="أدخل رقم الاختيار (1/2/3): "

if "%CHOICE%"=="1" goto RUN_NOW
if "%CHOICE%"=="2" goto INSTALL_SERVICE
if "%CHOICE%"=="3" goto CANCEL
goto RUN_NOW

:RUN_NOW
echo.
echo جارٍ تشغيل وكيل الطباعة...
start "QIROX Print Relay" /MIN cmd /c "node "%~dp0print-relay.js" & pause"
echo.
echo [OK] تم تشغيل الوكيل في نافذة منفصلة.
echo      لا تُغلق تلك النافذة أثناء العمل.
echo.
echo انتظر 3 ثوانٍ ثم افتح المتصفح على:
timeout /t 3 /nobreak > nul
echo   http://localhost:8089
start http://localhost:8089
goto END

:INSTALL_SERVICE
echo.
REM Check if npm package node-windows is available
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] npm غير متوفر. شغّل الوكيل يدوياً بدلاً من ذلك.
    goto RUN_NOW
)

REM Install node-windows for Windows Service support
echo جارٍ تثبيت node-windows لإنشاء خدمة ويندوز...
npm install -g node-windows 2>nul

REM Create a service installer script
echo var Service = require('node-windows').Service; > "%TEMP%\qirox-svc-install.js"
echo var svc = new Service({ >> "%TEMP%\qirox-svc-install.js"
echo   name: 'QIROX Print Relay', >> "%TEMP%\qirox-svc-install.js"
echo   description: 'QIROX Local Print Relay Agent', >> "%TEMP%\qirox-svc-install.js"
echo   script: '%~dp0print-relay.js'.replace(/\\/g, '/'), >> "%TEMP%\qirox-svc-install.js"
echo   wait: 2, restarts: 10 >> "%TEMP%\qirox-svc-install.js"
echo }); >> "%TEMP%\qirox-svc-install.js"
echo svc.on('install', function() { svc.start(); console.log('Service installed and started.'); }); >> "%TEMP%\qirox-svc-install.js"
echo svc.install(); >> "%TEMP%\qirox-svc-install.js"

node "%TEMP%\qirox-svc-install.js"
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] تم تثبيت الخدمة بنجاح!
    echo      الوكيل سيعمل تلقائياً عند إعادة تشغيل الجهاز.
) else (
    echo.
    echo [!] فشل تثبيت الخدمة. جارٍ التشغيل اليدوي...
    goto RUN_NOW
)
goto END

:CANCEL
echo إلغاء العملية.
goto END

:END
echo.
echo ══════════════════════════════════════════════════
echo   للتحقق من حالة الطابعات، افتح:
echo   http://localhost:8089
echo ══════════════════════════════════════════════════
echo.
pause
