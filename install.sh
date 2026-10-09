#!/usr/bin/env bash
set -euo pipefail
umask 077

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-}"
STATE_DIR="${TRADEPILOT_HOME:-$HOME/.tradepilot}"
ENV_FILE="$PROJECT_DIR/.env"

info() { printf '[INFO] %s\n' "$1"; }
fail() { printf '[ERROR] %s\n' "$1" >&2; exit 1; }

set_env() {
  local key="$1"
  local value="$2"
  local temporary="${ENV_FILE}.tmp"
  touch "$ENV_FILE"
  awk -v key="$key" -v value="$value" '
    index($0, key "=") == 1 { print key "=" value; found = 1; next }
    { print }
    END { if (!found) print key "=" value }
  ' "$ENV_FILE" > "$temporary"
  mv "$temporary" "$ENV_FILE"
}

read_env() {
  [ -f "$ENV_FILE" ] || return 0
  awk -F= -v key="$1" 'index($0, key "=") == 1 { sub(/^[^=]*=/, ""); value=$0 } END { print value }' "$ENV_FILE" 2>/dev/null
}

command -v docker >/dev/null 2>&1 || fail "未检测到 Docker，请先安装 Docker Desktop 或 Docker Engine。"
docker info >/dev/null 2>&1 || fail "Docker 尚未启动。"
docker compose version >/dev/null 2>&1 || fail "当前 Docker 缺少 Compose 插件。"

cd "$PROJECT_DIR"
# Explicit shell PORT wins; otherwise keep the port already configured in .env.
PORT="${PORT:-$(read_env PORT)}"
PORT="${PORT:-3461}"
case "$PORT" in
  *[!0-9]*|"") fail "PORT 必须是 1–65535 的数字端口。" ;;
esac
if [ "${#PORT}" -gt 5 ] || [ "$((10#$PORT))" -lt 1 ] || [ "$((10#$PORT))" -gt 65535 ]; then
  fail "PORT 必须是 1–65535 的数字端口。"
fi
# Validate before modifying an existing .env. Never silently reset a known account.
EXISTING_ADMIN_PASSWORD="$(read_env TRADEPILOT_ADMIN_PASSWORD)"
if [ -n "$EXISTING_ADMIN_PASSWORD" ] && [ "$EXISTING_ADMIN_PASSWORD" != "replace-with-a-strong-password" ]; then
  case "$EXISTING_ADMIN_PASSWORD" in
    *12345678*|*qwerty*|password*|Password*|admin*|tradepilot*) fail "拒绝公开示例/弱管理员密码，请设置至少 16 位强密码。" ;;
  esac
  [ "${#EXISTING_ADMIN_PASSWORD}" -ge 16 ] || fail "管理员密码至少 16 位；安装不会覆盖已有密码。"
fi
AUTH_SECRET_VALUE="$(read_env AUTH_SECRET)"
if [ -z "$AUTH_SECRET_VALUE" ] || [ "$AUTH_SECRET_VALUE" = "replace-with-openssl-rand-hex-32" ]; then
  command -v openssl >/dev/null 2>&1 || fail "未检测到 openssl，无法生成认证密钥。"
  set_env "AUTH_SECRET" "$(openssl rand -hex 32)"
  info "已在 .env 生成随机 AUTH_SECRET。"
fi
ADMIN_EMAIL="$(read_env TRADEPILOT_ADMIN_EMAIL)"
ADMIN_PASSWORD="$(read_env TRADEPILOT_ADMIN_PASSWORD)"
if [ -z "$ADMIN_EMAIL" ]; then
  ADMIN_EMAIL="admin@tradepilot.local"
  set_env "TRADEPILOT_ADMIN_EMAIL" "$ADMIN_EMAIL"
fi
if [ -z "$ADMIN_PASSWORD" ] || [ "$ADMIN_PASSWORD" = "password" ] || [ "$ADMIN_PASSWORD" = "replace-with-a-strong-password" ]; then
  command -v openssl >/dev/null 2>&1 || fail "未检测到 openssl，无法生成管理员密码。"
  ADMIN_PASSWORD="$(openssl rand -hex 12)"
  set_env "TRADEPILOT_ADMIN_PASSWORD" "$ADMIN_PASSWORD"
  info "已在 .env 生成随机管理员密码。"
fi
POSTGRES_PASSWORD="$(read_env POSTGRES_PASSWORD)"
if [ -z "$POSTGRES_PASSWORD" ] || [ "$POSTGRES_PASSWORD" = "replace-with-a-strong-database-password" ] || [ "$POSTGRES_PASSWORD" = "replace-with-a-local-password" ]; then
  command -v openssl >/dev/null 2>&1 || fail "未检测到 openssl，无法生成数据库密码。"
  set_env "POSTGRES_PASSWORD" "$(openssl rand -hex 32)"
  info "已在 .env 生成随机 PostgreSQL 密码（不会打印）。"
fi
chmod 600 "$ENV_FILE"
info "校验 TradePilot、PostgreSQL、MoneyPrinterTurbo、Redis 和视频 Worker 配置..."
CONFIGURED_AUTH_URL="$(read_env AUTH_URL)"
AUTH_URL="${AUTH_URL:-${CONFIGURED_AUTH_URL:-http://localhost:${PORT}}}"
PORT="$PORT" AUTH_URL="$AUTH_URL" docker compose config >/dev/null

info "构建并启动 PostgreSQL、数据库迁移、TradePilot 和本地视频 Worker..."
PORT="$PORT" AUTH_URL="$AUTH_URL" docker compose up -d --build tradepilot video-worker

info "等待 TradePilot 就绪..."
for _ in $(seq 1 60); do
  if curl --fail --silent "http://127.0.0.1:${PORT}/auth/login" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! curl --fail --silent "http://127.0.0.1:${PORT}/auth/login" >/dev/null 2>&1; then
  docker compose ps
  fail "TradePilot 未在预期时间内就绪，请运行 docker compose logs tradepilot 查看原因。"
fi

printf '\nTradePilot 已启动：http://localhost:%s\n' "$PORT"
printf '管理员账号：%s\n首次初始化密码（已有账号以个人中心修改后的密码为准）：%s\n' "$ADMIN_EMAIL" "$ADMIN_PASSWORD"
mkdir -p "$STATE_DIR"
AI_LOG="$STATE_DIR/moneyprinterturbo-install.log"
info "后台启动 MoneyPrinterTurbo AI 视频引擎和 Redis，首次下载约 0.7 GB..."
nohup env PORT="$PORT" AUTH_URL="$AUTH_URL" docker compose up -d moneyprinterturbo >"$AI_LOG" 2>&1 &
info "主站无需等待镜像下载；可在产品视频页查看连接状态。"

printf '查看状态：docker compose ps\n'
printf '查看日志：docker compose logs -f\n'
printf 'AI 安装日志：%s\n' "$AI_LOG"
