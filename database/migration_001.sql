-- Migration 001: Multi-sample sensory panel support
-- Run this against existing databases

ALTER TABLE encuestas
  ADD COLUMN IF NOT EXISTS num_muestras INTEGER NOT NULL DEFAULT 1;

ALTER TABLE respuestas_encuesta
  ADD COLUMN IF NOT EXISTS tiene_alergia BOOLEAN;

CREATE TABLE IF NOT EXISTS evaluaciones_muestra (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  respuesta_id    UUID        NOT NULL REFERENCES respuestas_encuesta(id) ON DELETE CASCADE,
  numero_muestra  INTEGER     NOT NULL CHECK (numero_muestra >= 1),
  calificacion    INTEGER     CHECK (calificacion BETWEEN 1 AND 5),
  observaciones   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (respuesta_id, numero_muestra)
);
