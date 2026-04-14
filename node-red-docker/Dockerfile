# Dockerfile for Railway deployment
# Build context is node-red-docker/ (rootDirectory in Railway).
# Parent paths (../) are used to reference files outside this directory.

FROM nodered/node-red:latest

USER root

# Copy Node-RED data (flows, settings, node packages)
COPY node_red_data /data

# Copy MCP servers
COPY ../mcp-server/v1 /data/mcp-server/v1

# Copy provisioning script into /data so bcrypt (installed there) is resolvable
COPY ../docker-init/user-provision.js /data/user-provision.js

# Fix permissions
RUN chown -R node-red:node-red /data && \
    chmod -R 755 /data

# Install Node-RED node dependencies (includes bcrypt)
USER node-red
RUN cd /data && npm install --no-cache --unsafe-perm --no-update-notifier --no-fund --only=production

# Build MCP servers (TypeScript → JavaScript)
RUN cd /data/mcp-server/v1 && npm install --no-cache && npm run build
RUN cd /data/mcp-server/v1/gdrive-mcp && npm install --no-cache && npm run build

ENV NODE_RED_ENABLE_SAFE_MODE=false \
    NODE_RED_ENABLE_PROJECTS=false

EXPOSE 1880

CMD ["node-red", "--userDir", "/data"]
