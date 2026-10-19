# Preparation only. No image was built and no license was accepted.
# Context must be the separately reviewed full release pinned in pins.json,
# with its real release-manifest and complete fresh-synthetic SQL profile.
ARG NODE_IMAGE
FROM ${NODE_IMAGE}
ARG ODBC_EULA_ACCEPTED
ARG MSODBCSQL18_VERSION
RUN test "$ODBC_EULA_ACCEPTED" = YES && test -n "$MSODBCSQL18_VERSION"
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl python3 make g++ unixodbc-dev libgssapi-krb5-2 \
    && curl --fail --location https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb -o /tmp/microsoft-prod.deb \
    && dpkg -i /tmp/microsoft-prod.deb \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends "msodbcsql18=${MSODBCSQL18_VERSION}" \
    && rm /tmp/microsoft-prod.deb \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/melisa/erp
COPY --chown=node:node . .
WORKDIR /opt/melisa/erp/apps/api
RUN npm ci --omit=dev --no-audit --no-fund
USER node
# Compose invokes the existing full application entry, not the Cloud adapter.
# Current entry will reject the new target until the strict synthetic profile
# and fresh schema/procedure proofs are implemented and verified.
CMD ["node", "start-shared-test-copy.mjs", "erp", "/run/melisa/erp-runtime.json"]
