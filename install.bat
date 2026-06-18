@echo off
chcp 65001 >nul
title TradePilot 安装程序

echo.
echo ╔══════════════════════════════════════════╗
echo ║          TradePilot 安装程序              ║
echo ║     AI 外贸跟单管理系统 · 开源版           ║
echo ╚══════════════════════════════════════════╝
echo.

REM Check if Docker is installed
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] Docker 未安装
    echo.
    echo 请先安装 Docker Desktop for Windows:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)
echo [OK] Docker 已就绪

REM Check Docker Compose
docker compose version >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] Docker Compose 未安装，正在尝试安装...
    docker run --rm -v %CD%:/app node:20-alpine npm install -g docker-compose
)

REM Pull and start
echo.
echo [1/3] 正在启动 TradePilot...
mkdir "%USERPROFILE%\.tradepilot" 2>nul

REM Write docker-compose.yml
set "COMPOSE_FILE=%USERPROFILE%\.tradepilot\docker-compose.yml"
echo version: "3.8"> "%COMPOSE_FILE%"
echo services:>> "%COMPOSE_FILE%"
echo   tradepilot:>> "%COMPOSE_FILE%"
echo     image: node:20-alpine>> "%COMPOSE_FILE%"
echo     container_name: tradepilot>> "%COMPOSE_FILE%"
echo     ports:>> "%COMPOSE_FILE%"
echo       - "3456:3456">> "%COMPOSE_FILE%"
echo     working_dir: /app>> "%COMPOSE_FILE%"
echo     volumes:>> "%COMPOSE_FILE%"
echo       - %USERPROFILE%\.tradepilot\data:/app/data>> "%COMPOSE_FILE%"
echo     environment:>> "%COMPOSE_FILE%"
echo       - NODE_ENV=production>> "%COMPOSE_FILE%"
echo       - PORT=3456>> "%COMPOSE_FILE%"
echo     restart: unless-stopped>> "%COMPOSE_FILE%"

cd /d "%USERPROFILE%\.tradepilot"
docker compose up -d 2>nul || docker-compose up -d 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] 启动失败
    pause
    exit /b 1
)

echo [2/3] 等待启动完成...
timeout /t 5 /nobreak >nul

echo [3/3] 部署完成！
echo.
echo ============================================
echo   TradePilot 部署成功！
echo ============================================
echo.
echo   访问地址: http://localhost:3456
echo.
echo   管理命令:
echo     docker compose logs -f   查看日志
echo     docker compose restart   重启
echo     docker compose down      停止
echo.
echo   按任意键退出...
pause >nul
