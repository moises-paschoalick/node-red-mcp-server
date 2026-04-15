#!/bin/sh
# Runs as root inside the container before Node-RED starts.
# Fixes /data ownership so the node-red user (UID 1000) can write to the
# volume, which is mounted with root ownership on each fresh deploy.

if ! su -s /bin/sh node-red -c "test -w /data" 2>/dev/null; then
    echo "init: fixing /data ownership for node-red (1000:1000)"
    chown -R 1000:1000 /data
    chmod -R 755 /data
fi

exec node-red --userDir /data
