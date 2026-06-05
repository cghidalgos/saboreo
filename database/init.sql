-- Tipos
CREATE TYPE app_role AS ENUM ('admin', 'investigador', 'operador');

-- Tabla de usuarios/perfiles (reemplaza auth.users de Supabase)
CREATE TABLE profiles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        UNIQUE NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  institution   TEXT,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de roles
CREATE TABLE user_roles (
  id         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID      NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       app_role  NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- MÓDULO ENCUESTAS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE encuestas (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo       TEXT        NOT NULL,
  descripcion  TEXT,
  producto     TEXT        NOT NULL,
  estado       TEXT        NOT NULL DEFAULT 'activa'
                           CHECK (estado IN ('borrador', 'activa', 'cerrada')),
  num_muestras  INTEGER     NOT NULL DEFAULT 1,
  instrucciones         TEXT,
  atributos             JSONB NOT NULL DEFAULT '["SABOR"]',
  preguntas             JSONB NOT NULL DEFAULT '[]',
  texto_consentimiento  TEXT,
  texto_alergia         TEXT,
  campos_participante   JSONB NOT NULL DEFAULT '[
    {"key":"nombre",      "label":"Nombre completo",       "tipo":"texto",  "activo":true,  "requerido":true},
    {"key":"edad",        "label":"Edad",                  "tipo":"numero", "activo":true,  "requerido":true},
    {"key":"genero",      "label":"Género",                "tipo":"select", "activo":true,  "requerido":false, "opciones":["Niño","Niña","Otro"]},
    {"key":"institucion", "label":"Institución / escuela", "tipo":"texto",  "activo":true,  "requerido":false}
  ]',
  creado_por    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE respuestas_encuesta (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  encuesta_id              UUID        NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
  participante_nombre      TEXT        NOT NULL,
  participante_edad        INTEGER     NOT NULL CHECK (participante_edad BETWEEN 4 AND 99),
  participante_genero      TEXT        CHECK (participante_genero IN ('niño', 'niña', 'otro')),
  participante_institucion TEXT,
  consentimiento           BOOLEAN     NOT NULL DEFAULT false,
  tiene_alergia            BOOLEAN,
  escala_hedonica          INTEGER     CHECK (escala_hedonica BETWEEN 1 AND 5),
  comentarios              TEXT,
  registrado_por           UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE evaluaciones_muestra (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  respuesta_id    UUID        NOT NULL REFERENCES respuestas_encuesta(id) ON DELETE CASCADE,
  numero_muestra  INTEGER     NOT NULL CHECK (numero_muestra >= 1),
  calificacion    INTEGER     CHECK (calificacion BETWEEN 1 AND 5),
  observaciones   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (respuesta_id, numero_muestra)
);

CREATE TRIGGER encuestas_touch_updated_at
  BEFORE UPDATE ON encuestas
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- MÓDULO SESIONES CON CÁMARA
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE sesiones (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo              TEXT        NOT NULL,
  encuesta_id         UUID        REFERENCES encuestas(id) ON DELETE SET NULL,
  participante_nombre TEXT        NOT NULL,
  participante_edad   INTEGER     NOT NULL CHECK (participante_edad BETWEEN 4 AND 99),
  estado              TEXT        NOT NULL DEFAULT 'pendiente'
                                  CHECK (estado IN ('pendiente', 'grabando', 'completada', 'cancelada')),
  duracion_seg        INTEGER,
  score_ia            INTEGER     CHECK (score_ia BETWEEN 0 AND 100),
  emociones           JSONB,
  notas               TEXT,
  investigador_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER sesiones_touch_updated_at
  BEFORE UPDATE ON sesiones
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
