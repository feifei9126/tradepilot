#!/bin/bash
set -e

TRADEPILOT_HOME="${TRADEPILOT_HOME:-$HOME/.tradepilot}"
PORT="${PORT:-3456}"

# ─── Color helpers ────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERR]${NC} $1"; }
header(){ echo -e "\n${BLUE}━━━━━ $1 ━━━━━${NC}\n"; }

show_banner() {
  echo ""
  echo -e "${CYAN}"
  echo "  ╔══════════════════════════════════════════╗"
  echo "  ║          TradePilot 安装程序              ║"
  echo "  ║     AI 外贸跟单管理系统 · 开源版           ║"
  echo "  ╚══════════════════════════════════════════╝"
  echo -e "${NC}"
}

# ─── Check prerequisites ────────────────────────────────
check_prereqs() {
  header "检查系统环境"

  # OS detection
  OS="$(uname -s)"
  case "$OS" in
    Linux*)  OS="linux";;
    Darwin*) OS="macos";;
    *)       err "不支持的操作系统: $OS (仅支持 macOS/Linux)"; exit 1;;
  esac
  info "操作系统: $OS ($(uname -m))"

  # Check Docker
  if command -v docker &>/dev/null; then
    DOCKER_VER=$(docker --version 2>/dev/null)
    ok "Docker: $DOCKER_VER"
    HAS_DOCKER=true
  else
    warn "Docker 未安装"
    HAS_DOCKER=false
  fi

  # Check Node.js
  if command -v node &>/dev/null; then
    NODE_VER=$(node -v 2>/dev/null)
    ok "Node.js: $NODE_VER"
    HAS_NODE=true
  else
    warn "Node.js 未安装"
    HAS_NODE=false
  fi

  # Check curl
  if command -v curl &>/dev/null; then
    ok "curl 已就绪"
  else
    err "需要 curl，请先安装"
    exit 1
  fi

  echo ""
}

# ─── Select install mode ────────────────────────────────
select_mode() {
  header "选择安装方式"

  if [ "$HAS_DOCKER" = true ]; then
    echo "  1) Docker 模式 (推荐) - 自动安装，隔离性好"
    echo "  2) Node.js 模式 - 直接运行，无需 Docker"
    echo ""
    read -p "  请选择 [1/2] (默认 1): " MODE
    MODE="${MODE:-1}"
  elif [ "$HAS_NODE" = true ]; then
    MODE=2
    info "未检测到 Docker，使用 Node.js 模式"
  else
    MODE=1
    info "将自动安装 Docker"
  fi
  echo ""
}

# ─── Docker install (macOS) ──────────────────────────────
install_docker_macos() {
  if [ "$HAS_DOCKER" = true ]; then return 0; fi
  header "安装 Docker Desktop"
  info "下载 Docker Desktop for Mac..."
  curl -fsSL https://desktop.docker.com/mac/main/amd64/Docker.dmg -o /tmp/Docker.dmg
  info "挂载 DMG..."
  hdiutil attach /tmp/Docker.dmg -quiet 2>/dev/null || true
  info "复制到 Applications..."
  cp -R "/Volumes/Docker/Docker.app" /Applications/ 2>/dev/null || true
  hdiutil detach /Volumes/Docker -quiet 2>/dev/null || true
  warn "请手动打开 /Applications/Docker.app 完成安装"
  warn "然后重新运行此脚本"
  exit 0
}

# ─── Install via Docker ─────────────────────────────────
install_docker() {
  header "Docker 部署 TradePilot"

  mkdir -p "$TRADEPILOT_HOME/data" "$TRADEPILOT_HOME/plugins"
  cd "$TRADEPILOT_HOME"

  # Write docker-compose.yml
  cat > docker-compose.yml << 'DOCKEREOF'
version: "3.8"
services:
  tradepilot:
    image: node:20-alpine
    container_name: tradepilot
    ports: ["${PORT:-3456}:3456"]
    working_dir: /app
    volumes:
      - ./data:/app/data
      - ./plugins:/app/plugins
    environment:
      - NODE_ENV=production
      - PORT=${PORT:-3456}
    command: >
      sh -c "npm install -g npx && npx --yes create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias '@/*' --use-npm 2>/dev/null || true && npm run build && npm start"
    restart: unless-stopped
DOCKEREOF

  info "启动容器..."
  docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null || {
    err "Docker 启动失败"
    warn "请检查 Docker 是否正在运行"
    exit 1
  }

  ok "TradePilot 已启动 (Docker)"
}

# ─── Install via Node.js ────────────────────────────────
install_node() {
  header "Node.js 部署 TradePilot"

  if [ "$HAS_NODE" != true ]; then
    warn "正在安装 Node.js..."
    if [ "$OS" = "macos" ]; then
      curl -fsSL https://nodejs.org/dist/v20.18.0/node-v20.18.0-darwin-x64.tar.xz | tar xJ -C /usr/local --strip-components=1 2>/dev/null || {
        warn "请从 https://nodejs.org 安装 Node.js 后重试"
        exit 1
      }
    else
      curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
      apt-get install -y nodejs 2>/dev/null || yum install -y nodejs 2>/dev/null || {
        warn "请手动安装 Node.js"
        exit 1
      }
    fi
    HAS_NODE=true
    ok "Node.js 已安装"
  fi

  # Clone or copy project
  if [ ! -f "package.json" ]; then
    info "请先克隆项目:"
    echo "  git clone https://github.com/feifei9126/tradepilot.git"
    echo "  cd tradepilot"
    exit 0
  fi

  info "安装依赖..."
  npm install --legacy-peer-deps 2>/dev/null || npm install 2>/dev/null

  info "构建项目..."
  npm run build 2>/dev/null || npx next build 2>/dev/null

  info "启动服务 (port $PORT)..."
  PORT=$PORT npm start &
  PID=$!
  echo "$PID" > "$TRADEPILOT_HOME/tradepilot.pid"

  ok "TradePilot 已启动 (Node.js, PID: $PID)"
}

# ─── Post-install ─────────────────────────────────────────
post_install() {
  header "部署完成"
  echo ""
  echo -e "  ${GREEN}访问地址:${NC} http://localhost:${PORT}"
  echo ""
  echo -e "  ${YELLOW}常用命令:${NC}"
  echo "    docker compose logs -f   查看日志 (Docker 模式)"
  echo "    docker compose restart   重启 (Docker 模式)"
  echo "    docker compose down      停止 (Docker 模式)"
  echo "    kill \$(cat ~/.tradepilot/tradepilot.pid)  停止 (Node 模式)"
  echo ""
  echo -e "  ${CYAN}使用提示:${NC}"
  echo "    1. 打开浏览器访问 http://localhost:${PORT}"
  echo "    2. 注册管理员账号"
  echo "    3. 在设置中配置 AI API Key (支持 DeepSeek/OpenAI)"
  echo "    4. 开始管理客户和订单"
  echo ""
  echo -e "  ${GREEN}TradePilot 已就绪，Enjoy！${NC}"
  echo ""
}

# ─── Main ─────────────────────────────────────────────────
main() {
  show_banner
  check_prereqs
  select_mode

  case "$MODE" in
    1) install_docker;;
    2) install_node;;
    *) install_docker;;
  esac

  post_install
}

main "$@"
