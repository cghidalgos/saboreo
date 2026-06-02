-- migration_007: columna respuestas_extra (JSON) en respuestas_encuesta
ALTER TABLE respuestas_encuesta ADD COLUMN IF NOT EXISTS respuestas_extra JSONB;
