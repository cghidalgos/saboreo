import { Router, type Response } from "express";
import { pool } from "../db.js";
import { requireAuth, type AuthRequest } from "./auth.js";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userId;

  // KPIs generales
  const { rows: kpis } = await pool.query(`
    SELECT
      COUNT(DISTINCT e.id)::int                                     AS total_encuestas,
      COUNT(DISTINCT CASE WHEN e.estado = 'activa' THEN e.id END)::int AS encuestas_activas,
      COUNT(DISTINCT r.id)::int                                     AS total_respuestas,
      COUNT(DISTINCT r.participante_nombre)::int                    AS total_participantes,
      ROUND((
        SELECT AVG(v) FROM (
          SELECT escala_hedonica AS v FROM respuestas_encuesta r2
          JOIN encuestas e2 ON e2.id = r2.encuesta_id
          WHERE e2.creado_por = $1 AND r2.escala_hedonica IS NOT NULL
          UNION ALL
          SELECT em.calificacion AS v FROM evaluaciones_muestra em
          JOIN respuestas_encuesta r2 ON r2.id = em.respuesta_id
          JOIN encuestas e2 ON e2.id = r2.encuesta_id
          WHERE e2.creado_por = $1 AND em.calificacion IS NOT NULL
        ) all_vals
      )::numeric, 2)                                               AS promedio_escala
    FROM encuestas e
    LEFT JOIN respuestas_encuesta r ON r.encuesta_id = e.id
    WHERE e.creado_por = $1
  `, [userId]);

  // Por encuesta
  const { rows: porEncuesta } = await pool.query(`
    SELECT
      e.id,
      e.titulo,
      e.producto,
      e.estado,
      e.num_muestras,
      COUNT(r.id)::int AS total_respuestas,
      ROUND((
        SELECT AVG(v) FROM (
          SELECT r2.escala_hedonica AS v FROM respuestas_encuesta r2
          WHERE r2.encuesta_id = e.id AND r2.escala_hedonica IS NOT NULL
          UNION ALL
          SELECT em.calificacion AS v FROM evaluaciones_muestra em
          JOIN respuestas_encuesta r2 ON r2.id = em.respuesta_id
          WHERE r2.encuesta_id = e.id AND em.calificacion IS NOT NULL
        ) vals
      )::numeric, 2) AS promedio_escala,
      COUNT(CASE WHEN r.tiene_alergia THEN 1 END)::int AS con_alergia
    FROM encuestas e
    LEFT JOIN respuestas_encuesta r ON r.encuesta_id = e.id
    WHERE e.creado_por = $1
    GROUP BY e.id
    ORDER BY e.created_at DESC
  `, [userId]);

  // Distribución escala hedónica global (respuesta única + evaluaciones por muestra)
  const { rows: distEscala } = await pool.query(`
    SELECT valor, SUM(cantidad)::int AS cantidad
    FROM (
      SELECT escala_hedonica AS valor, COUNT(*)::int AS cantidad
      FROM respuestas_encuesta r
      JOIN encuestas e ON e.id = r.encuesta_id
      WHERE e.creado_por = $1 AND r.escala_hedonica IS NOT NULL
      GROUP BY escala_hedonica

      UNION ALL

      SELECT em.calificacion AS valor, COUNT(*)::int AS cantidad
      FROM evaluaciones_muestra em
      JOIN respuestas_encuesta r ON r.id = em.respuesta_id
      JOIN encuestas e ON e.id = r.encuesta_id
      WHERE e.creado_por = $1 AND em.calificacion IS NOT NULL
      GROUP BY em.calificacion
    ) combined
    GROUP BY valor
    ORDER BY valor
  `, [userId]);

  // Evaluaciones por muestra (promedio de calificación por muestra para todas las encuestas)
  const { rows: porMuestra } = await pool.query(`
    SELECT
      em.numero_muestra,
      ROUND(AVG(em.calificacion)::numeric, 2) AS promedio
    FROM evaluaciones_muestra em
    JOIN respuestas_encuesta r ON r.id = em.respuesta_id
    JOIN encuestas e ON e.id = r.encuesta_id
    WHERE e.creado_por = $1 AND em.calificacion IS NOT NULL
    GROUP BY em.numero_muestra
    ORDER BY em.numero_muestra
  `, [userId]);

  // Distribución género
  const { rows: distGenero } = await pool.query(`
    SELECT
      COALESCE(r.participante_genero, 'no especificado') AS genero,
      COUNT(*)::int AS cantidad
    FROM respuestas_encuesta r
    JOIN encuestas e ON e.id = r.encuesta_id
    WHERE e.creado_por = $1
    GROUP BY r.participante_genero
  `, [userId]);

  // Distribución edad
  const { rows: distEdad } = await pool.query(`
    SELECT
      participante_edad AS edad,
      COUNT(*)::int AS cantidad
    FROM respuestas_encuesta r
    JOIN encuestas e ON e.id = r.encuesta_id
    WHERE e.creado_por = $1
    GROUP BY participante_edad
    ORDER BY participante_edad
  `, [userId]);

  // Últimas 10 respuestas
  const { rows: recientes } = await pool.query(`
    SELECT
      r.participante_nombre,
      r.participante_edad,
      r.participante_genero,
      r.escala_hedonica,
      r.tiene_alergia,
      r.created_at,
      e.titulo  AS encuesta_titulo,
      e.producto AS encuesta_producto
    FROM respuestas_encuesta r
    JOIN encuestas e ON e.id = r.encuesta_id
    WHERE e.creado_por = $1
    ORDER BY r.created_at DESC
    LIMIT 10
  `, [userId]);

  res.json({
    kpis: kpis[0],
    por_encuesta: porEncuesta,
    dist_escala: distEscala,
    por_muestra: porMuestra,
    dist_genero: distGenero,
    dist_edad: distEdad,
    recientes,
  });
});

export { router as dashboardRouter };
