@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title The-Called — Dev Server
cd /d "%~dp0"

set "BASE_PORT=4174"
set "MAX_TRIES=50"
set "PORT="

if not exist "node_modules\vite\package.json" (
    echo [提示] 未检测到依赖，正在执行 npm install...
    call npm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败。
        pause
        exit /b 1
    )
)

set /a END_PORT=BASE_PORT+MAX_TRIES-1

REM 从 BASE_PORT 起查找第一个未被占用的端口
for /L %%P in (%BASE_PORT%,1,%END_PORT%) do (
    set "CAND=%%P"
    set "BUSY=0"
    for /f "delims=" %%L in ('netstat -ano -p tcp 2^>nul ^| findstr "LISTENING" ^| findstr /C:":!CAND! "') do set "BUSY=1"
    if "!BUSY!"=="0" (
        set "PORT=!CAND!"
        goto :port_found
    )
)

echo [错误] 在 %BASE_PORT% 起 %MAX_TRIES% 个端口内未找到可用端口。
pause
exit /b 1

:port_found
if not "%PORT%"=="%BASE_PORT%" (
    echo [端口] 默认端口 %BASE_PORT% 已被占用，已切换到 %PORT%
) else (
    echo [端口] 使用默认端口 %PORT%
)

echo [启动] 开发服务器启动后将自动打开默认浏览器...
echo [地址] http://localhost:%PORT%/
echo.

call npx vite --config vite.config.ts --host 0.0.0.0 --port %PORT% --strictPort --open

if errorlevel 1 (
    echo.
    echo [错误] 开发服务器异常退出。
    pause
    exit /b 1
)

endlocal
