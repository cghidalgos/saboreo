-- ── Migración 002: Tabla consentimientos ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS consentimientos (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo               TEXT        NOT NULL,                          -- nombre interno (ej. "Proyecto Orquídeas")
  titulo_investigacion TEXT,                                          -- título oficial del proyecto
  investigadores       JSONB       NOT NULL DEFAULT '[]',             -- [{nombre, email, tel}]
  texto_intro          TEXT,                                          -- párrafo "propósito del consentimiento"
  ingredientes         JSONB       NOT NULL DEFAULT '[]',             -- [{ingrediente, marca, porcentaje}]
  tiene_pregunta_alergia BOOLEAN   NOT NULL DEFAULT true,
  texto_alergia        TEXT,
  parrafos             JSONB       NOT NULL DEFAULT '[]',             -- [string] cuerpo del documento
  texto_contacto       TEXT,                                          -- info de contacto al pie
  creado_por           UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER consentimientos_touch_updated_at
  BEFORE UPDATE ON consentimientos
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Agregar FK en encuestas
ALTER TABLE encuestas
  ADD COLUMN IF NOT EXISTS consentimiento_id UUID REFERENCES consentimientos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS usar_consentimiento BOOLEAN NOT NULL DEFAULT false;
