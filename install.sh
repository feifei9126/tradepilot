#!/bin/bash
set -e
echo ""
echo "============================================"
echo "  TradePilot - 外贸管理软件 一键安装脚本"
echo "============================================"
echo ""

# Check Docker
if ! command -v docker &>/dev/null; then
  echo "[1/3] 正在安装 Docker..."
  curl -fsSL https://get.docker.com | bash
  sudo usermod -aG docker $USER
  echo "  ✅ Docker 已安装"
else
  echo "[1/3] ✅ Docker 已就绪"
fi

# Check Docker Compose
if ! docker compose version &>/dev/null; then
  echo "  正在安装 Docker Compose..."
  sudo apt-get install -y docker-compose-plugin 2>/dev/null || true
fi

# Start TradePilot
echo "[2/3] 启动 TradePilot..."
docker compose up -d --build 2>/dev/null || docker-compose up -d --build 2>/dev/null

# Wait for startup
echo "[3/3] 等待启动完成..."
sleep 5

echo ""
echo "============================================"
echo "  🎉 TradePilot 部署成功！"
echo "============================================"
echo ""
echo "  访问地址: http://localhost:3456"
echo ""
echo "  管理命令:"
echo "    docker compose logs -f   查看日志"
echo "    docker compose restart   重启服务"
echo "    docker compose down      停止服务"
echo ""
echo "  如果部署在云服务器，请用 http://服务器IP:3456 访问"
echo "============================================"
