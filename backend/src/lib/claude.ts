/**
 * Claude Vision client para análisis de expresiones faciales en paneles sensoriales.
 *
 * Modelo recomendado: claude-haiku-4-5-20251001 (rápido y económico, ~2 s por muestra)
 * Alternativa de mayor precisión: claude-sonnet-4-5-20250929
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-haiku-4-5-20251001";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export interface EmocionesMuestra {
  alegria: number;
  disgusto: number;
  sorpresa: number;
  neutral: number;
  tristeza: number;
  interes: number;
}

export interface ResultadoClaudeVision {
  promedio: EmocionesMuestra;
  emocion_dominante: string;
  sentimiento_voz: "positivo" | "neutro" | "negativo";
  score_ia: number;
  resumen: string;
}

function buildPrompt(transcripcion?: string): string {
  const transcripcionBloque = transcripcion?.trim()
    ? `\nTranscripción de lo que dijo el participante al probar la muestra:\n"${transcripcion.trim()}"\n`
    : "";

  return `Eres un experto en análisis de expresiones faciales para investigación sensorial de alimentos.
Estás analizando fotogramas capturados cada 2 segundos de un niño probando una muestra de alimento en un panel sensorial.
${transcripcionBloque}
Analiza las imágenes y estima el promedio de cada emoción visible (valores 0.0 a 1.0, la suma debe ser aproximadamente 1.0):
- alegria (sonrisa, ojos brillantes, cara abierta)
- disgusto (nariz fruncida, boca hacia abajo, expresión de rechazo)
- sorpresa (cejas levantadas, ojos abiertos, boca abierta)
- neutral (sin expresión clara)
- tristeza (comisuras hacia abajo, mirada baja)
- interes (atención concentrada, ligera sonrisa, inclinación)

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{
  "promedio": {"alegria": 0.0, "disgusto": 0.0, "sorpresa": 0.0, "neutral": 0.0, "tristeza": 0.0, "interes": 0.0},
  "emocion_dominante": "alegria",
  "sentimiento_voz": "positivo",
  "score_ia": 75,
  "resumen": "Descripción breve en español de la reacción del participante."
}

Para score_ia (0-100):
- alegria + interes altos → 75-100
- emociones positivas moderadas → 55-74
- neutro → 40-54
- disgusto o tristeza dominantes → 0-39`;
}

/**
 * Envía fotogramas base64 (JPEG) y transcripción opcional a Claude Vision.
 * Limita a 10 frames máximo para controlar costo y latencia.
 */
export async function analizarMuestraConClaude(
  frames: string[],
  transcripcion?: string,
): Promise<ResultadoClaudeVision> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY no configurada. Agrégala en las variables de entorno del backend.",
    );
  }

  const framesToSend = frames.slice(0, 10);

  if (framesToSend.length === 0) {
    throw new Error("Se requiere al menos 1 fotograma para analizar.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageContent: any[] = framesToSend.map((data) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: "image/jpeg",
      data,
    },
  }));

  imageContent.push({
    type: "text",
    text: buildPrompt(transcripcion),
  });

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      messages: [{ role: "user", content: imageContent }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const json = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  const text = json.content.find((b) => b.type === "text")?.text ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("La respuesta de Claude no contiene JSON válido.");

  const raw = JSON.parse(match[0]) as Record<string, unknown>;

  // Normalizar sentimiento_voz al enum esperado
  const svRaw = String(raw.sentimiento_voz ?? "").toLowerCase();
  const sentimiento_voz: "positivo" | "neutro" | "negativo" =
    svRaw.startsWith("pos") ? "positivo"
    : svRaw.startsWith("neg") ? "negativo"
    : "neutro";

  // Clamp score_ia a 0-100
  const scoreRaw = Number(raw.score_ia);
  const score_ia = isNaN(scoreRaw) ? 50 : Math.max(0, Math.min(100, Math.round(scoreRaw)));

  // Truncar resumen a 1000 caracteres
  const resumen = String(raw.resumen ?? "").slice(0, 1000);

  const parsed: ResultadoClaudeVision = {
    promedio: (raw.promedio as EmocionesMuestra) ?? { alegria: 0, disgusto: 0, sorpresa: 0, neutral: 0, tristeza: 0, interes: 0 },
    emocion_dominante: String(raw.emocion_dominante ?? "neutral"),
    sentimiento_voz,
    score_ia,
    resumen,
  };
  return parsed;
}
