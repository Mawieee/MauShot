@echo off
cd /d "%~dp0"
powershell -Command "Start-Process npm -ArgumentList 'start' -Verb RunAs"
