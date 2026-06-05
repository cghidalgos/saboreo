FROM node:22-alpine AS base
WORKDIR /app
# ffmpeg: transcodifica los videos subidos (WebM) a MP4 para que se reproduzcan en Safari/iOS.
RUN apk add --no-cache ffmpeg

# Instalar dependencias
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Imagen de desarrollo
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 9021
CMD ["npm", "run", "dev"]

# Build de producción
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Imagen de producción
FROM node:22-alpine AS prod
WORKDIR /app
# ffmpeg: necesario en runtime para transcodificar los videos subidos a MP4.
RUN apk add --no-cache ffmpeg
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 9021
CMD ["npm", "start"]
