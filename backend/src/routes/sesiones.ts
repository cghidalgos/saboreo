import { Router, type Response } from "express";
import { pool } from "../db.js";
import { requireAuth, type AuthRequest } from "./auth.js";
import { z } from "zod";
import { analizarMuestraConClaude } from "../lib/claude.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string) { return UUID_RE.test(v); }

const router = Router();

const createSchema = z.object({
  titulo: z.string().trim().min(3).max(200),
  participante_nombre: z.string().trim().min(2).max(120),
  participante_edad: z.number().int().min(3).max(18),
  encuesta_id: z.string().uuid().optional(),
  notas: z.string().trim().max(1000).optional(),
});

const updateSchema = z.object({
  estado: z.enum(["pendiente", "grabando", "completada", "cancelada"]).optional(),
  duracion_seg: z.number().int().min(0).optional(),
  score_ia: z.number().int().min(0).max(100).optional(),
  emociones: z.record(z.number()).optional(),
  notas: z.string().trim().max(1000).optional(),
});

// GET /api/sesiones
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const { rows } = await pool.query(
    `SELECT s.*, e.titulo AS encuesta_titulo
     FROM sesiones s
     LEFT JOIN encuestas e ON e.id = s.encuesta_id
     WHERE s.investigador_id = $1
     ORDER BY s.created_at DESC`,
    [req.userId],
  );
  res.json(rows);
});

// POST /api/sesiones
router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0].message });
    return;
  }
  const d = parsed.data;
  const { rows } = await pool.query(
    `INSERT INTO sesiones
     (titulo, participante_nombre, participante_edad, encuesta_id, notas, investigador_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [d.titulo, d.participante_nombre, d.participante_edad,
     d.encuesta_id ?? null, d.notas ?? null, req.userId],
  );
  res.status(201).json(rows[0]);
});

// GET /api/sesiones/:id
router.get("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const { rows } = await pool.query(
    `SELECT s.*, e.titulo AS encuesta_titulo
     FROM sesiones s
     LEFT JOIN encuestas e ON e.id = s.encuesta_id
     WHERE s.id = $1 AND s.investigador_id = $2`,
    [req.params.id, req.userId],
  );
  if (!rows[0]) { res.status(404).json({ message: "Sesión no encontrada" }); return; }
  res.json(rows[0]);
});

// PATCH /api/sesiones/:id
router.patch("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0].message });
    return;
  }
  const fields = Object.entries(parsed.data).filter(([, v]) => v !== undefined);
  if (!fields.length) { res.json({ message: "Sin cambios" }); return; }

  const setClause = fields.map(([k], i) => {
    if (k === "emociones") return `emociones = $${i + 3}::jsonb`;
    return `${k} = $${i + 3}`;
  }).join(", ");

  const values = fields.map(([k, v]) =>
    k === "emociones" ? JSON.stringify(v) : v,
  );

  const { rows } = await pool.query(
    `UPDATE sesiones SET ${setClause} WHERE id = $1 AND investigador_id = $2 RETURNING *`,
    [req.params.id, req.userId, ...values],
  );
  if (!rows[0]) { res.status(404).json({ message: "Sesión no encontrada" }); return; }
  res.json(rows[0]);
});

// DELETE /api/sesiones/:id
router.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const { rowCount } = await pool.query(
    "DELETE FROM sesiones WHERE id = $1 AND investigador_id = $2",
    [req.params.id, req.userId],
  );
  if (!rowCount) { res.status(404).json({ message: "Sesión no encontrada" }); return; }
  res.json({ message: "Eliminada" });
});

// ── IA por muestra ────────────────────────────────────────────────────────────

const analizarMuestraSchema = z.object({
  numero_muestra: z.number().int().min(1).max(100),
  frames: z.array(z.string().min(10)).min(1).max(10),
  transcripcion: z.string().max(2000).optional(),
  duracion_seg: z.number().int().min(0).optional(),
});

// POST /api/sesiones/:id/analizar-muestra
router.post("/:id/analizar-muestra", requireAuth, async (req: AuthRequest, res: Response) => {
  if (!isUuid(req.params.id)) { res.status(400).json({ message: "ID inválido" }); return; }

  // Verificar que la sesión pertenece al usuario
  const { rows: sesRows } = await pool.query(
    "SELECT id FROM sesiones WHERE id = $1 AND investigador_id = $2",
    [req.params.id, req.userId],
  );
  if (!sesRows[0]) { res.status(404).json({ message: "Sesión no encontrada" }); return; }

  const parsed = analizarMuestraSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0].message });
    return;
  }

  const { numero_muestra, frames, transcripcion, duracion_seg } = parsed.data;

  try {
    const analisis = await analizarMuestraConClaude(frames, transcripcion);

    const { rows } = await pool.query(
      `INSERT INTO analisis_muestras
         (sesion_id, numero_muestra, frames_analizados, emociones, emocion_dominante,
          transcripcion, sentimiento_voz, score_ia, resumen_ia, duracion_seg)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (sesion_id, numero_muestra) DO UPDATE SET
         frames_analizados = EXCLUDED.frames_analizados,
         emociones         = EXCLUDED.emociones,
         emocion_dominante = EXCLUDED.emocion_dominante,
         transcripcion     = EXCLUDED.transcripcion,
         sentimiento_voz   = EXCLUDED.sentimiento_voz,
         score_ia          = EXCLUDED.score_ia,
         resumen_ia        = EXCLUDED.resumen_ia,
         duracion_seg      = EXCLUDED.duracion_seg
       RETURNING *`,
      [
        req.params.id, numero_muestra, frames.length,
        JSON.stringify(analisis.promedio), analisis.emocion_dominante,
        transcripcion ?? null, analisis.sentimiento_voz,
        analisis.score_ia, analisis.resumen, duracion_seg ?? null,
      ],
    );
    res.json(rows[0]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error en análisis IA";
    res.status(502).json({ message: msg });
  }
});

// GET /api/sesiones/:id/analizar-muestra  →  lista de análisis de la sesión
router.get("/:id/muestras", requireAuth, async (req: AuthRequest, res: Response) => {
  if (!isUuid(req.params.id)) { res.status(400).json({ message: "ID inválido" }); return; }
  try {
    const { rows } = await pool.query(
      `SELECT am.* FROM analisis_muestras am
       JOIN sesiones s ON s.id = am.sesion_id
       WHERE am.sesion_id = $1 AND s.investigador_id = $2
       ORDER BY am.numero_muestra`,
      [req.params.id, req.userId],
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: "Error al obtener análisis" });
  }
});

export { router as sesionesRouter };
