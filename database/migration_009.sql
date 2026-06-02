-- migration_009: ampliar el rango de edad permitido del participante de 3–18 a 4–99.
-- Acompaña el cambio del esquema de validación del backend (respuestaSchema) y del
-- formulario público de encuesta en el frontend.

ALTER TABLE respuestas_encuesta
  DROP CONSTRAINT IF EXISTS respuestas_encuesta_participante_edad_check,
  ADD CONSTRAINT respuestas_encuesta_participante_edad_check
    CHECK (participante_edad >= 4 AND participante_edad <= 99);

ALTER TABLE sesiones
  DROP CONSTRAINT IF EXISTS sesiones_participante_edad_check,
  ADD CONSTRAINT sesiones_participante_edad_check
    CHECK (participante_edad >= 4 AND participante_edad <= 99);
