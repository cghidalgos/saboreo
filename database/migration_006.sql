-- migration_006: columna transcripcion en evaluaciones_muestra
ALTER TABLE evaluaciones_muestra ADD COLUMN IF NOT EXISTS transcripcion TEXT;
