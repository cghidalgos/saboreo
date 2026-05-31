import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { CheckCircle2, AlertCircle, ArrowLeft, Loader2, Video, StopCircle } from "lucide-react";
import { apiFetch } from "@/integrations/api/client";

export const Route = createFileRoute("/encuesta/$id")({
  head: () => ({ meta: [{ title: "Encuesta sensorial — SABOREO" }] }),
  component: TomarEncuestaPage,
});

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface CampoParticipante {
  key: string; label: string;
  tipo: "texto" | "numero" | "select";
  activo: boolean; requerido: boolean;
  opciones?: string[];
}

interface Pregunta {
  id: string;
  tipo: "escala" | "texto" | "si_no" | "opcion_multiple";
  texto: string; requerida: boolean;
  opciones?: string[];
  escala_min?: number; escala_max?: number;
  etiqueta_min?: string; etiqueta_max?: string;
}

interface Encuesta {
  id: string;
  titulo: string;
  descripcion: string | null;
  producto: string;
  num_muestras: number;
  instrucciones: string | null;
  atributos: string[];
  preguntas: Pregunta[];
  texto_consentimiento: string | null;
  texto_alergia: string | null;
  campos_participante: CampoParticipante[] | null;
  usar_consentimiento: boolean;
  consentimiento_id: string | null;
  requiere_video: boolean;
  creado_por_nombre: string | null;
}

interface ConsentimientoData {
  titulo: string;
  titulo_investigacion: string | null;
  investigadores: { nombre: string; email?: string; tel?: string }[];
  texto_intro: string | null;
  ingredientes: { ingrediente: string; marca?: string; porcentaje?: string }[];
  tiene_pregunta_alergia: boolean;
  texto_alergia: string | null;
  parrafos: string[];
  texto_contacto: string | null;
}

interface EvalMuestraState {
  calificacion: number;
  observaciones: string;
  videoGrabado: boolean;
  score_ia?: number;
  emociones?: Record<string, number>;
  emocion_dominante?: string;
  sentimiento_voz?: string;
  resumen_ia?: string;
  frames_analizados?: number;
  video_url?: string;
}

const ESCALA = [
  { val: 1, emoji: "😢", label: "Me disgusta mucho",         color: "border-red-400 bg-red-50 text-red-700"       },
  { val: 2, emoji: "😕", label: "Me disgusta poco",          color: "border-orange-400 bg-orange-50 text-orange-700" },
  { val: 3, emoji: "😐", label: "Ni me gusta ni me disgusta", color: "border-yellow-400 bg-yellow-50 text-yellow-700" },
  { val: 4, emoji: "😊", label: "Me gusta",                  color: "border-green-400 bg-green-50 text-green-700"   },
  { val: 5, emoji: "😍", label: "¡Me gusta mucho!",          color: "border-sky-400 bg-sky-50 text-sky-700"         },
];

// ── Componente principal ──────────────────────────────────────────────────────

function TomarEncuestaPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [encuesta, setEncuesta] = useState<Encuesta | null>(null);
  const [consentimientoData, setConsentimientoData] = useState<ConsentimientoData | null>(null);
  const [etapa, setEtapa] = useState<"consentimiento" | "encuesta">("encuesta");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [saving, setSaving] = useState(false);

  // Estado del formulario
  const [consentimiento, setConsentimiento] = useState(false);
  const [tieneAlergia, setTieneAlergia] = useState<boolean | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [evalMuestras, setEvalMuestras] = useState<EvalMuestraState[]>([]);
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [comentarios, setComentarios] = useState("");

  useEffect(() => {
    apiFetch<Encuesta>(`/api/encuestas/publicas/${id}`)
      .then(async (data) => {
        setEncuesta(data);
        const c = data.campos_participante?.filter((c) => c.activo) ?? [];
        setCampos(Object.fromEntries(c.map((f) => [f.key, ""])));
        setEvalMuestras(Array.from({ length: data.num_muestras }, () => ({ calificacion: 0, observaciones: "", videoGrabado: false })));
        // Si tiene consentimiento formal, cargarlo y mostrar esa etapa primero
        if (data.usar_consentimiento && data.consentimiento_id) {
          try {
            const consent = await apiFetch<ConsentimientoData>(`/api/consentimientos/publico/${data.consentimiento_id}`);
            setConsentimientoData(consent);
            setEtapa("consentimiento");
          } catch { /* sin consentimiento, ir directo a encuesta */ }
        }
      })
      .catch(() => setError("Esta encuesta no está disponible o ya fue cerrada."))
      .finally(() => setLoading(false));
  }, [id]);

  function setEval(idx: number, field: "calificacion" | "observaciones", value: number | string) {
    setEvalMuestras((p) => p.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }

  async function handleSubmit() {
    if (!encuesta) return;
    if (!consentimiento) { alert("Por favor confirma el consentimiento informado."); return; }

    const camposActivos = encuesta.campos_participante?.filter((c) => c.activo) ?? [];
    for (const c of camposActivos) {
      if (c.requerido && !campos[c.key]?.trim()) {
        alert(`El campo "${c.label}" es requerido.`); return;
      }
    }

    if (encuesta.requiere_video) {
      const sinVideo = evalMuestras.filter((m) => !m.videoGrabado).length;
      if (sinVideo > 0) {
        alert(`Faltan ${sinVideo} muestra${sinVideo > 1 ? "s" : ""} por grabar en video.`); return;
      }
    }
    const sinCalificar = evalMuestras.filter((m) => !m.calificacion).length;
    if (sinCalificar > 0) {
      alert(`Faltan ${sinCalificar} muestra${sinCalificar > 1 ? "s" : ""} por calificar.`); return;
    }

    for (const q of (encuesta.preguntas ?? [])) {
      if (q.requerida && !extras[q.id]) {
        alert(`La pregunta "${q.texto.slice(0, 50)}" es requerida.`); return;
      }
    }

    setSaving(true);
    try {
      await apiFetch(`/api/encuestas/publicas/${id}/respuestas`, {
        method: "POST",
        body: JSON.stringify({
          participante_nombre: campos["nombre"] ?? "Anónimo",
          participante_edad: parseInt(campos["edad"] ?? "0"),
          participante_genero: campos["genero"]?.toLowerCase() || undefined,
          participante_institucion: campos["institucion"] || undefined,
          consentimiento,
          tiene_alergia: tieneAlergia ?? undefined,
          comentarios: comentarios || undefined,
          respuestas_extra: extras,
          evaluaciones: evalMuestras.map((m, i) => ({
            numero_muestra: i + 1,
            calificacion: m.calificacion || undefined,
            observaciones: m.observaciones || undefined,
            score_ia: m.score_ia,
            emociones: m.emociones,
            emocion_dominante: m.emocion_dominante,
            sentimiento_voz: m.sentimiento_voz,
            resumen_ia: m.resumen_ia,
            frames_analizados: m.frames_analizados,
            video_url: m.video_url,
          })),
        }),
      });
      setEnviado(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al enviar la respuesta.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]">
      <Loader2 className="h-10 w-10 animate-spin text-[#4F86C6]" />
    </div>
  );

  if (error) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8f7f4] px-4 text-center">
      <AlertCircle className="h-14 w-14 text-red-400" />
      <h1 className="text-xl font-bold text-gray-800">{error}</h1>
      <button onClick={() => navigate({ to: "/" })} className="text-sm font-semibold text-[#4F86C6] hover:underline">
        ← Volver al inicio
      </button>
    </div>
  );

  if (!encuesta) return null;

  // ── Etapa: Consentimiento formal ───────────────────────────────────────────
  if (etapa === "consentimiento" && consentimientoData) {
    return <PaginaConsentimiento
      encuesta={encuesta}
      data={consentimientoData}
      onAceptar={() => setEtapa("encuesta")}
      onVolver={() => navigate({ to: "/" })}
    />;
  }

  if (enviado) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#f8f7f4] px-4 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
        <CheckCircle2 className="h-12 w-12 text-green-600" />
      </div>
      <div>
        <h1 className="text-2xl font-black text-gray-900">¡Gracias por participar!</h1>
        <p className="mt-2 text-gray-500">Tu respuesta ha sido registrada correctamente.</p>
      </div>
      <button
        onClick={() => navigate({ to: "/" })}
        className="rounded-full bg-[#4F86C6] px-8 py-3 text-sm font-bold text-white hover:opacity-90"
      >
        Volver al inicio
      </button>
    </div>
  );

  const camposActivos = encuesta.campos_participante?.filter((c) => c.activo) ?? [];
  const textoConsent = encuesta.texto_consentimiento || "El padre/madre o tutor autoriza la participación del menor en esta evaluación sensorial, incluyendo la captura de datos con fines científicos.";
  const textoAlergia = encuesta.texto_alergia || "¿El participante tiene algún tipo de alergia a los ingredientes del producto?";
  const atributos = encuesta.atributos?.length ? encuesta.atributos : ["SABOR"];

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <button onClick={() => navigate({ to: "/" })} className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-gray-900">{encuesta.titulo}</h1>
            <p className="truncate text-xs text-gray-400">{encuesta.producto}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Banner */}
        <div className="rounded-2xl bg-gradient-to-br from-[#4F86C6] to-[#6B9FD4] p-6 text-white shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">Evaluación sensorial</p>
          <h2 className="text-2xl font-black leading-tight">{encuesta.titulo}</h2>
          {encuesta.descripcion && <p className="mt-2 text-sm opacity-80 leading-relaxed">{encuesta.descripcion}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">{encuesta.producto}</span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">{encuesta.num_muestras} {encuesta.num_muestras === 1 ? "muestra" : "muestras"}</span>
            {atributos.map((a) => (
              <span key={a} className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">{a}</span>
            ))}
          </div>
        </div>

        {/* Instrucciones */}
        {encuesta.instrucciones && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <h3 className="mb-3 flex items-center gap-2 font-bold text-blue-800">
              <AlertCircle className="h-4 w-4" /> Instrucciones
            </h3>
            <ul className="space-y-1.5">
              {encuesta.instrucciones.split("\n").filter(Boolean).map((l, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-blue-700">
                  <span className="mt-0.5 shrink-0 text-blue-400">•</span>
                  {l.replace(/^[•\-\*]\s*/, "")}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 1. Consentimiento */}
        <Section numero={1} titulo="Consentimiento informado">
          <p className="mb-4 text-sm leading-relaxed text-gray-500 text-justify">{textoConsent}</p>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-[#4F86C6]">
            <input type="checkbox" checked={consentimiento}
              onChange={(e) => setConsentimiento(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#4F86C6]"
            />
            <span className="text-sm font-medium text-gray-700">Confirmo que cuento con el consentimiento del tutor o padre/madre</span>
          </label>
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-gray-700">{textoAlergia}</p>
            <div className="flex gap-4">
              {[{ val: false, label: "No" }, { val: true, label: "Sí, tiene alergia" }].map(({ val, label }) => (
                <label key={label} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${tieneAlergia === val ? "border-[#4F86C6] bg-blue-50 text-[#4F86C6]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  <input type="radio" checked={tieneAlergia === val}
                    onChange={() => setTieneAlergia(val)}
                    className="accent-[#4F86C6]" />
                  {label}
                </label>
              ))}
            </div>
            {tieneAlergia === true && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                El participante reporta alergia. Verifique con el tutor antes de continuar.
              </div>
            )}
          </div>
        </Section>

        {/* 2. Datos del participante */}
        {camposActivos.length > 0 && (
          <Section numero={2} titulo="Datos del participante">
            <div className="grid gap-3 sm:grid-cols-2">
              {camposActivos.map((c) => (
                <div key={c.key} className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {c.label}{c.requerido && <span className="ml-1 text-red-400">*</span>}
                  </label>
                  {c.tipo === "select" ? (
                    <select
                      value={campos[c.key] ?? ""}
                      onChange={(e) => setCampos((p) => ({ ...p, [c.key]: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#4F86C6] focus:ring-2 focus:ring-[#4F86C6]/20"
                    >
                      <option value="">Seleccionar…</option>
                      {(c.opciones ?? []).map((op) => <option key={op} value={op}>{op}</option>)}
                    </select>
                  ) : (
                    <input
                      type={c.tipo === "numero" ? "number" : "text"}
                      min={c.tipo === "numero" ? 3 : undefined}
                      max={c.tipo === "numero" ? 18 : undefined}
                      placeholder={c.tipo === "numero" ? "Años (3–18)" : c.label}
                      value={campos[c.key] ?? ""}
                      onChange={(e) => setCampos((p) => ({ ...p, [c.key]: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#4F86C6] focus:ring-2 focus:ring-[#4F86C6]/20"
                    />
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 3. Evaluación de muestras */}
        <Section numero={3} titulo={`Evaluación de muestras — ${atributos.join(", ")}`}>
          <p className="mb-4 text-sm text-gray-500">Toca el emoji que mejor describe cómo te siente cada muestra.</p>
          {/* Leyenda */}
          <div className="mb-4 grid grid-cols-5 gap-1 rounded-xl bg-gray-50 p-3 text-center">
            {ESCALA.map((e) => (
              <div key={e.val} className="flex flex-col items-center gap-0.5">
                <span className="text-2xl leading-none">{e.emoji}</span>
                <span className="text-[10px] font-bold text-gray-400">{e.val}</span>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            {evalMuestras.map((m, idx) => (
              <div key={idx} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4F86C6] text-xs font-black text-white">{idx + 1}</span>
                  <span className="font-semibold text-gray-800">Muestra {idx + 1}</span>
                  {encuesta.requiere_video && m.videoGrabado && (
                    <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-green-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Video analizado
                    </span>
                  )}
                </div>
                {encuesta.requiere_video && !m.videoGrabado && (
                  <VideoRecorderMuestra
                    encuestaId={id}
                    muestraNum={idx + 1}
                    onDone={(r) =>
                      setEvalMuestras((p) =>
                        p.map((mm, i) =>
                          i === idx
                            ? { ...mm, videoGrabado: true, score_ia: r.score_ia,
                                emociones: r.emociones, emocion_dominante: r.emocion_dominante,
                                sentimiento_voz: r.sentimiento_voz, resumen_ia: r.resumen,
                                frames_analizados: r.frames_analizados,
                                video_url: r.video_url }
                            : mm
                        )
                      )
                    }
                  />
                )}
                {(!encuesta.requiere_video || m.videoGrabado) && (
                  <>
                    {atributos.map((a) => (
                      <div key={a} className="mb-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{a}</p>
                        <div className="grid grid-cols-5 gap-2">
                          {ESCALA.map((e) => (
                            <button key={e.val} type="button"
                              onClick={() => setEval(idx, "calificacion", e.val)}
                              className={`flex flex-col items-center rounded-xl border-2 py-3 transition-all ${m.calificacion === e.val ? `${e.color} border-current scale-105 shadow-md font-bold` : "border-gray-100 bg-gray-50 hover:border-gray-300"}`}
                            >
                              <span className="text-2xl leading-none">{e.emoji}</span>
                              <span className="mt-1 text-[11px] font-bold">{e.val}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <input type="text" placeholder="Observaciones (opcional)…"
                      value={m.observaciones}
                      onChange={(e) => setEval(idx, "observaciones", e.target.value)}
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm outline-none focus:border-[#4F86C6] focus:ring-2 focus:ring-[#4F86C6]/20"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* 4. Preguntas adicionales */}
        {(encuesta.preguntas ?? []).length > 0 && (
          <Section numero={4} titulo="Preguntas adicionales">
            <div className="space-y-4">
              {encuesta.preguntas.map((q, idx) => (
                <div key={q.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="mb-3 font-medium text-gray-800">
                    {idx + 1}. {q.texto}{q.requerida && <span className="ml-1 text-red-400">*</span>}
                  </p>
                  {q.tipo === "si_no" && (
                    <div className="flex gap-3">
                      {["Sí", "No"].map((op) => (
                        <label key={op} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition ${extras[q.id] === op ? "border-[#4F86C6] bg-blue-50 text-[#4F86C6]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                          <input type="radio" name={`q_${q.id}`} checked={extras[q.id] === op}
                            onChange={() => setExtras((p) => ({ ...p, [q.id]: op }))}
                            className="accent-[#4F86C6]" />
                          {op}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.tipo === "texto" && (
                    <textarea rows={3} placeholder="Escribe tu respuesta…"
                      value={extras[q.id] ?? ""}
                      onChange={(e) => setExtras((p) => ({ ...p, [q.id]: e.target.value }))}
                      className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#4F86C6] focus:ring-2 focus:ring-[#4F86C6]/20"
                    />
                  )}
                  {q.tipo === "escala" && (
                    <div className="flex flex-wrap items-center gap-2">
                      {q.etiqueta_min && <span className="text-xs text-gray-400">{q.etiqueta_min}</span>}
                      {Array.from({ length: (q.escala_max ?? 5) - (q.escala_min ?? 1) + 1 }, (_, i) => {
                        const v = String((q.escala_min ?? 1) + i);
                        return (
                          <button key={v} type="button"
                            onClick={() => setExtras((p) => ({ ...p, [q.id]: v }))}
                            className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 text-sm font-bold transition-all ${extras[q.id] === v ? "border-[#4F86C6] bg-blue-50 text-[#4F86C6] scale-110 shadow" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}
                          >{v}</button>
                        );
                      })}
                      {q.etiqueta_max && <span className="text-xs text-gray-400">{q.etiqueta_max}</span>}
                    </div>
                  )}
                  {q.tipo === "opcion_multiple" && (
                    <div className="space-y-2">
                      {(q.opciones ?? []).map((op) => (
                        <label key={op} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${extras[q.id] === op ? "border-[#4F86C6] bg-blue-50 text-[#4F86C6] font-semibold" : "border-gray-200 text-gray-700 hover:border-gray-300"}`}>
                          <input type="radio" name={`q_${q.id}`} checked={extras[q.id] === op}
                            onChange={() => setExtras((p) => ({ ...p, [q.id]: op }))}
                            className="accent-[#4F86C6]" />
                          {op}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Comentarios */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Comentarios adicionales (opcional)
          </label>
          <textarea rows={3} placeholder="¿Algo más que quieras compartir?"
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#4F86C6] focus:ring-2 focus:ring-[#4F86C6]/20"
          />
        </div>

        {/* Botón enviar */}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#4F86C6] to-[#6B9FD4] py-4 text-base font-bold text-white shadow-lg hover:opacity-90 disabled:opacity-60 transition-all"
        >
          {saving ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Enviando…</>
          ) : (
            <><CheckCircle2 className="h-5 w-5" /> Enviar evaluación</>
          )}
        </button>

        <p className="pb-8 text-center text-xs text-gray-400">
          Tus datos son utilizados únicamente con fines científicos y académicos.
        </p>
      </main>
    </div>
  );
}
// ── Grabador de video por muestra ───────────────────────────────────────────

function VideoRecorderMuestra({
  encuestaId,
  muestraNum,
  onDone,
}: {
  encuestaId: string;
  muestraNum: number;
  onDone: (r: {
    score_ia: number;
    emocion_dominante: string;
    sentimiento_voz: string;
    resumen: string;
    emociones: Record<string, number>;
    frames_analizados: number;
    video_url?: string;
  }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const framesRef = useRef<string[]>([]);
  const chunksRef = useRef<Blob[]>([]);
  const recRef = useRef<MediaRecorder | null>(null);
  const captureRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [fase, setFase] = useState<"preview" | "grabando" | "analizando" | "listo" | "error">("preview");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [tiempoRestante, setTiempoRestante] = useState(15);
  const [resultado, setResultado] = useState<{ score_ia: number; emocion_dominante: string; resumen: string } | null>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: 320, height: 240 }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        setErrMsg("No se pudo acceder a la cámara. Verifica los permisos del navegador.");
        setFase("error");
      });
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (captureRef.current) clearInterval(captureRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (recRef.current?.state !== "inactive") recRef.current?.stop();
    };
  }, []);

  function capturarFrame() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = 320; canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const b64 = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
    if (framesRef.current.length < 8) framesRef.current.push(b64);
  }

  function finalizarBlob(): Promise<Blob> {
    return new Promise((resolve) => {
      const mr = recRef.current;
      if (!mr || mr.state === "inactive") {
        resolve(new Blob(chunksRef.current, { type: "video/webm" }));
        return;
      }
      mr.onstop = () => resolve(new Blob(chunksRef.current, { type: "video/webm" }));
      mr.stop();
    });
  }

  async function detener() {
    if (captureRef.current) { clearInterval(captureRef.current); captureRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    capturarFrame();

    // Finalizar MediaRecorder antes de parar el stream
    const videoBlob = await finalizarBlob();
    streamRef.current?.getTracks().forEach((t) => t.stop());

    const frames = framesRef.current;
    if (frames.length === 0) {
      setErrMsg("No se capturaron fotogramas. Intenta nuevamente.");
      setFase("error"); return;
    }
    setFase("analizando");

    // Claude + upload en paralelo
    const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
    const [claudeResult, uploadResult] = await Promise.allSettled([
      apiFetch<{
        score_ia: number; emocion_dominante: string; sentimiento_voz: string;
        resumen: string; promedio: Record<string, number>;
      }>(`/api/encuestas/publicas/${encuestaId}/analizar-video`, {
        method: "POST",
        body: JSON.stringify({ frames }),
      }),
      videoBlob.size > 500
        ? fetch(
            `${apiBase}/api/encuestas/publicas/${encuestaId}/muestras/${muestraNum}/video`,
            { method: "POST", headers: { "Content-Type": "video/webm" }, body: videoBlob }
          ).then((res) => res.ok ? res.json() as Promise<{ video_url: string }> : Promise.resolve(undefined))
        : Promise.resolve(undefined),
    ]);

    if (claudeResult.status === "rejected") {
      setErrMsg(claudeResult.reason instanceof Error ? claudeResult.reason.message : "Error al analizar el video.");
      setFase("error"); return;
    }

    const r = claudeResult.value;
    const uploadData = uploadResult.status === "fulfilled" ? uploadResult.value as { video_url?: string } | undefined : undefined;
    const video_url = uploadData?.video_url;

    setResultado({ score_ia: r.score_ia, emocion_dominante: r.emocion_dominante, resumen: r.resumen });
    setFase("listo");
    onDone({
      score_ia: r.score_ia,
      emocion_dominante: r.emocion_dominante,
      sentimiento_voz: r.sentimiento_voz,
      resumen: r.resumen,
      emociones: r.promedio ?? {},
      frames_analizados: frames.length,
      video_url,
    });
  }

  function iniciar() {
    framesRef.current = [];
    chunksRef.current = [];
    setFase("grabando");
    let t = 15;
    setTiempoRestante(t);
    capturarFrame();
    captureRef.current = setInterval(capturarFrame, 2000);
    countdownRef.current = setInterval(() => {
      t--;
      setTiempoRestante(t);
      if (t <= 0) detener();
    }, 1000);
    // Grabar video con MediaRecorder
    if (streamRef.current) {
      try {
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "";
        const mr = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
        mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.start(1000);
        recRef.current = mr;
      } catch { /* sin soporte MediaRecorder — solo frames */ }
    }
  }

  if (fase === "error") return (
    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
      <p className="font-semibold mb-1">Error de cámara</p>
      <p>{errMsg}</p>
    </div>
  );

  if (fase === "listo" && resultado) return (
    <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-2">
      <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
        <CheckCircle2 className="h-4 w-4" /> Video analizado — Muestra {muestraNum}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-green-100 px-3 py-1 font-semibold text-green-800">Score IA: {resultado.score_ia}/100</span>
        <span className="rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-800">{resultado.emocion_dominante}</span>
      </div>
      {resultado.resumen && <p className="text-xs text-gray-600 italic leading-relaxed">{resultado.resumen}</p>}
    </div>
  );

  if (fase === "analizando") return (
    <div className="flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-200 p-4">
      <Loader2 className="h-5 w-5 animate-spin text-[#4F86C6]" />
      <div>
        <p className="text-sm font-semibold text-blue-800">Analizando expresiones…</p>
        <p className="text-xs text-blue-600">Claude Vision está procesando los fotogramas</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-black aspect-video w-full max-w-xs mx-auto">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        {fase === "grabando" && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            REC · {tiempoRestante}s
          </div>
        )}
      </div>
      <div className="flex justify-center">
        {fase === "preview" ? (
          <button type="button" onClick={iniciar}
            className="flex items-center gap-2 rounded-full bg-[#4F86C6] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
            <Video className="h-4 w-4" /> Iniciar grabación (15 s)
          </button>
        ) : (
          <button type="button" onClick={detener}
            className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
            <StopCircle className="h-4 w-4" /> Detener grabación
          </button>
        )}
      </div>
      <p className="text-center text-xs text-gray-400">
        {fase === "preview"
          ? "Graba tu reacción mientras pruebas la muestra. La grabación dura 15 segundos y se detiene sola."
          : `Grabando… ${tiempoRestante}s restantes. Puedes detener antes si lo deseas.`}
      </p>
    </div>
  );
}
// ── Página de consentimiento formal ──────────────────────────────────────────

function PaginaConsentimiento({
  encuesta, data, onAceptar, onVolver,
}: {
  encuesta: Encuesta;
  data: ConsentimientoData;
  onAceptar: () => void;
  onVolver: () => void;
}) {
  const [nombreParticipante, setNombreParticipante] = useState("");
  const [fecha] = useState(() => new Date().toLocaleDateString("es-CO"));
  const [tieneAlergia, setTieneAlergia] = useState<boolean | null>(null);
  const [aceptado, setAceptado] = useState(false);

  function handleAceptar() {
    if (!nombreParticipante.trim()) {
      alert("Por favor escribe el nombre del participante."); return;
    }
    if (data.tiene_pregunta_alergia && tieneAlergia === null) {
      alert("Por favor responde la pregunta de alergia."); return;
    }
    onAceptar();
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <button onClick={onVolver} className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-gray-900">{encuesta.titulo}</h1>
            <p className="text-xs text-gray-400">Consentimiento informado — Paso 1 de 2</p>
          </div>
        </div>
        {/* Barra de progreso */}
        <div className="h-1 bg-gray-100">
          <div className="h-1 w-1/2 bg-[#4F86C6] transition-all" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Encabezado del documento */}
        <div className="rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-gradient-to-br from-slate-700 to-slate-900 px-6 py-6 text-white">
            <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Consentimiento informado</p>
            {data.titulo_investigacion ? (
              <h2 className="text-lg font-black leading-snug">{data.titulo_investigacion}</h2>
            ) : (
              <h2 className="text-lg font-black">{data.titulo}</h2>
            )}
            {data.investigadores.length > 0 && (
              <div className="mt-3 space-y-0.5">
                {data.investigadores.map((inv, i) => (
                  <p key={i} className="text-xs opacity-70">
                    {inv.nombre}{inv.email && ` · ${inv.email}`}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white px-6 py-6 space-y-5">
            {/* Nombre y fecha */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Nombre del participante <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nombre completo…"
                  value={nombreParticipante}
                  onChange={(e) => setNombreParticipante(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-[#4F86C6] focus:ring-2 focus:ring-[#4F86C6]/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Fecha</label>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500">{fecha}</div>
              </div>
            </div>

            {/* Texto introductorio */}
            {data.texto_intro && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1.5">Información previa:</p>
                {data.texto_intro.split(/\n\n+/).map((par, i) => (
                  <p key={i} className="text-sm leading-relaxed text-gray-500 mb-2 text-justify">{par}</p>
                ))}
              </div>
            )}

            {/* Tabla de ingredientes */}
            {data.ingredientes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Ingredientes/Componentes del producto a evaluar:</p>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {["Ingrediente", "Marca", "Porcentaje (%)"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.ingredientes.map((ing, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-sm">{ing.ingrediente}</td>
                          <td className="px-3 py-2 text-sm text-gray-500">{ing.marca || "—"}</td>
                          <td className="px-3 py-2 text-sm text-gray-500">{ing.porcentaje || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pregunta de alergia */}
            {data.tiene_pregunta_alergia && data.texto_alergia && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="mb-3 text-sm font-semibold text-amber-800">{data.texto_alergia}</p>
                <div className="flex gap-4">
                  {[{ val: false, label: "No" }, { val: true, label: "Sí, tiene alergia" }].map(({ val, label }) => (
                    <label key={label} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${tieneAlergia === val ? "border-amber-500 bg-amber-100 text-amber-800" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}>
                      <input type="radio" checked={tieneAlergia === val}
                        onChange={() => setTieneAlergia(val)}
                        className="accent-amber-600" />
                      {label}
                    </label>
                  ))}
                </div>
                {tieneAlergia === true && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    El participante reporta alergia. Verifique con el investigador antes de continuar.
                  </div>
                )}
              </div>
            )}

            {/* Párrafos del cuerpo */}
            {data.parrafos.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-gray-500 text-justify">{p}</p>
            ))}

            {/* Botón aceptar */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-center">
              <p className="text-sm text-gray-500 mb-4">
                Pulsando <strong>"Aceptar"</strong> se entiende que está de acuerdo con las condiciones del panel sensorial y confirma la participación.
              </p>
              <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left">
                <input type="checkbox" checked={aceptado}
                  onChange={(e) => setAceptado(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#4F86C6]" />
                <span className="text-sm text-gray-700 font-medium">He leído y acepto las condiciones de este consentimiento informado</span>
              </label>
            </div>

            {/* Contacto */}
            {data.texto_contacto && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-600 mb-1">Información de contacto:</p>
                {data.texto_contacto.split("\n").map((l, i) => (
                  <p key={i} className="text-xs text-gray-400">{l}</p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Botón continuar */}
        <button
          onClick={handleAceptar}
          disabled={!aceptado}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#4F86C6] to-[#6B9FD4] py-4 text-base font-bold text-white shadow-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <CheckCircle2 className="h-5 w-5" /> Aceptar y continuar con la evaluación
        </button>

        <p className="pb-8 text-center text-xs text-gray-400">
          Tus datos son utilizados únicamente con fines científicos y académicos.
        </p>
      </main>
    </div>
  );
}

function Section({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4F86C6] text-sm font-black text-white">
          {numero}
        </span>
        <h3 className="font-bold text-gray-800">{titulo}</h3>
      </div>
      {children}
    </div>
  );
}
