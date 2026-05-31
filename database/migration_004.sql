-- Migration 004: Video recording support in encuestas
-- Adds requiere_video flag to encuestas and AI analysis fields to evaluaciones_muestra

ALTER TABLE encuestas
  ADD COLUMN IF NOT EXISTS requiere_video BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE evaluaciones_muestra
  ADD COLUMN IF NOT EXISTS score_ia         INTEGER CHECK (score_ia BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS emociones        JSONB,
  ADD COLUMN IF NOT EXISTS emocion_dominante TEXT,
  ADD COLUMN IF NOT EXISTS sentimiento_voz  TEXT CHECK (sentimiento_voz IN ('positivo', 'neutro', 'negativo')),
  ADD COLUMN IF NOT EXISTS resumen_ia       TEXT,
  ADD COLUMN IF NOT EXISTS frames_analizados INTEGER;
