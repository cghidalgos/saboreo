import { Router, type Response } from "express";
import { pool } from "../db.js";
import { requireAuth, type AuthRequest } from "./auth.js";

const router = Router({ mergeParams: true });

// GET /api/encuestas/:id/resultados
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  // Verificar acceso
  const { rows: enc } = await pool.query(
    "SELECT * FROM encuestas WHERE id = $1 AND creado_por = $2",
    [id, req.userId],
  );
  if (!enc[0]) { res.status(404).json({ message: "Encuesta no encontrada" }); return; }

  // KPIs
  const { rows: kpis } = await pool.query(`
    SELECT
      COUNT(DISTINCT r.id)::int                                      AS total_respuestas,
      COUNT(DISTINCT r.participante_nombre)::int                     AS total_participantes,
      COUNT(CASE WHEN r.tiene_alergia = true THEN 1 END)::int        AS con_alergia,
      ROUND(AVG(r.escala_hedonica)::numeric, 2)                     AS promedio_escala_unica
    FROM respuestas_encuesta r
    WHERE r.encuesta_id = $1
  `, [id]);

  // Promedio por muestra (panel multi-muestra) — incluye score IA promedio
  const { rows: porMuestra } = await pool.query(`
    SELECT
      em.numero_muestra,
      ROUND(AVG(em.calificacion)::numeric, 2)  AS promedio,
      COUNT(em.id)::int                        AS cantidad,
      MIN(em.calificacion)::int                AS minimo,
      MAX(em.calificacion)::int                AS maximo,
      ROUND(AVG(em.score_ia)::numeric, 1)      AS promedio_score_ia,
      (
        SELECT em2.emocion_dominante
        FROM evaluaciones_muestra em2
        JOIN respuestas_encuesta r2 ON r2.id = em2.respuesta_id
        WHERE r2.encuesta_id = $1
          AND em2.numero_muestra = em.numero_muestra
          AND em2.emocion_dominante IS NOT NULL
        GROUP BY em2.emocion_dominante
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ) AS emocion_dominante_comun
    FROM evaluaciones_muestra em
    JOIN respuestas_encuesta r ON r.id = em.respuesta_id
    WHERE r.encuesta_id = $1 AND em.calificacion IS NOT NULL
    GROUP BY em.numero_muestra
    ORDER BY em.numero_muestra
  `, [id]);

  // Distribución escala (combinada)
  const { rows: distEscala } = await pool.query(`
    SELECT valor, SUM(cantidad)::int AS cantidad FROM (
      SELECT escala_hedonica AS valor, COUNT(*)::int AS cantidad
      FROM respuestas_encuesta WHERE encuesta_id = $1 AND escala_hedonica IS NOT NULL
      GROUP BY escala_hedonica
      UNION ALL
      SELECT em.calificacion AS valor, COUNT(*)::int AS cantidad
      FROM evaluaciones_muestra em
      JOIN respuestas_encuesta r ON r.id = em.respuesta_id
      WHERE r.encuesta_id = $1 AND em.calificacion IS NOT NULL
      GROUP BY em.calificacion
    ) c GROUP BY valor ORDER BY valor
  `, [id]);

  // Demografía - género
  const { rows: distGenero } = await pool.query(`
    SELECT COALESCE(participante_genero,'no especificado') AS genero, COUNT(*)::int AS cantidad
    FROM respuestas_encuesta WHERE encuesta_id = $1
    GROUP BY participante_genero
  `, [id]);

  // Demografía - edad
  const { rows: distEdad } = await pool.query(`
    SELECT participante_edad AS edad, COUNT(*)::int AS cantidad
    FROM respuestas_encuesta WHERE encuesta_id = $1
    GROUP BY participante_edad ORDER BY participante_edad
  `, [id]);

  // Respuestas completas
  const { rows: respuestas } = await pool.query(`
    SELECT r.*,
      COALESCE(
        json_agg(json_build_object(
          'numero_muestra',    em.numero_muestra,
          'calificacion',      em.calificacion,
          'observaciones',     em.observaciones,
          'score_ia',          em.score_ia,
          'emociones',         em.emociones,
          'emocion_dominante', em.emocion_dominante,
          'sentimiento_voz',   em.sentimiento_voz,
          'resumen_ia',        em.resumen_ia,
          'frames_analizados', em.frames_analizados,
          'video_url',         em.video_url
        ) ORDER BY em.numero_muestra) FILTER (WHERE em.id IS NOT NULL),
        '[]'
      ) AS evaluaciones
    FROM respuestas_encuesta r
    LEFT JOIN evaluaciones_muestra em ON em.respuesta_id = r.id
    WHERE r.encuesta_id = $1
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `, [id]);

  res.json({
    encuesta: enc[0],
    kpis: kpis[0],
    por_muestra: porMuestra,
    dist_escala: distEscala,
    dist_genero: distGenero,
    dist_edad: distEdad,
    respuestas,
  });
});

export { router as resultadosRouter };
