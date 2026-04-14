# Step 1 - Base image with Node
FROM node:20-alpine

# Working directory in container
WORKDIR /app

# Copy everything from project to container
COPY mcp-client ./mcp-client
COPY mcp-host ./mcp-host
COPY mcp-server ./mcp-server

# Install and build the client
WORKDIR /app/mcp-client
RUN npm install && npm run build

# Install and build the mcp-server v1
WORKDIR /app/mcp-server/v1
RUN npm install && npm run build

# Install and build the gdrive-mcp
WORKDIR /app/mcp-server/v1/gdrive-mcp
RUN npm install && npm run build

# Install and start the host
WORKDIR /app/mcp-host
RUN npm install

# Port that the host exposes (adjust if different)
EXPOSE 3000

# Command to start the host
CMD ["npm", "start"]
