#!/bin/sh
# Runs as root before Node-RED starts.
# 1. Fixes /data ownership when Railway mounts the volume as root
# 2. Syncs flows/settings/node_modules from /data-template (image) to /data (volume)
# 3. Runs user-provision.js to configure admin password
# 4. Starts Node-RED as node-red user

# Fix /data permissions if volume was mounted as root
if ! su -s /bin/sh node-red -c "test -w /data" 2>/dev/null; then
    echo "init: fixing /data ownership for node-red (1000:1000)"
    chown -R 1000:1000 /data
    chmod -R 755 /data
fi

# Sync template files from image into /data on every deploy.
# This keeps flows.json and settings.js up to date even after redeployments.
# Credentials files (*_cred.json) are NOT overwritten — they stay in the volume.
if [ -d /data-template ]; then
    echo "init: syncing flows and settings from image..."
    cp /data-template/flows.json  /data/flows.json
    cp /data-template/settings.js /data/settings.js
    cp /data-template/package.json /data/package.json
    chown 1000:1000 /data/flows.json /data/settings.js /data/package.json

    # Restore node_modules if missing (wiped by first volume mount or clean deploy)
    if [ ! -d /data/node_modules ]; then
        echo "init: restoring node_modules from image..."
        cp -r /data-template/node_modules /data/node_modules
        chown -R 1000:1000 /data/node_modules
    fi
fi

# Set admin password (reads ADMIN_PASSWORD env var or generates one)
# bcrypt resolves from /data/node_modules
cd /data && node /usr/local/bin/user-provision.js

# Start Node-RED as node-red user
exec su -s /bin/sh node-red -c "node-red --userDir /data"
