FROM node:20-alpine AS base
WORKDIR /app

# Instalar dependencias
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Imagen de desarrollo
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 9020
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "9020"]

# Build de producción
FROM base AS builder
ARG VITE_BASE=/
ARG VITE_API_URL=
ENV VITE_BASE=${VITE_BASE}
ENV VITE_API_URL=${VITE_API_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Imagen de producción
FROM node:20-alpine AS prod
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY node-server.mjs ./
EXPOSE 9020
CMD ["node", "node-server.mjs"]
