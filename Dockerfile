# ── Build Stage ──────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml* ./

# Instalar dependências
RUN pnpm install --frozen-lockfile

# Copiar código fonte
COPY . .

# Build do frontend e backend
RUN pnpm build

# ── Production Stage ─────────────────────────────────────────────────────────
FROM node:22-slim

WORKDIR /app

# Instalar pnpm e Docker (para o Sandbox se necessário)
RUN apt-get update && apt-get install -y docker.io curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

# Copiar artefatos do build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000

# Expor porta
EXPOSE 3000

# Comando para iniciar
CMD ["node", "dist/server/_core/index.js"]
