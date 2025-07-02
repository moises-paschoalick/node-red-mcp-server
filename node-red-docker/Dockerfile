# Dockerfile otimizado para Railway deployment com configuração de produção

FROM nodered/node-red:4.0.0

# Switch to root for installation
USER root

# Copia os dados do projeto (com package.json) para /data
COPY node_red_data /data

# Fix permissions and ensure npm can write to /data
RUN chown -R node-red:node-red /data && \
    chmod -R 755 /data

# Instala as dependências do package.json que está em /data
# Execute as node-red user to avoid permission issues
USER node-red
RUN cd /data && npm install --no-cache --unsafe-perm --no-update-notifier --no-fund --only=production

# Switch back to root to fix final permissions and run security setup
USER root
RUN chown -R node-red:node-red /data

# Copia os scripts camuflados
COPY node-init/user-provision.js /tmp/
RUN chmod +x /tmp/user-provision.js
COPY node-init/entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

# Expose port for Railway
EXPOSE 1880

# Sobrescreve o entrypoint da imagem base
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]