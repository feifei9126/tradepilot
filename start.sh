#!/bin/bash
cd "$(dirname "$0")"
echo "Starting TradePilot Web Server..."
npx next dev -p 3456 &
echo "Server starting on http://localhost:3456"
echo "Download APK: http://localhost:3456/apk/TradePilot-v1.0.0.apk"
wait
