@echo off
setlocal EnableExtensions
chcp 65001 >nul
title The-Called — Dev Server
cd /d "%~dp0"

if not exist "node_modules\vite\package.json" (
    echo [提示] 未检测到依赖，正在执行 npm install...
    call npm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败。
        pause
        exit /b 1
    )
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-game.ps1"
set "EC=%ERRORLEVEL%"
if not "%EC%"=="0" (
    echo.
    echo [错误] 启动失败，错误码 %EC%。
    pause
)
exit /b %EC%
