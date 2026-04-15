# Dockerfile for Railway deployment
# Railway root dir: node-red-docker/
# Build context starts at node-red-docker/ — all COPY paths are relative to it

FROM nodered/node-red:latest

USER root

# Copy Node-RED data (flows, settings, node packages)
COPY node_red_data /data

# Copy provisioning script outside /data so volume mount doesn't wipe it
COPY node-init/user-provision.js /usr/local/bin/user-provision.js

# Copy entrypoint script and make it executable
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Fix permissions
RUN chown -R node-red:node-red /data && \
    chmod -R 755 /data

# Install Node-RED node dependencies (includes bcrypt)
USER node-red
RUN cd /data && npm install --no-cache --unsafe-perm --no-update-notifier --no-fund --only=production

ENV NODE_RED_ENABLE_SAFE_MODE=false \
    NODE_RED_ENABLE_PROJECTS=false

EXPOSE 1880

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node-red", "--userDir", "/data"]
