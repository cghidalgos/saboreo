import { Router, type Response } from "express";
import { pool } from "../db.js";
import { requireAuth, type AuthRequest } from "./auth.js";
import { z } from "zod";

const router = Router();

const investigadorSchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  email:  z.string().trim().max(200).optional(),
  tel:    z.string().trim().max(50).optional(),
});

const ingredienteSchema = z.object({
  ingrediente: z.string().trim().min(1).max(200),
  marca:       z.string().trim().max(200).optional(),
  porcentaje:  z.string().trim().max(50).optional(),
});

const consentimientoSchema = z.object({
  titulo:               z.string().trim().min(2).max(200),
  titulo_investigacion: z.string().trim().max(1000).optional().nullable(),
  investigadores:       z.array(investigadorSchema).optional().default([]),
  texto_intro:          z.string().trim().max(3000).optional().nullable(),
  ingredientes:         z.array(ingredienteSchema).optional().default([]),
  tiene_pregunta_alergia: z.boolean().optional().default(true),
  texto_alergia:        z.string().trim().max(500).optional().nullable(),
  parrafos:             z.array(z.string().trim().max(3000)).optional().default([]),
  texto_contacto:       z.string().trim().max(1000).optional().nullable(),
});

const JSONB_FIELDS = new Set(["investigadores", "ingredientes", "parrafos"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: unknown) { return typeof v === "string" && UUID_RE.test(v); }

// GET /api/consentimientos
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM consentimientos WHERE creado_por = $1 ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/consentimientos
router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = consentimientoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  try {
    const { rows: [row] } = await pool.query(
      `INSERT INTO consentimientos
         (titulo, titulo_investigacion, investigadores, texto_intro, ingredientes,
          tiene_pregunta_alergia, texto_alergia, parrafos, texto_contacto, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [d.titulo, d.titulo_investigacion ?? null, JSON.stringify(d.investigadores),
       d.texto_intro ?? null, JSON.stringify(d.ingredientes),
       d.tiene_pregunta_alergia, d.texto_alergia ?? null,
       JSON.stringify(d.parrafos), d.texto_contacto ?? null, req.userId]
    );
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/consentimientos/publico/:id — sin auth, para el flujo público
// IMPORTANTE: debe ir ANTES de /:id para que Express no lo interprete como un id
router.get("/publico/:id", async (req, res: Response) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: "No encontrado" });
  try {
    const { rows } = await pool.query(
      `SELECT * FROM consentimientos WHERE id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/consentimientos/:id
router.get("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: "No encontrado" });
  try {
    const { rows } = await pool.query(
      `SELECT * FROM consentimientos WHERE id = $1 AND creado_por = $2`,
      [req.params.id, req.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: "Error interno" });
  }
});

// PATCH /api/consentimientos/:id
router.patch("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: "No encontrado" });
  try {
    const { rows: existing } = await pool.query(
      `SELECT id FROM consentimientos WHERE id = $1 AND creado_por = $2`,
      [req.params.id, req.userId]
    );
    if (!existing[0]) return res.status(404).json({ error: "No encontrado" });

    const allowed = new Set(["titulo","titulo_investigacion","investigadores","texto_intro",
      "ingredientes","tiene_pregunta_alergia","texto_alergia","parrafos","texto_contacto"]);
    const sets: string[] = [];
    const vals: unknown[] = [];

    for (const [k, v] of Object.entries(req.body)) {
      if (!allowed.has(k)) continue;
      sets.push(`${k} = $${vals.length + 1}`);
      vals.push(JSONB_FIELDS.has(k) ? JSON.stringify(v) : v);
    }
    if (!sets.length) return res.status(400).json({ error: "Nada que actualizar" });

    vals.push(req.params.id);
    const { rows: [row] } = await pool.query(
      `UPDATE consentimientos SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/consentimientos/:id
router.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: "No encontrado" });
  try {
    await pool.query(
      `DELETE FROM consentimientos WHERE id = $1 AND creado_por = $2`,
      [req.params.id, req.userId]
    );
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: "Error interno" });
  }
});

export { router as consentimientosRouter };
