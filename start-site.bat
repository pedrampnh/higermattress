@echo off
cd /d "%~dp0"
echo در حال راه‌اندازی سایت هیگر...
start "" http://localhost:3000
npm start
