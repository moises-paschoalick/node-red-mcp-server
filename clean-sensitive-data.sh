#!/bin/bash

echo "🧹 Cleaning sensitive data from Node-RED flows and docker-compose.yml..."

# Backup original files
cp node-red-docker/node_red_data/flows.json node-red-docker/node_red_data/flows.json.backup.before-clean
cp node-red-docker/node_red_data/.flows.json.backup node-red-docker/node_red_data/.flows.json.backup.before-clean
cp docker-compose.yml docker-compose.yml.backup.before-clean

# Clean OpenAI API keys
echo "  - Cleaning OpenAI API keys..."
sed -i 's/sk-proj-[a-zA-Z0-9_-]*/{{OPENAI_API_KEY}}/g' node-red-docker/node_red_data/flows.json
sed -i 's/sk-proj-[a-zA-Z0-9_-]*/{{OPENAI_API_KEY}}/g' node-red-docker/node_red_data/.flows.json.backup

# Clean Google OAuth2 credentials
echo "  - Cleaning Google OAuth2 credentials..."
sed -i 's/"GOOGLE_CLIENT_ID": "[^"]*"/"GOOGLE_CLIENT_ID": "{{GOOGLE_CLIENT_ID}}"/g' node-red-docker/node_red_data/flows.json
sed -i 's/"GOOGLE_CLIENT_SECRET": "[^"]*"/"GOOGLE_CLIENT_SECRET": "{{GOOGLE_CLIENT_SECRET}}"/g' node-red-docker/node_red_data/flows.json
sed -i 's/"GOOGLE_REFRESH_TOKEN": "[^"]*"/"GOOGLE_REFRESH_TOKEN": "{{GOOGLE_REFRESH_TOKEN}}"/g' node-red-docker/node_red_data/flows.json

sed -i 's/"GOOGLE_CLIENT_ID": "[^"]*"/"GOOGLE_CLIENT_ID": "{{GOOGLE_CLIENT_ID}}"/g' node-red-docker/node_red_data/.flows.json.backup
sed -i 's/"GOOGLE_CLIENT_SECRET": "[^"]*"/"GOOGLE_CLIENT_SECRET": "{{GOOGLE_CLIENT_SECRET}}"/g' node-red-docker/node_red_data/.flows.json.backup
sed -i 's/"GOOGLE_REFRESH_TOKEN": "[^"]*"/"GOOGLE_REFRESH_TOKEN": "{{GOOGLE_REFRESH_TOKEN}}"/g' node-red-docker/node_red_data/.flows.json.backup

# Clean Smithery API keys and profiles
echo "  - Cleaning Smithery API keys and profiles..."
sed -i 's/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/{{SMITHERY_KEY}}/g' node-red-docker/node_red_data/flows.json
sed -i 's/raspy-[a-zA-Z0-9\-_]*/{{SMITHERY_PROFILE}}/g' node-red-docker/node_red_data/flows.json

sed -i 's/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/{{SMITHERY_KEY}}/g' node-red-docker/node_red_data/.flows.json.backup
sed -i 's/raspy-[a-zA-Z0-9\-_]*/{{SMITHERY_PROFILE}}/g' node-red-docker/node_red_data/.flows.json.backup

# Clean API keys and profiles in arguments
echo "  - Cleaning API keys and profiles in arguments..."
sed -i 's/--key, [a-zA-Z0-9\-]*/--key, {{API_KEY}}/g' node-red-docker/node_red_data/flows.json
sed -i 's/--profile, [a-zA-Z0-9\-_]*/--profile, {{PROFILE_NAME}}/g' node-red-docker/node_red_data/flows.json

sed -i 's/--key, [a-zA-Z0-9\-]*/--key, {{API_KEY}}/g' node-red-docker/node_red_data/.flows.json.backup
sed -i 's/--profile, [a-zA-Z0-9\-_]*/--profile, {{PROFILE_NAME}}/g' node-red-docker/node_red_data/.flows.json.backup

# Clean other common sensitive patterns
echo "  - Cleaning other sensitive patterns..."
sed -i 's/456adaa87-9396-49df-b5da-c6be195a38e3/{{UUID_KEY}}/g' node-red-docker/node_red_data/flows.json
sed -i 's/raspy-example-aaaa/{{PROFILE_NAME}}/g' node-red-docker/node_red_data/flows.json
sed -i 's/[a-zA-Z0-9\-_]{20,}/{{id_field}}/g' node-red-docker/node_red_data/flows.json

sed -i 's/456adaa87-9396-49df-b5da-c6be195a38e3/{{UUID_KEY}}/g' node-red-docker/node_red_data/.flows.json.backup
sed -i 's/raspy-example-aaaa/{{PROFILE_NAME}}/g' node-red-docker/node_red_data/.flows.json.backup
sed -i 's/[a-zA-Z0-9\-_]{20,}/{{id_field}}/g' node-red-docker/node_red_data/.flows.json.backup

# Clean InfluxDB tokens and URLs
echo "  - Cleaning InfluxDB tokens and URLs..."
sed -i 's/"INFLUX_DB_TOKEN": "[^"]*"/"INFLUX_DB_TOKEN": "{{INFLUX_DB_TOKEN}}"/g' node-red-docker/node_red_data/flows.json
sed -i 's/"INFLUX_DB_INSTANCE_URL": "[^"]*"/"INFLUX_DB_INSTANCE_URL": "{{INFLUX_DB_INSTANCE_URL}}"/g' node-red-docker/node_red_data/flows.json

sed -i 's/"INFLUX_DB_TOKEN": "[^"]*"/"INFLUX_DB_TOKEN": "{{INFLUX_DB_TOKEN}}"/g' node-red-docker/node_red_data/.flows.json.backup
sed -i 's/"INFLUX_DB_INSTANCE_URL": "[^"]*"/"INFLUX_DB_INSTANCE_URL": "{{INFLUX_DB_INSTANCE_URL}}"/g' node-red-docker/node_red_data/.flows.json.backup

# Clean docker-compose.yml
echo "  - Cleaning docker-compose.yml..."
sed -i 's/sk-proj-[a-zA-Z0-9_-]*/{{OPENAI_API_KEY}}/g' docker-compose.yml
sed -i 's/313010006079-[a-zA-Z0-9_-]*/{{GOOGLE_CLIENT_ID}}/g' docker-compose.yml
sed -i 's/GOCSPX-[a-zA-Z0-9_-]*/{{GOOGLE_CLIENT_SECRET}}/g' docker-compose.yml
sed -i 's/1\/\/04_[a-zA-Z0-9_-]*/{{GOOGLE_REFRESH_TOKEN}}/g' docker-compose.yml
sed -i 's/[a-zA-Z0-9\-_]{20,}/{{id_field}}/g' docker-compose.yml
sed -i 's/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/{{SMITHERY_KEY}}/g' docker-compose.yml
sed -i 's/raspy-[a-zA-Z0-9\-_]*/{{SMITHERY_PROFILE}}/g' docker-compose.yml

echo "✅ Sensitive data cleaned successfully!"
echo "📁 Backups created:"
echo "   - flows.json.backup.before-clean"
echo "   - .flows.json.backup.before-clean"
echo "   - docker-compose.yml.backup.before-clean"
echo ""
echo "🔒 Replaced sensitive data with placeholders:"
echo "   - {{OPENAI_API_KEY}} - OpenAI API Key"
echo "   - {{GOOGLE_CLIENT_ID}} - Google OAuth2 Client ID"
echo "   - {{GOOGLE_CLIENT_SECRET}} - Google OAuth2 Client Secret"
echo "   - {{GOOGLE_REFRESH_TOKEN}} - Google OAuth2 Refresh Token"
echo "   - {{SMITHERY_KEY}} - Smithery API Key"
echo "   - {{SMITHERY_PROFILE}} - Smithery Profile"
echo "   - {{API_KEY}} - Generic API Key"
echo "   - {{PROFILE_NAME}} - Profile Name"
echo "   - {{UUID_KEY}} - UUID Key"
echo "   - {{INFLUX_DB_TOKEN}} - InfluxDB Token"
echo "   - {{INFLUX_DB_INSTANCE_URL}} - InfluxDB Instance URL"
echo "   - {{id_field}} - Spreadsheet ID"
