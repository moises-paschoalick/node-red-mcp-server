#!/bin/sh
# Runs as root before Node-RED starts.
# 1. Fixes /data ownership when Railway mounts the volume as root
# 2. Runs user-provision.js to configure admin password
# 3. Starts Node-RED as node-red user

# Fix /data permissions if volume was mounted as root
if ! su -s /bin/sh node-red -c "test -w /data" 2>/dev/null; then
    echo "init: fixing /data ownership for node-red (1000:1000)"
    chown -R 1000:1000 /data
    chmod -R 755 /data
fi

# Set admin password (reads ADMIN_PASSWORD env var or generates one)
cd /data && node /usr/local/bin/user-provision.js

# Start Node-RED as node-red user
exec su -s /bin/sh node-red -c "node-red --userDir /data"
