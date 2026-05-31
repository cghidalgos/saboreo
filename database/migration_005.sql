-- migration_005: Add video_url column to store recorded video paths
ALTER TABLE evaluaciones_muestra
  ADD COLUMN IF NOT EXISTS video_url TEXT;
