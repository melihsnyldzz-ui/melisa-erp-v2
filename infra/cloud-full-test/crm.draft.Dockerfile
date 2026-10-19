# Preparation only; context is the pinned, reviewed full CRM release.
ARG NODE_IMAGE
FROM ${NODE_IMAGE}
WORKDIR /opt/melisa/crm
COPY --chown=node:node . .
WORKDIR /opt/melisa/crm/apps/gateway
RUN npm ci --omit=dev --no-audit --no-fund
USER node
CMD ["node", "src/server.js"]
