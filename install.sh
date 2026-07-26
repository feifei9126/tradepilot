#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-3456}"
STATE_DIR="${TRADEPILOT_HOME:-$HOME/.tradepilot}"
ENV_FILE="${TRADEPILOT_ENV_FILE:-$PROJECT_DIR/.env}"
TEST_MODE="${TRADEPILOT_INSTALL_TEST_MODE:-false}"

info() { printf '[INFO] %s\n' "$1"; }
fail() { printf '[ERROR] %s\n' "$1" >&2; exit 1; }

set_env() {
  local key="$1"
  local value="$2"
  local temporary="${ENV_FILE}.tmp"
  mkdir -p "$(dirname "$ENV_FILE")"
  touch "$ENV_FILE"
  awk -v key="$key" -v value="$value" '
    index($0, key "=") == 1 { print key "=" value; found = 1; next }
    { print }
    END { if (!found) print key "=" value }
  ' "$ENV_FILE" > "$temporary"
  mv "$temporary" "$ENV_FILE"
}

read_env() {
  awk -F= -v key="$1" '
    index($0, key "=") == 1 { sub(/^[^=]*=/, ""); value=$0 }
    END { print value }
  ' "$ENV_FILE" 2>/dev/null
}

random_hex() {
  local bytes="$1"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$bytes"
  elif command -v node >/dev/null 2>&1; then
    node -e "process.stdout.write(require('node:crypto').randomBytes(Number(process.argv[1])).toString('hex'))" "$bytes"
  else
    fail "未检测到 openssl 或 Node.js，无法安全生成随机密钥。"
  fi
}

compose() {
  if [ "$TEST_MODE" = "true" ]; then
    printf 'docker compose %s\n' "$*"
  else
    docker compose --env-file "$ENV_FILE" "$@"
  fi
}

if [ "$TEST_MODE" != "true" ]; then
  command -v docker >/dev/null 2>&1 || fail "未检测到 Docker，请先安装 Docker Desktop 或 Docker Engine。"
  docker info >/dev/null 2>&1 || fail "Docker 尚未启动。"
  docker compose version >/dev/null 2>&1 || fail "当前 Docker 缺少 Compose 插件。"
fi

cd "$PROJECT_DIR"
mkdir -p "$(dirname "$ENV_FILE")" "$STATE_DIR"
touch "$ENV_FILE"

AUTH_SECRET="$(read_env AUTH_SECRET)"
if [ -z "$AUTH_SECRET" ] || [ "$AUTH_SECRET" = "replace-with-openssl-rand-hex-32" ]; then
  AUTH_SECRET="$(random_hex 32)"
  set_env "AUTH_SECRET" "$AUTH_SECRET"
  info "已生成随机 AUTH_SECRET。"
fi

POSTGRES_PASSWORD="$(read_env POSTGRES_PASSWORD)"
if [ -z "$POSTGRES_PASSWORD" ] || [ "$POSTGRES_PASSWORD" = "replace-with-a-random-postgres-password" ]; then
  POSTGRES_PASSWORD="$(random_hex 24)"
  set_env "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD"
  info "已生成随机 PostgreSQL 密码。"
fi

ADMIN_EMAIL="$(read_env TRADEPILOT_ADMIN_EMAIL)"
if [ -z "$ADMIN_EMAIL" ]; then
  ADMIN_EMAIL="admin@tradepilot.local"
  set_env "TRADEPILOT_ADMIN_EMAIL" "$ADMIN_EMAIL"
fi

ADMIN_PASSWORD="$(read_env TRADEPILOT_ADMIN_PASSWORD)"
if [ -z "$ADMIN_PASSWORD" ] || [ "$ADMIN_PASSWORD" = "password" ] || [ "$ADMIN_PASSWORD" = "replace-with-a-strong-password" ]; then
  ADMIN_PASSWORD="$(random_hex 12)"
  set_env "TRADEPILOT_ADMIN_PASSWORD" "$ADMIN_PASSWORD"
  info "已生成随机管理员密码。"
fi

if [ -z "$(read_env TRADEPILOT_SEED_DEMO)" ]; then
  set_env "TRADEPILOT_SEED_DEMO" "false"
fi
if [ -z "$(read_env PORT)" ]; then
  set_env "PORT" "$PORT"
fi
AUTH_URL="$(read_env AUTH_URL)"
if [ -z "$AUTH_URL" ]; then
  AUTH_URL="http://localhost:${PORT}"
  set_env "AUTH_URL" "$AUTH_URL"
fi
chmod 600 "$ENV_FILE" 2>/dev/null || true

info "校验 Docker Compose 配置..."
compose config --quiet

info "构建数据库初始化镜像..."
compose build db-init

info "启动 PostgreSQL..."
compose up -d postgres

info "执行数据库迁移和管理员初始化..."
compose run --rm db-init

info "启动 TradePilot 和本地视频 Worker..."
compose up -d --build tradepilot video-worker

if [ "$TEST_MODE" = "true" ]; then
  info "安装测试模式完成；未调用 Docker 或网络。"
  exit 0
fi

info "等待数据库和 TradePilot 健康检查完成..."
for _ in $(seq 1 90); do
  if curl --fail --silent "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! curl --fail --silent "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  compose ps
  compose logs --tail=100 postgres db-init tradepilot
  fail "TradePilot 未通过健康检查，请查看上方日志。"
fi

printf '\nTradePilot 已启动：http://localhost:%s\n' "$PORT"
printf '管理员账号：%s\n管理员密码：%s\n' "$ADMIN_EMAIL" "$ADMIN_PASSWORD"
AI_LOG="$STATE_DIR/moneyprinterturbo-install.log"
info "后台启动 MoneyPrinterTurbo 和 Redis；主站无需等待镜像下载。"
nohup docker compose --env-file "$ENV_FILE" up -d moneyprinterturbo >"$AI_LOG" 2>&1 &

printf '查看状态：docker compose --env-file "%s" ps\n' "$ENV_FILE"
printf '查看日志：docker compose --env-file "%s" logs -f\n' "$ENV_FILE"
printf 'AI 安装日志：%s\n' "$AI_LOG"
