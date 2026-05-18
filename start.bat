@echo off
chcp 65001 >nul 2>&1
title 浮生�?- Start Services

echo ============================================
echo     浮生�?- Quick Start
echo ============================================
echo.

:: Check Python
where py >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.10+
    goto :end
)

:: Install deps
echo [1/3] Installing backend dependencies...
py -m pip install -r "%~dp0requirements.txt" -q 2>nul
echo       Done.

:: Start backend
echo [2/3] Starting backend on port 8000...
start "浮生�?Backend" cmd /k "cd /d %~dp0 && py -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak >nul

:: Check Node
where node >nul 2>&1
if %errorlevel% equ 0 (
    echo [3/3] Node.js found. Starting React frontend on port 3000...
    cd /d "%~dp0frontend"
    if not exist node_modules (
        echo       First run - installing npm packages...
        call npm install 2>nul
    )
    start "浮生�?Frontend" cmd /k "cd /d %~dp0frontend && npx next dev -p 3000"
    cd /d "%~dp0"
    echo.
    echo   React Frontend : http://localhost:3000
) else (
    echo [3/3] Node.js not found, skipping React frontend.
    echo   Open frontend\index.html in your browser.
)

echo.
echo ============================================
echo   Services started!
echo.
echo   Backend API    : http://localhost:8000/docs
echo   Health Check   : http://localhost:8000/health
echo   HTML Version   : Open frontend\index.html in browser
echo.
echo   Close this window will NOT stop services.
echo   Close the corresponding cmd windows to stop.
echo ============================================

:end
echo.
pause
