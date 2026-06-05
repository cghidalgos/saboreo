#!/usr/bin/env bash
#
# Convierte a MP4 (H.264/AAC) todos los videos WebM ya existentes y actualiza la BD.
# Necesario porque Safari de iOS no reproduce WebM. Idempotente: se puede correr varias veces.
#
# Uso (desde la raíz del proyecto, con los contenedores prod levantados, SIN sudo):
#   bash scripts/migrate-webm-to-mp4.sh
#
set -euo pipefail

COMPOSE="docker-compose -f docker-compose.prod.yml"

echo "==> Transcodificando WebM -> MP4 dentro del contenedor backend..."
$COMPOSE exec -T backend sh -c '
  cd /app/uploads/videos 2>/dev/null || { echo "No hay carpeta de videos"; exit 0; }
  shopt -s nullglob 2>/dev/null || true
  count=0
  for f in *.webm; do
    [ -e "$f" ] || continue
    out="${f%.webm}.mp4"
    if [ -e "$out" ]; then
      echo "   = ya existe $out, omito"
      continue
    fi
    echo "   + $f -> $out"
    ffmpeg -y -loglevel error -i "$f" \
      -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p \
      -movflags +faststart -c:a aac -b:a 128k "$out" </dev/null
    count=$((count+1))
  done
  echo "   Transcodificados: $count"
'

echo "==> Actualizando video_url (.webm -> .mp4) en la base de datos..."
$COMPOSE exec -T postgres sh -c '
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
    "UPDATE evaluaciones_muestra
        SET video_url = regexp_replace(video_url, '"'"'\.webm$'"'"', '"'"'.mp4'"'"')
      WHERE video_url LIKE '"'"'%.webm'"'"';"
'

echo "==> Borrando los WebM que ya tienen su MP4..."
$COMPOSE exec -T backend sh -c '
  cd /app/uploads/videos 2>/dev/null || exit 0
  for f in *.webm; do
    [ -e "$f" ] || continue
    if [ -e "${f%.webm}.mp4" ]; then rm -f "$f" && echo "   - borrado $f"; fi
  done
'

echo "==> Listo. Recarga la página de resultados (en iPhone con caché limpia)."
