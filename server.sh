#!/bin/bash
# TradePilot Web Server Manager
ACTION=${1:-status}
case "$ACTION" in
  start)
    launchctl load ~/Library/LaunchAgents/com.tradepilot.web.plist 2>/dev/null
    echo "✅ Server started"
    echo "   http://localhost:3456"
    ;;
  stop)
    launchctl unload ~/Library/LaunchAgents/com.tradepilot.web.plist 2>/dev/null
    echo "⏹ Server stopped"
    ;;
  restart)
    launchctl unload ~/Library/LaunchAgents/com.tradepilot.web.plist 2>/dev/null
    sleep 1
    launchctl load ~/Library/LaunchAgents/com.tradepilot.web.plist 2>/dev/null
    echo "🔄 Server restarted"
    ;;
  status)
    if launchctl list | grep -q tradepilot; then
      echo "✅ Server is running"
      echo "   http://localhost:3456"
      echo "   APK: http://localhost:3456/apk/TradePilot-v1.0.0.apk"
    else
      echo "❌ Server is not running"
    fi
    ;;
  *)
    echo "Usage: ./server.sh {start|stop|restart|status}"
    ;;
esac
