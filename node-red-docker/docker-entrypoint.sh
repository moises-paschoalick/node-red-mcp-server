#!/bin/sh
set -e

echo "🔧 Fixing /data permissions..."
chown -R node-red:node-red /data && chmod -R 755 /data

echo "🚀 Starting Node-RED as node-red user..."
exec su-exec node-red "$@"
