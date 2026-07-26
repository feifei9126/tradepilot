@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title TradePilot PostgreSQL 安装程序

cd /d "%~dp0"
if not defined TRADEPILOT_ENV_FILE set "TRADEPILOT_ENV_FILE=%CD%\.env"
set "ENV_FILE=%TRADEPILOT_ENV_FILE%"
if not defined PORT set "PORT=3456"
if not defined TRADEPILOT_INSTALL_TEST_MODE set "TRADEPILOT_INSTALL_TEST_MODE=false"
if not exist "%ENV_FILE%" type nul > "%ENV_FILE%"

call :read_env AUTH_SECRET AUTH_SECRET
if not defined AUTH_SECRET (
    call :random_hex 32 AUTH_SECRET
    call :set_env AUTH_SECRET "%%AUTH_SECRET%%"
    echo [INFO] 已生成随机 AUTH_SECRET。
) else if /I "%AUTH_SECRET%"=="replace-with-openssl-rand-hex-32" (
    call :random_hex 32 AUTH_SECRET
    call :set_env AUTH_SECRET "%%AUTH_SECRET%%"
)

call :read_env POSTGRES_PASSWORD POSTGRES_PASSWORD
if not defined POSTGRES_PASSWORD (
    call :random_hex 24 POSTGRES_PASSWORD
    call :set_env POSTGRES_PASSWORD "%%POSTGRES_PASSWORD%%"
    echo [INFO] 已生成随机 PostgreSQL 密码。
) else if /I "%POSTGRES_PASSWORD%"=="replace-with-a-random-postgres-password" (
    call :random_hex 24 POSTGRES_PASSWORD
    call :set_env POSTGRES_PASSWORD "%%POSTGRES_PASSWORD%%"
)

call :read_env TRADEPILOT_ADMIN_EMAIL ADMIN_EMAIL
if not defined ADMIN_EMAIL (
    set "ADMIN_EMAIL=admin@tradepilot.local"
    call :set_env TRADEPILOT_ADMIN_EMAIL "%%ADMIN_EMAIL%%"
)

call :read_env TRADEPILOT_ADMIN_PASSWORD ADMIN_PASSWORD
if not defined ADMIN_PASSWORD goto :generate_admin_password
if /I "%ADMIN_PASSWORD%"=="password" goto :generate_admin_password
if /I "%ADMIN_PASSWORD%"=="replace-with-a-strong-password" goto :generate_admin_password
goto :admin_password_ready

:generate_admin_password
call :random_hex 12 ADMIN_PASSWORD
call :set_env TRADEPILOT_ADMIN_PASSWORD "%ADMIN_PASSWORD%"
echo [INFO] 已生成随机管理员密码。

:admin_password_ready
call :read_env TRADEPILOT_SEED_DEMO SEED_DEMO
if not defined SEED_DEMO call :set_env TRADEPILOT_SEED_DEMO "false"
call :read_env PORT ENV_PORT
if not defined ENV_PORT call :set_env PORT "%PORT%"
call :read_env AUTH_URL AUTH_URL
if not defined AUTH_URL call :set_env AUTH_URL "http://localhost:%PORT%"

if /I "%TRADEPILOT_INSTALL_TEST_MODE%"=="true" (
    echo docker compose config --quiet
    echo docker compose build db-init
    echo docker compose up -d postgres
    echo docker compose run --rm db-init
    echo docker compose up -d --build tradepilot video-worker
    echo [INFO] 安装测试模式完成；未调用 Docker 或网络。
    exit /b 0
)

where docker >nul 2>nul
if errorlevel 1 (
    echo [ERROR] 未检测到 Docker，请先安装并启动 Docker Desktop。
    exit /b 1
)
docker info >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Docker Desktop 尚未启动。
    exit /b 1
)
docker compose version >nul 2>nul
if errorlevel 1 (
    echo [ERROR] 当前 Docker 缺少 Compose 插件。
    exit /b 1
)

icacls "%ENV_FILE%" /inheritance:r /grant:r "%USERNAME%:F" >nul 2>nul

echo [INFO] 校验 Docker Compose 配置...
docker compose --env-file "%ENV_FILE%" config --quiet || exit /b 1
echo [INFO] 构建数据库初始化镜像...
docker compose --env-file "%ENV_FILE%" build db-init || exit /b 1
echo [INFO] 启动 PostgreSQL...
docker compose --env-file "%ENV_FILE%" up -d postgres || exit /b 1
echo [INFO] 执行数据库迁移和管理员初始化...
docker compose --env-file "%ENV_FILE%" run --rm db-init || exit /b 1
echo [INFO] 启动 TradePilot 和视频 Worker...
docker compose --env-file "%ENV_FILE%" up -d --build tradepilot video-worker || exit /b 1

echo [INFO] 等待 TradePilot 健康检查...
for /L %%I in (1,1,90) do (
    curl.exe --fail --silent "http://127.0.0.1:%PORT%/api/health" >nul 2>nul && goto :healthy
    timeout /t 2 /nobreak >nul
)
docker compose --env-file "%ENV_FILE%" ps
docker compose --env-file "%ENV_FILE%" logs --tail=100 postgres db-init tradepilot
echo [ERROR] TradePilot 未通过健康检查，请查看上方日志。
exit /b 1

:healthy
echo.
echo TradePilot 已启动：http://localhost:%PORT%
echo 管理员账号：%ADMIN_EMAIL%
echo 管理员密码：%ADMIN_PASSWORD%
echo 查看日志：docker compose --env-file "%ENV_FILE%" logs -f
if /I not "%TRADEPILOT_NON_INTERACTIVE%"=="true" pause
exit /b 0

:read_env
set "%~2="
if not exist "%ENV_FILE%" exit /b 0
for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
    if /I "%%A"=="%~1" set "%~2=%%B"
)
exit /b 0

:set_env
set "TP_ENV_FILE=%ENV_FILE%"
set "TP_KEY=%~1"
set "TP_VALUE=%~2"
powershell -NoProfile -Command "$p=$env:TP_ENV_FILE; $k=$env:TP_KEY; $v=$env:TP_VALUE; $lines=if(Test-Path -LiteralPath $p){@(Get-Content -LiteralPath $p)}else{@()}; $found=$false; $next=@($lines | ForEach-Object { if($_.StartsWith($k+'=')){ $found=$true; $k+'='+$v } else { $_ } }); if(-not $found){ $next += $k+'='+$v }; [IO.File]::WriteAllLines($p,$next,(New-Object Text.UTF8Encoding($false)))" >nul
if errorlevel 1 exit /b 1
exit /b 0

:random_hex
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "$bytes=New-Object byte[] %~1; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [BitConverter]::ToString($bytes).Replace('-','').ToLowerInvariant()"`) do set "%~2=%%A"
call set "GENERATED=%%%~2%%"
if not defined GENERATED (
    echo [ERROR] PowerShell 无法生成安全随机密钥。
    exit /b 1
)
exit /b 0
