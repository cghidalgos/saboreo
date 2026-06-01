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
          'video_url',         em.video_url,
          'transcripcion',     em.transcripcion
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

// POST /api/encuestas/:id/respuestas/:respId/resumen-participante
// Genera con Claude un análisis global del participante combinando todas sus muestras
router.post("/:respId/resumen-participante", requireAuth, async (req: AuthRequest, res: Response) => {
  const { id, respId } = req.params;

  // Verificar acceso a la encuesta
  const { rows: enc } = await pool.query(
    "SELECT titulo, num_muestras FROM encuestas WHERE id = $1 AND creado_por = $2",
    [id, req.userId],
  );
  if (!enc[0]) { res.status(404).json({ message: "Encuesta no encontrada" }); return; }

  // Obtener evaluaciones del participante
  const { rows: evals } = await pool.query(
    `SELECT em.numero_muestra, em.calificacion, em.score_ia, em.emocion_dominante,
            em.sentimiento_voz, em.resumen_ia, em.transcripcion, em.emociones
     FROM evaluaciones_muestra em
     JOIN respuestas_encuesta r ON r.id = em.respuesta_id
     WHERE r.id = $1 AND r.encuesta_id = $2
     ORDER BY em.numero_muestra`,
    [respId, id],
  );
  if (!evals.length) { res.status(404).json({ message: "Sin evaluaciones" }); return; }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
  const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-haiku-4-5-20251001";
  if (!ANTHROPIC_API_KEY) { res.status(500).json({ message: "ANTHROPIC_API_KEY no configurada" }); return; }

  // Construir resumen textual de las muestras para el prompt
  const muestrasTexto = evals.map((ev) => {
    const partes = [`Muestra #${ev.numero_muestra}:`];
    if (ev.calificacion) partes.push(`calificación declarada ${ev.calificacion}/5`);
    if (ev.score_ia != null) partes.push(`score IA facial ${ev.score_ia}/100`);
    if (ev.emocion_dominante) partes.push(`emoción dominante: ${ev.emocion_dominante}`);
    if (ev.sentimiento_voz) partes.push(`sentimiento de voz: ${ev.sentimiento_voz}`);
    if (ev.transcripcion) partes.push(`lo que dijo: "${ev.transcripcion}"`);
    if (ev.resumen_ia) partes.push(`análisis facial: ${ev.resumen_ia}`);
    return partes.join(", ");
  }).join("\n");

  const prompt = `Eres un experto en análisis sensorial de alimentos para paneles con niños.
Un participante probó ${evals.length} muestra(s) de "${enc[0].titulo}".

Datos por muestra:
${muestrasTexto}

Responde ÚNICAMENTE con JSON válido (sin texto adicional):
{
  "muestra_favorita": <número de muestra o null si no se puede determinar>,
  "resumen": "<2-3 oraciones en español explicando cuál muestra gustó más y por qué, combinando la calificación declarada con la reacción facial. Si hay discrepancia entre lo que dijo y lo que mostró su cara, menciónalo.>"
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    res.status(502).json({ message: `Claude error: ${err}` }); return;
  }

  const json = await response.json() as { content: Array<{ type: string; text: string }> };
  const text = json.content.find((b) => b.type === "text")?.text ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) { res.status(502).json({ message: "Claude no devolvió JSON" }); return; }

  const parsed = JSON.parse(match[0]) as { muestra_favorita: number | null; resumen: string };
  res.json(parsed);
});

export { router as resultadosRouter };

// POST /api/encuestas/:id/chat
router.post("/chat", requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { mensaje, historial = [] } = req.body as {
    mensaje?: string;
    historial?: { role: "user" | "assistant"; content: string }[];
  };

  const { rows: enc } = await pool.query(
    "SELECT titulo, producto, num_muestras FROM encuestas WHERE id = $1 AND creado_por = $2",
    [id, req.userId],
  );
  if (!enc[0]) { res.status(404).json({ message: "Encuesta no encontrada" }); return; }

  // Construir contexto completo de resultados
  const { rows: respuestas } = await pool.query(
    `SELECT r.participante_nombre, r.participante_edad, r.participante_genero,
            json_agg(json_build_object(
              'muestra', em.numero_muestra,
              'calificacion', em.calificacion,
              'score_ia', em.score_ia,
              'emocion', em.emocion_dominante,
              'sentimiento', em.sentimiento_voz,
              'transcripcion', em.transcripcion
            ) ORDER BY em.numero_muestra) FILTER (WHERE em.id IS NOT NULL) AS evaluaciones
     FROM respuestas_encuesta r
     LEFT JOIN evaluaciones_muestra em ON em.respuesta_id = r.id
     WHERE r.encuesta_id = $1
     GROUP BY r.id ORDER BY r.created_at`,
    [id],
  );

  const { rows: porMuestra } = await pool.query(
    `SELECT numero_muestra,
            ROUND(AVG(calificacion)::numeric, 2) AS prom_calif,
            ROUND(AVG(score_ia)::numeric, 1) AS prom_score_ia
     FROM evaluaciones_muestra em
     JOIN respuestas_encuesta r ON r.id = em.respuesta_id
     WHERE r.encuesta_id = $1
     GROUP BY numero_muestra ORDER BY numero_muestra`,
    [id],
  );

  const contexto = `Encuesta: "${enc[0].titulo}" — Producto: ${enc[0].producto} — ${enc[0].num_muestras} muestras.

Promedios por muestra:
${porMuestra.map((m) => `  Muestra #${m.numero_muestra}: calificación promedio ${m.prom_calif}/5${m.prom_score_ia != null ? `, score IA promedio ${m.prom_score_ia}/100` : ""}`).join("\n")}

Participantes (${respuestas.length}):
${respuestas.map((r) => {
  const evs = (r.evaluaciones ?? []) as { muestra: number; calificacion: number | null; score_ia: number | null; emocion: string | null; sentimiento: string | null; transcripcion: string | null }[];
  const lineas = evs.map((e) => {
    const partes = [`M${e.muestra}: calif ${e.calificacion ?? "—"}/5`];
    if (e.score_ia != null) partes.push(`IA ${e.score_ia}/100`);
    if (e.emocion) partes.push(e.emocion);
    if (e.sentimiento) partes.push(e.sentimiento);
    if (e.transcripcion) partes.push(`"${e.transcripcion}"`);
    return partes.join(", ");
  });
  return `  ${r.participante_nombre} (${r.participante_edad}a, ${r.participante_genero ?? "sin género"}): ${lineas.join(" | ")}`;
}).join("\n")}`;

  const sistemaPrompt = `Eres un asistente experto en análisis sensorial de alimentos para paneles con niños.
Tienes acceso a los resultados completos de una encuesta sensorial. Responde en español, de forma clara y concisa.
Cuando menciones muestras, usa el formato "Muestra #N".
IMPORTANTE: No uses markdown excepto negritas. Para resaltar datos clave (nombres de muestras, números, conclusiones) usa **texto en negrita**. Usa saltos de línea reales para separar ideas. Cuando hagas listas, pon cada item en su propia línea comenzando con un guion y espacio ("- item"). Deja una línea en blanco entre párrafos o secciones.

DATOS DE LA ENCUESTA:
${contexto}`;

  const mensajesClaud = [
    ...historial.map((h) => ({ role: h.role, content: h.content })),
    { role: "user" as const, content: mensaje ?? "Dame un resumen general de los resultados: ¿cuál muestra gustó más a los participantes en general? Combina tanto la calificación declarada como el score IA facial si está disponible. Sé breve (3-4 oraciones)." },
  ];

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
  const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-haiku-4-5-20251001";
  if (!ANTHROPIC_API_KEY) { res.status(500).json({ message: "ANTHROPIC_API_KEY no configurada" }); return; }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      system: sistemaPrompt,
      messages: mensajesClaud,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    res.status(502).json({ message: `Claude error: ${err}` }); return;
  }

  const json = await response.json() as { content: Array<{ type: string; text: string }> };
  const texto = json.content.find((b) => b.type === "text")?.text ?? "";
  res.json({ respuesta: texto });
});
