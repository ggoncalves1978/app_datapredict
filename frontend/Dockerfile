# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências primeiro (cache de camadas)
COPY package*.json ./
RUN npm ci

# Copia o restante e faz o build de produção
COPY . .
RUN npm run build

# ─── Stage 2: Serve com Nginx ─────────────────────────────────────────────────
FROM nginx:alpine

# Copia o build do React para o Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuração customizada do Nginx (suporte ao React Router)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
