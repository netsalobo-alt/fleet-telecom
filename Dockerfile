# Fleet Telecom: app (React + Express) com banco SQLite embutido.
# Os dados ficam em /app/data (monte um volume aí).

# ---- build -------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:prod

# ---- runtime -----------------------------------------------------------------
FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    TZ=America/Belem
WORKDIR /app
RUN apk add --no-cache tzdata su-exec
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /app/data && chown -R node:node /app/data
# Começa como root só para acertar o dono do volume; o app roda como "node" (ver docker-entrypoint.sh)
EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
