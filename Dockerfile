# ==============================================================================
# ETAPA 1 (BUILD): Compila o frontend Expo Web sem segredos embutidos
# ==============================================================================
FROM node:22-slim AS builder

WORKDIR /app

# Instala apenas dependências definidas no lockfile
COPY package.json package-lock.json ./
RUN npm ci

# Copia o código-fonte e garante que nenhum .env local entre no bundle estático
COPY . .
RUN rm -f .env .env.local .env.*.local && npx expo export --platform web

# ==============================================================================
# ETAPA 2 (RUNTIME): Servidor Node.js + Python (edge-tts) + frontend dist/
# ==============================================================================
FROM node:22-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Instala Python 3, pip e certificados SSL para síntese neural edge-tts
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates \
    && pip3 install --no-cache-dir --break-system-packages edge-tts \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copia apenas o servidor backend e o bundle Web estático da Etapa 1
COPY --from=builder /app/server ./server
COPY --from=builder /app/dist ./dist

# Garante permissão de escrita em server/ para o usuário não-root (credenciais IMAP opcionais)
RUN chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/index.js"]

