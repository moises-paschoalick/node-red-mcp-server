# Dockerfile for Railway deployment
# Railway root dir: node-red-docker/
# Build context starts at node-red-docker/ — all COPY paths are relative to it

FROM nodered/node-red:latest

USER root

# /data-template lives OUTSIDE the volume mount point.
# init.sh syncs it into /data on every startup so flows and node_modules
# are always up to date even after Railway redeploys with an existing volume.
COPY node_red_data /data-template
RUN chown -R node-red:node-red /data-template && chmod -R 755 /data-template

# Pre-install node dependencies into the template (bcrypt + node-red-contrib-mcp-tools)
USER node-red
RUN cd /data-template && npm install --no-cache --unsafe-perm --no-update-notifier --no-fund --only=production

# Also seed /data for no-volume deployments
USER root
RUN cp -r /data-template /data && chown -R node-red:node-red /data

# Copy provisioning script outside /data so volume mount doesn't wipe it
COPY node-init/user-provision.js /usr/local/bin/user-provision.js

# Copy init script
COPY init.sh /usr/local/bin/init.sh
RUN chmod +x /usr/local/bin/init.sh

ENV NODE_RED_ENABLE_SAFE_MODE=false \
    NODE_RED_ENABLE_PROJECTS=false

EXPOSE 1880

# Run as root so init.sh can fix volume permissions before handing off to node-red user
USER root
ENTRYPOINT ["/usr/local/bin/init.sh"]
CMD []
