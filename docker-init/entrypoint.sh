#!/bin/bash

echo "🔐 Setting up Node-RED security..."

# Check if ADMIN_PASSWORD is defined
if [ -n "$ADMIN_PASSWORD" ]; then
    echo "🔑 Using provided ADMIN_PASSWORD..."
    export NODE_RED_ADMIN_PASSWORD="$ADMIN_PASSWORD"
fi

cd /data
node /tmp/user-provision.js

echo "🔒 Fixing permissions after security setup..."
chown -R node-red:node-red /data

echo "🚀 Starting Node-RED..."
exec su node-red -c "node-red --userDir /data" 