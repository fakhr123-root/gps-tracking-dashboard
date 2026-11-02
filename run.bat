@echo off
chcp 65001 >nul
title Google Maps 3D Extractor - مستخرج خرائط جوجل (رابط عالمي + محلي)
echo ======================================================================
echo 🚀 جاري تشغيل تطبيق مستخرج بيانات خرائط جوجل 3D + الرابط العالمي...
echo 🌐 العنوان المحلي: http://localhost:3000
echo 🛡️ لوحة المشرف: http://localhost:3000/admin.html
echo ======================================================================
echo.
start /b node server.js
timeout /t 2 /nobreak >nul
start http://localhost:3000
node start_tunnel.js
pause
