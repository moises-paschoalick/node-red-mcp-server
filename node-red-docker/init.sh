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
# Credentials files (*_cred.json) are NOT overwritten — they stay in the volume.
if [ -d /data-template ]; then
    echo "init: syncing flows and settings from image..."
    cp /data-template/flows.json   /data/flows.json
    cp /data-template/settings.js  /data/settings.js
    cp /data-template/package.json /data/package.json
    chown 1000:1000 /data/flows.json /data/settings.js /data/package.json

    # Restore node_modules if missing OR if package.json changed since last install
    TEMPLATE_HASH=$(md5sum /data-template/package.json 2>/dev/null | cut -d' ' -f1)
    INSTALLED_HASH=$(cat /data/.pkg_hash 2>/dev/null)

    if [ ! -d /data/node_modules ] || [ "$TEMPLATE_HASH" != "$INSTALLED_HASH" ]; then
        echo "init: syncing node_modules from image (packages changed or missing)..."
        rm -rf /data/node_modules
        cp -r /data-template/node_modules /data/node_modules
        chown -R 1000:1000 /data/node_modules
        echo "$TEMPLATE_HASH" > /data/.pkg_hash
        chown 1000:1000 /data/.pkg_hash
    fi
else
    echo "init: WARNING - /data-template not found, skipping sync"
fi

# Set admin password (reads ADMIN_PASSWORD env var or generates one)
# Non-fatal: Node-RED starts even if this fails
cd /data && node /usr/local/bin/user-provision.js || echo "init: WARNING - user-provision.js failed, admin auth not configured"

# Start Node-RED as node-red user
exec su -s /bin/sh node-red -c "node-red --userDir /data"
