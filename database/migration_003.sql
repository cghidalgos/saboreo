-- ── Migración 003: Análisis IA por muestra dentro de una sesión ──────────────

CREATE TABLE IF NOT EXISTS analisis_muestras (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id         UUID        NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
  numero_muestra    INTEGER     NOT NULL CHECK (numero_muestra >= 1),
  frames_analizados INTEGER     NOT NULL DEFAULT 0,
  emociones         JSONB       NOT NULL DEFAULT '{}',    -- promedio: {alegria, disgusto, sorpresa, neutral, tristeza, interes}
  emocion_dominante TEXT,
  transcripcion     TEXT,                                 -- voz transcrita por Web Speech API
  sentimiento_voz   TEXT        CHECK (sentimiento_voz IN ('positivo', 'neutro', 'negativo')),
  score_ia          INTEGER     CHECK (score_ia BETWEEN 0 AND 100),
  resumen_ia        TEXT,                                 -- síntesis generada por Claude
  duracion_seg      INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sesion_id, numero_muestra)
);
