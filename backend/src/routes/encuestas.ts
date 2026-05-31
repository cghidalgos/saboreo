import { Router, type Request, type Response } from "express";
import { pool } from "../db.js";
import { requireAuth, type AuthRequest } from "./auth.js";
import { z } from "zod";

const router = Router();

const preguntaSchema = z.object({
  id: z.string(),
  tipo: z.enum(["escala", "texto", "si_no", "opcion_multiple"]),
  texto: z.string().trim().min(1).max(500),
  requerida: z.boolean().default(true),
  opciones: z.array(z.string().trim()).optional(),
  escala_min: z.number().int().optional(),
  escala_max: z.number().int().optional(),
  etiqueta_min: z.string().trim().max(60).optional(),
  etiqueta_max: z.string().trim().max(60).optional(),
});

const encuestaSchema = z.object({
  titulo: z.string().trim().min(3).max(200),
  descripcion: z.string().trim().max(2000).optional(),
  producto: z.string().trim().min(2).max(200),
  estado: z.enum(["borrador", "activa", "cerrada"]).optional().default("activa"),
  num_muestras: z.number().int().min(1).max(30).optional().default(1),
  instrucciones: z.string().trim().max(3000).optional().nullable(),
  atributos: z.array(z.string().trim().min(1).max(50)).min(1).max(10).optional(),
  preguntas: z.array(preguntaSchema).max(30).optional(),
  texto_consentimiento: z.string().trim().max(2000).optional().nullable(),
  texto_alergia: z.string().trim().max(500).optional().nullable(),
  campos_participante: z.array(z.object({
    key:      z.string(),
    label:    z.string().trim().min(1).max(100),
    tipo:     z.enum(["texto", "numero", "select"]),
    activo:   z.boolean(),
    requerido: z.boolean(),
    opciones: z.array(z.string()).optional(),
  })).optional(),
  usar_consentimiento: z.boolean().optional(),
  consentimiento_id:   z.string().uuid().optional().nullable(),
});

const evaluacionSchema = z.object({
  numero_muestra: z.number().int().min(1),
  calificacion: z.number().int().min(1).max(5).optional(),
  observaciones: z.string().trim().max(500).optional(),
});

const respuestaSchema = z.object({
  participante_nombre: z.string().trim().min(2).max(120),
  participante_edad: z.number().int().min(3).max(18),
  participante_genero: z.enum(["niño", "niña", "otro"]).optional(),
  participante_institucion: z.string().trim().max(200).optional(),
  consentimiento: z.boolean(),
  tiene_alergia: z.boolean().optional(),
  escala_hedonica: z.number().int().min(1).max(5).optional(),
  comentarios: z.string().trim().max(1000).optional(),
  evaluaciones: z.array(evaluacionSchema).optional(),
});

// GET /api/encuestas/publicas — encuestas activas sin auth
router.get("/publicas", async (_req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT e.id, e.titulo, e.descripcion, e.producto, e.num_muestras,
            e.instrucciones, e.atributos, e.texto_consentimiento,
            p.full_name AS creado_por_nombre,
            COUNT(r.id)::int AS total_respuestas
     FROM encuestas e
     LEFT JOIN respuestas_encuesta r ON r.encuesta_id = e.id
     LEFT JOIN profiles p ON p.id = e.creado_por
     WHERE e.estado = 'activa'
     GROUP BY e.id, p.full_name
     ORDER BY e.created_at DESC`
  );
  res.json(rows);
});

// GET /api/encuestas/publicas/:id — detalle público sin auth
router.get("/publicas/:id", async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT e.*, p.full_name AS creado_por_nombre
     FROM encuestas e
     LEFT JOIN profiles p ON p.id = e.creado_por
     WHERE e.id = $1 AND e.estado = 'activa'`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Encuesta no encontrada" });
  res.json(rows[0]);
});

// POST /api/encuestas/publicas/:id/respuestas — respuesta pública sin auth
router.post("/publicas/:id/respuestas", async (req: Request, res: Response) => {
  const parsed = respuestaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const { rows: enc } = await pool.query(
    `SELECT id, num_muestras FROM encuestas WHERE id = $1 AND estado = 'activa'`,
    [req.params.id]
  );
  if (!enc[0]) return res.status(404).json({ error: "Encuesta no encontrada o cerrada" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [resp] } = await client.query(
      `INSERT INTO respuestas_encuesta
         (encuesta_id, participante_nombre, participante_edad, participante_genero,
          participante_institucion, consentimiento, tiene_alergia, escala_hedonica,
          comentarios, respuestas_extra)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [req.params.id, d.participante_nombre, d.participante_edad, d.participante_genero ?? null,
       d.participante_institucion ?? null, d.consentimiento, d.tiene_alergia ?? null,
       d.escala_hedonica ?? null, d.comentarios ?? null,
       req.body.respuestas_extra ? JSON.stringify(req.body.respuestas_extra) : null]
    );
    if (d.evaluaciones?.length) {
      for (const ev of d.evaluaciones) {
        await client.query(
          `INSERT INTO evaluaciones_muestra (respuesta_id, numero_muestra, calificacion, observaciones)
           VALUES ($1,$2,$3,$4)`,
          [resp.id, ev.numero_muestra, ev.calificacion ?? null, ev.observaciones ?? null]
        );
      }
    }
    await client.query("COMMIT");
    res.status(201).json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// GET /api/encuestas
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const { rows } = await pool.query(
    `SELECT e.*,
      COUNT(r.id)::int AS total_respuestas,
      p.full_name AS creado_por_nombre
     FROM encuestas e
     LEFT JOIN respuestas_encuesta r ON r.encuesta_id = e.id
     LEFT JOIN profiles p ON p.id = e.creado_por
     WHERE e.creado_por = $1
     GROUP BY e.id, p.full_name
     ORDER BY e.created_at DESC`,
    [req.userId],
  );
  res.json(rows);
});

// POST /api/encuestas
router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = encuestaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0].message });
    return;
  }
  const { titulo, descripcion, producto, estado, num_muestras, instrucciones, atributos, preguntas } = parsed.data;
  const { rows } = await pool.query(
    `INSERT INTO encuestas (titulo, descripcion, producto, estado, num_muestras, instrucciones, atributos, preguntas, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [titulo, descripcion ?? null, producto, estado, num_muestras ?? 1,
     instrucciones ?? null, JSON.stringify(atributos ?? ["SABOR"]),
     JSON.stringify(preguntas ?? []), req.userId],
  );
  res.status(201).json(rows[0]);
});

// GET /api/encuestas/:id
router.get("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const { rows } = await pool.query(
    `SELECT e.*, COUNT(r.id)::int AS total_respuestas
     FROM encuestas e
     LEFT JOIN respuestas_encuesta r ON r.encuesta_id = e.id
     WHERE e.id = $1
     GROUP BY e.id`,
    [req.params.id],
  );
  if (!rows[0]) { res.status(404).json({ message: "Encuesta no encontrada" }); return; }
  res.json(rows[0]);
});

// PATCH /api/encuestas/:id
router.patch("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = encuestaSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0].message });
    return;
  }
  const JSONB_FIELDS = new Set(["atributos", "preguntas", "campos_participante"]);
  const entries = Object.entries(parsed.data).filter(([, v]) => v !== undefined);
  if (!entries.length) { res.json({ message: "Sin cambios" }); return; }

  const setClause = entries.map(([k], i) => `${k} = $${i + 3}`).join(", ");
  const values = entries.map(([k, v]) =>
    JSONB_FIELDS.has(k) ? JSON.stringify(v) : v,
  );
  const { rows } = await pool.query(
    `UPDATE encuestas SET ${setClause} WHERE id = $1 AND creado_por = $2 RETURNING *`,
    [req.params.id, req.userId, ...values],
  );
  if (!rows[0]) { res.status(404).json({ message: "Encuesta no encontrada" }); return; }
  res.json(rows[0]);
});

// DELETE /api/encuestas/:id
router.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const { rowCount } = await pool.query(
    "DELETE FROM encuestas WHERE id = $1 AND creado_por = $2",
    [req.params.id, req.userId],
  );
  if (!rowCount) { res.status(404).json({ message: "Encuesta no encontrada" }); return; }
  res.json({ message: "Eliminada" });
});

// GET /api/encuestas/:id/respuestas
router.get("/:id/respuestas", requireAuth, async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT r.*,
      COALESCE(
        json_agg(
          json_build_object(
            'numero_muestra', em.numero_muestra,
            'calificacion', em.calificacion,
            'observaciones', em.observaciones
          ) ORDER BY em.numero_muestra
        ) FILTER (WHERE em.id IS NOT NULL),
        '[]'
      ) AS evaluaciones
     FROM respuestas_encuesta r
     LEFT JOIN evaluaciones_muestra em ON em.respuesta_id = r.id
     WHERE r.encuesta_id = $1
     GROUP BY r.id
     ORDER BY r.created_at DESC`,
    [req.params.id],
  );
  res.json(rows);
});

// POST /api/encuestas/:id/respuestas
router.post("/:id/respuestas", requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = respuestaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0].message });
    return;
  }
  const d = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO respuestas_encuesta
       (encuesta_id, participante_nombre, participante_edad, participante_genero,
        participante_institucion, consentimiento, tiene_alergia, escala_hedonica, comentarios, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.params.id, d.participante_nombre, d.participante_edad,
       d.participante_genero ?? null, d.participante_institucion ?? null,
       d.consentimiento, d.tiene_alergia ?? null,
       d.escala_hedonica ?? null, d.comentarios ?? null, req.userId],
    );
    const respuestaId = rows[0].id;

    if (d.evaluaciones && d.evaluaciones.length > 0) {
      for (const ev of d.evaluaciones) {
        await client.query(
          `INSERT INTO evaluaciones_muestra (respuesta_id, numero_muestra, calificacion, observaciones)
           VALUES ($1, $2, $3, $4)`,
          [respuestaId, ev.numero_muestra, ev.calificacion ?? null, ev.observaciones ?? null],
        );
      }
    }
    await client.query("COMMIT");
    res.status(201).json({ ...rows[0], evaluaciones: d.evaluaciones ?? [] });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// DELETE /api/encuestas/:id/respuestas/:respId
router.delete("/:id/respuestas/:respId", requireAuth, async (req: AuthRequest, res: Response) => {
  // Verificar que la encuesta pertenece al usuario antes de borrar
  const { rows: enc } = await pool.query(
    `SELECT id FROM encuestas WHERE id = $1 AND creado_por = $2`,
    [req.params.id, req.userId],
  );
  if (!enc[0]) return res.status(404).json({ error: "Encuesta no encontrada" });

  await pool.query(
    `DELETE FROM respuestas_encuesta WHERE id = $1 AND encuesta_id = $2`,
    [req.params.respId, req.params.id],
  );
  res.status(204).send();
});

export { router as encuestasRouter };
