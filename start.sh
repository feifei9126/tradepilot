#!/bin/bash
cd "$(dirname "$0")"
echo "TradePilot → http://localhost:3458"
ADMIN_EMAIL="$(awk -F= '/^TRADEPILOT_ADMIN_EMAIL=/{sub(/^[^=]*=/, ""); value=$0} END{print value}' .env 2>/dev/null)"
ADMIN_PASSWORD="$(awk -F= '/^TRADEPILOT_ADMIN_PASSWORD=/{sub(/^[^=]*=/, ""); value=$0} END{print value}' .env 2>/dev/null)"
echo "登录: ${ADMIN_EMAIL:-demo@tradepilot.dev} / ${ADMIN_PASSWORD:-password}"
echo ""

if command -v pm2 >/dev/null 2>&1; then
  PM2_PID="$(pm2 pid tradepilot 2>/dev/null | tail -n 1)"
  if [[ "$PM2_PID" =~ ^[1-9][0-9]*$ ]]; then
    echo "检测到 TradePilot 常驻服务，正在重启现有实例..."
    pm2 restart tradepilot
    exit $?
  fi
fi

npm start
