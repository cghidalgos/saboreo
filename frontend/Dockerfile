FROM node:22-alpine AS base
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
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Imagen de producción
FROM node:22-alpine AS prod
WORKDIR /app
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./
EXPOSE 9020
CMD ["node", ".output/server/index.mjs"]
