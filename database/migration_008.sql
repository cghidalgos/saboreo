-- migration_008: columna secciones_ocultas en encuestas
-- Array JSON de claves de secciones que NO se muestran al participante en el
-- formulario público. Claves posibles: "instrucciones", "consentimiento", "preguntas".
ALTER TABLE encuestas ADD COLUMN IF NOT EXISTS secciones_ocultas JSONB NOT NULL DEFAULT '[]'::jsonb;
