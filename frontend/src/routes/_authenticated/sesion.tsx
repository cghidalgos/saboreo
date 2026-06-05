import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Video, Plus, X, Camera, StopCircle, Play,
  CheckCircle2, Trash2, Clock, AlertCircle, Mic, MicOff,
  BrainCircuit, Smile, BarChart3, ChevronRight, Flag,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/integrations/api/client";
import { AppLayout } from "@/components/saboreo/AppLayout";

export const Route = createFileRoute("/_authenticated/sesion")({
  head: () => ({ meta: [{ title: "Sesión con cámara — SABOREO" }] }),
  component: SesionPage,
});

// ── Tipos ─────────────────────────────────────────────────────────────────────

type EstadoSesion = "pendiente" | "grabando" | "completada" | "cancelada";

interface Sesion {
  id: string;
  titulo: string;
  participante_nombre: string;
  participante_edad: number;
  estado: EstadoSesion;
  duracion_seg: number | null;
  score_ia: number | null;
  emociones: Record<string, number> | null;
  notas: string | null;
  encuesta_titulo: string | null;
  created_at: string;
}

interface Encuesta { id: string; titulo: string; num_muestras: number; }

interface AnalisisMuestra {
  id: string;
  sesion_id: string;
  numero_muestra: number;
  frames_analizados: number;
  emociones: Record<string, number>;
  emocion_dominante: string;
  transcripcion: string | null;
  sentimiento_voz: "positivo" | "neutro" | "negativo" | null;
  score_ia: number;
  resumen_ia: string | null;
  duracion_seg: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ESTADO_UI: Record<EstadoSesion, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pendiente:  { label: "Pendiente",  color: "bg-saboreo-yellow/20 text-amber-800",    icon: Clock         },
  grabando:   { label: "Grabando",   color: "bg-red-100 text-red-700",               icon: Video         },
  completada: { label: "Completada", color: "bg-saboreo-green/15 text-green-800",    icon: CheckCircle2  },
  cancelada:  { label: "Cancelada",  color: "bg-muted text-muted-foreground",         icon: AlertCircle   },
};

const EMOCIONES_COLORES: Record<string, string> = {
  alegria:  "var(--saboreo-yellow)", sorpresa: "var(--saboreo-sky)",
  interes:  "var(--saboreo-green)",  neutral:  "var(--saboreo-purple)",
  disgusto: "var(--saboreo-red)",    tristeza: "var(--saboreo-orange)",
};

const SENTIMIENTO_UI = {
  positivo: { label: "Positivo",  color: "text-saboreo-green" },
  neutro:   { label: "Neutro",    color: "text-saboreo-yellow" },
  negativo: { label: "Negativo",  color: "text-saboreo-red" },
};

function fmtDur(seg: number) {
  const m = Math.floor(seg / 60), s = seg % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function scoreColor(s: number) {
  if (s >= 80) return "text-saboreo-green";
  if (s >= 60) return "text-saboreo-sky";
  if (s >= 40) return "text-saboreo-yellow";
  return "text-saboreo-red";
}

/** Captura un frame JPEG base64 del video (320×240 para minimizar costo de API) */
function captureFrame(video: HTMLVideoElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 320; canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, 320, 240);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
    return dataUrl.replace(/^data:image\/jpeg;base64,/, "");
  } catch {
    return null;
  }
}

/** Agrega emociones de varias muestras en un promedio ponderado */
function agregarEmociones(muestras: AnalisisMuestra[]): Record<string, number> {
  if (!muestras.length) return {};
  const keys = ["alegria", "disgusto", "sorpresa", "neutral", "tristeza", "interes"];
  const result: Record<string, number> = {};
  for (const k of keys) {
    const avg = muestras.reduce((acc, m) => acc + ((m.emociones[k] ?? 0) * 100), 0) / muestras.length;
    result[k] = Math.round(avg);
  }
  return result;
}

// ── Componente ────────────────────────────────────────────────────────────────

type Vista = "list" | "nueva" | { sesion: Sesion };

function SesionPage() {
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [encuestas, setEncuestas] = useState<Encuesta[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<Vista>("list");

  // form nueva sesión
  const [form, setForm] = useState({
    titulo: "", participante_nombre: "", participante_edad: "",
    encuesta_id: "", notas: "",
  });
  const [saving, setSaving] = useState(false);

  // cámara
  type CameraState = "idle" | "preview" | "recording" | "analyzing" | "results" | "done";
  const [camState, setCamState] = useState<CameraState>("idle");
  const [timer, setTimer] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [currentSesionId, setCurrentSesionId] = useState<string | null>(null);

  // pipeline IA por muestra
  const [muestraActual, setMuestraActual] = useState(1);
  const [numMuestras, setNumMuestras] = useState(1);
  const [frameCount, setFrameCount] = useState(0);
  const [transcripcion, setTranscripcion] = useState("");
  const [resultadosMuestras, setResultadosMuestras] = useState<AnalisisMuestra[]>([]);
  const [resultadoActual, setResultadoActual] = useState<AnalisisMuestra | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const framesRef = useRef<string[]>([]);
  const transcripcionRef = useRef("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    loadData();
    return () => stopStream();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [s, e] = await Promise.all([
        apiFetch<Sesion[]>("/api/sesiones"),
        apiFetch<Encuesta[]>("/api/encuestas"),
      ]);
      setSesiones(s);
      setEncuestas(e);
    } catch { toast.error("Error al cargar datos"); }
    finally { setLoading(false); }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    try { recognitionRef.current?.stop(); } catch {}
  }

  // Paso 1: crear sesión y pasar a vista cámara
  async function crearSesion() {
    if (!form.titulo.trim() || !form.participante_nombre.trim() || !form.participante_edad) {
      toast.error("Completa los campos requeridos"); return;
    }
    setSaving(true);
    try {
      const nueva = await apiFetch<Sesion>("/api/sesiones", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          participante_edad: Number(form.participante_edad),
          encuesta_id: form.encuesta_id || undefined,
          notas: form.notas || undefined,
        }),
      });
      setSesiones((p) => [nueva, ...p]);
      setCurrentSesionId(nueva.id);
      // Determinar número de muestras desde la encuesta seleccionada
      const enc = encuestas.find((e) => e.id === form.encuesta_id);
      setNumMuestras(enc?.num_muestras ?? 1);
      setMuestraActual(1);
      setResultadosMuestras([]);
      setResultadoActual(null);
      setCamState("idle");
      setTimer(0);
      setVista("nueva");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  const iniciarCamara = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: micOn });
      streamRef.current = stream;
      setCamState("preview");
    } catch {
      toast.error("No se pudo acceder a la cámara. Verifica los permisos.");
    }
  }, [micOn]);

  // Asignar stream al video cuando camState pasa a preview/recording
  useEffect(() => {
    if ((camState === "preview" || camState === "recording") && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {/* autoplay policy */});
    }
  }, [camState]);

  function iniciarGrabacion() {
    framesRef.current = [];
    transcripcionRef.current = "";
    setFrameCount(0);
    setTranscripcion("");
    setCamState("recording");
    setTimer(0);

    // Temporizador
    timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);

    // Captura de frames cada 2 segundos
    frameIntervalRef.current = setInterval(() => {
      if (!videoRef.current) return;
      const frame = captureFrame(videoRef.current);
      if (frame) {
        framesRef.current.push(frame);
        setFrameCount(framesRef.current.length);
      }
    }, 2000);

    // Web Speech API (transcripción en tiempo real, best-effort)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.lang = "es-ES";
        rec.continuous = true;
        rec.interimResults = false;
        rec.onresult = (e: Event & { results: SpeechRecognitionResultList }) => {
          const text = Array.from(e.results).map((r) => r[0].transcript).join(" ");
          transcripcionRef.current = text;
          setTranscripcion(text);
        };
        rec.start();
        recognitionRef.current = rec;
      } catch { /* Speech API no disponible en este dispositivo */ }
    }

    // Actualizar estado BD
    if (currentSesionId) {
      apiFetch(`/api/sesiones/${currentSesionId}`, {
        method: "PATCH",
        body: JSON.stringify({ estado: "grabando" }),
      }).catch(console.error);
    }
  }

  async function detenerYAnalizar() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    try { recognitionRef.current?.stop(); } catch {}

    const duracion = timer;
    const frames = [...framesRef.current];

    if (frames.length === 0) {
      toast.error("No se capturaron fotogramas. La grabación fue demasiado corta.");
      setCamState("preview");
      return;
    }

    setCamState("analyzing");

    try {
      const resultado = await apiFetch<AnalisisMuestra>(
        `/api/sesiones/${currentSesionId}/analizar-muestra`,
        {
          method: "POST",
          body: JSON.stringify({
            numero_muestra: muestraActual,
            frames,
            transcripcion: transcripcionRef.current || undefined,
            duracion_seg: duracion,
          }),
        },
      );

      setResultadoActual(resultado);
      setResultadosMuestras((prev) => {
        const filtered = prev.filter((r) => r.numero_muestra !== resultado.numero_muestra);
        return [...filtered, resultado].sort((a, b) => a.numero_muestra - b.numero_muestra);
      });

      // Si es la última muestra → cerrar sesión con datos agregados
      if (muestraActual >= numMuestras) {
        const todasMuestras = [...resultadosMuestras.filter((r) => r.numero_muestra !== resultado.numero_muestra), resultado];
        const scores = todasMuestras.map((r) => r.score_ia).filter(Boolean) as number[];
        const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        const emocionesAgregadas = agregarEmociones(todasMuestras);

        if (currentSesionId) {
          const sesActualizada = await apiFetch<Sesion>(`/api/sesiones/${currentSesionId}`, {
            method: "PATCH",
            body: JSON.stringify({
              estado: "completada",
              duracion_seg: todasMuestras.reduce((a, r) => a + (r.duracion_seg ?? 0), 0),
              score_ia: avgScore,
              emociones: emocionesAgregadas,
            }),
          });
          setSesiones((p) => p.map((s) => s.id === currentSesionId ? sesActualizada : s));
        }
        setCamState("done");
      } else {
        setCamState("results");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error en análisis IA");
      setCamState("preview");
    }
  }

  function siguienteMuestra() {
    setMuestraActual((m) => m + 1);
    framesRef.current = [];
    transcripcionRef.current = "";
    setFrameCount(0);
    setTranscripcion("");
    setTimer(0);
    setResultadoActual(null);
    // La cámara sigue activa → volvemos a preview
    setCamState("preview");
  }

  async function eliminarSesion(id: string) {
    try {
      await apiFetch(`/api/sesiones/${id}`, { method: "DELETE" });
      setSesiones((p) => p.filter((s) => s.id !== id));
      if (typeof vista === "object" && vista.sesion.id === id) setVista("list");
      toast.success("Sesión eliminada");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  }

  function nuevaSesion() {
    stopStream();
    setCamState("idle");
    setTimer(0);
    setCurrentSesionId(null);
    setResultadoActual(null);
    setResultadosMuestras([]);
    setMuestraActual(1);
    setNumMuestras(1);
    setForm({ titulo: "", participante_nombre: "", participante_edad: "", encuesta_id: "", notas: "" });
    setVista("nueva");
  }

  const completadas = sesiones.filter((s) => s.estado === "completada").length;
  const avgScore = sesiones.filter((s) => s.score_ia).reduce((a, s, _, arr) =>
    a + (s.score_ia ?? 0) / arr.length, 0);

  return (
    <AppLayout
      title="Sesión con cámara"
      subtitle="Grabación sincronizada con análisis IA de emociones"
      actions={
        vista !== "nueva" && (
          <button
            onClick={nuevaSesion}
            className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent"
          >
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nueva sesión</span>
          </button>
        )
      }
    >
      {/* KPIs */}
      <div className="mb-6 grid grid-cols-3 gap-2.5 sm:gap-4">
        {[
          { icon: Video,       label: "Total sesiones",    val: sesiones.length,                   grad: "bg-gradient-warm" },
          { icon: CheckCircle2,label: "Completadas",       val: completadas,                        grad: "bg-gradient-cool" },
          { icon: BrainCircuit,label: "Score IA promedio", val: completadas ? `${Math.round(avgScore)}` : "—", grad: "bg-gradient-fresh" },
        ].map((k) => (
          <div key={k.label} className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-3 shadow-card sm:flex-row sm:items-center sm:gap-4 sm:p-5">
            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${k.grad} shadow-soft sm:h-11 sm:w-11`}>
              <k.icon className="h-4 w-4 text-white sm:h-5 sm:w-5" />
            </div>
            <div>
              <p className="font-num text-xl font-black sm:text-3xl">{k.val}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Lista sesiones */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-display text-base font-bold">Historial de sesiones</h2>
            </div>
            {loading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
            ) : sesiones.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Video className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Sin sesiones aún</p>
                <button onClick={nuevaSesion} className="text-sm font-semibold text-saboreo-blue hover:underline">
                  Iniciar primera sesión
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {sesiones.map((s) => {
                  const cfg = ESTADO_UI[s.estado];
                  const isActive = typeof vista === "object" && vista.sesion.id === s.id;
                  return (
                    <li key={s.id} className={`group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-accent/40 ${isActive ? "bg-accent/60" : ""}`}>
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setVista({ sesion: s })}
                      >
                        <p className="truncate font-semibold">{s.titulo}</p>
                        <p className="text-xs text-muted-foreground">{s.participante_nombre} · {s.participante_edad} años</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.color}`}>
                            <cfg.icon className="h-3 w-3" />{cfg.label}
                          </span>
                          {s.score_ia != null && (
                            <span className={`font-num text-sm font-black ${scoreColor(s.score_ia)}`}>{s.score_ia} pts</span>
                          )}
                          {s.duracion_seg != null && (
                            <span className="text-[11px] text-muted-foreground">{fmtDur(s.duracion_seg)}</span>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); eliminarSesion(s.id); }}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Panel derecho */}
        <div className="lg:col-span-3">
          {vista === "list" && (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 text-center">
              <Camera className="h-12 w-12 text-muted-foreground/30" />
              <p className="font-semibold text-muted-foreground">Selecciona una sesión</p>
              <p className="text-sm text-muted-foreground/70">o inicia una nueva grabación</p>
            </div>
          )}

          {/* ── FORMULARIO NUEVA SESIÓN ── */}
          {vista === "nueva" && !currentSesionId && (
            <div className="rounded-2xl border border-border bg-card shadow-card">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="font-display text-lg font-bold">Nueva sesión</h2>
                <button onClick={() => setVista("list")} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-6">
                <Field label="Título de la sesión *">
                  <input type="text" placeholder="Ej. Evaluación Sofía R. — galleta cacao" value={form.titulo}
                    onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))} className="input-base" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nombre del participante *">
                    <input type="text" placeholder="Nombre del niño/niña" value={form.participante_nombre}
                      onChange={(e) => setForm((p) => ({ ...p, participante_nombre: e.target.value }))} className="input-base" />
                  </Field>
                  <Field label="Edad *">
                    <input type="number" min={3} max={18} placeholder="Años" value={form.participante_edad}
                      onChange={(e) => setForm((p) => ({ ...p, participante_edad: e.target.value }))} className="input-base" />
                  </Field>
                </div>
                <Field label="Encuesta asociada (opcional)">
                  <select value={form.encuesta_id}
                    onChange={(e) => setForm((p) => ({ ...p, encuesta_id: e.target.value }))} className="input-base">
                    <option value="">Sin encuesta</option>
                    {encuestas.map((e) => <option key={e.id} value={e.id}>{e.titulo}</option>)}
                  </select>
                </Field>
                <Field label="Notas (opcional)">
                  <textarea rows={2} placeholder="Contexto, observaciones previas…" value={form.notas}
                    onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))} className="input-base resize-none" />
                </Field>
                <button onClick={crearSesion} disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-bold text-background hover:opacity-90 disabled:opacity-60">
                  {saving ? "Preparando…" : <><Camera className="h-4 w-4" /> Continuar a cámara</>}
                </button>
              </div>
            </div>
          )}

          {/* ── INTERFAZ DE CÁMARA ── */}
          {vista === "nueva" && currentSesionId && (
            <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <h2 className="font-display text-lg font-bold">Grabación en vivo</h2>
                  <p className="text-xs text-muted-foreground">{form.participante_nombre} · {form.participante_edad} años</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Indicador de muestra */}
                  <div className="flex items-center gap-1.5 rounded-full bg-saboreo-blue/10 px-3 py-1.5 text-xs font-bold text-saboreo-blue">
                    <Flag className="h-3 w-3" />
                    Muestra {muestraActual} / {numMuestras}
                  </div>
                  {camState !== "recording" && camState !== "analyzing" && (
                    <button onClick={() => { stopStream(); setVista("list"); }}
                      className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Video area */}
              <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
                {/* Siempre montado para que videoRef esté disponible al asignar el stream */}
                <video
                  ref={videoRef}
                  className={`h-full w-full object-cover ${camState !== "preview" && camState !== "recording" ? "hidden" : ""}`}
                  muted autoPlay playsInline
                />

                {camState === "idle" && (
                  <div className="flex h-full flex-col items-center justify-center gap-4 text-white">
                    <Camera className="h-16 w-16 opacity-30" />
                    <p className="text-sm opacity-60">La cámara no está activa</p>
                    <button onClick={iniciarCamara}
                      className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black hover:opacity-90">
                      <Play className="h-4 w-4" /> Activar cámara
                    </button>
                  </div>
                )}

                {camState === "analyzing" && (
                  <div className="flex h-full flex-col items-center justify-center gap-4 text-white">
                    <BrainCircuit className="h-16 w-16 animate-pulse opacity-70" />
                    <p className="font-semibold">Analizando con Claude Vision…</p>
                    <p className="text-sm opacity-60">{frameCount} fotogramas · muestra {muestraActual}</p>
                  </div>
                )}

                {/* Timer + frames badge */}
                {camState === "recording" && (
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-sm font-bold text-white shadow-lg">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                      {fmtDur(timer)}
                    </div>
                    <div className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                      {frameCount} frames
                    </div>
                    {transcripcion && (
                      <div className="max-w-[220px] rounded-xl bg-black/60 px-3 py-1.5 text-xs text-white/90 backdrop-blur line-clamp-2">
                        🎙 {transcripcion}
                      </div>
                    )}
                  </div>
                )}

                {/* Mic badge */}
                {(camState === "preview" || camState === "recording") && (
                  <button
                    onClick={() => setMicOn((m) => !m)}
                    className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70"
                  >
                    {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-400" />}
                  </button>
                )}
              </div>

              {/* Controles */}
              {camState !== "analyzing" && camState !== "results" && camState !== "done" && (
                <div className="flex items-center justify-center gap-3 px-6 py-5">
                  {camState === "idle" && (
                    <button onClick={iniciarCamara}
                      className="flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-accent">
                      <Camera className="h-4 w-4" /> Activar cámara
                    </button>
                  )}
                  {camState === "preview" && (
                    <button onClick={iniciarGrabacion}
                      className="flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white hover:opacity-90 animate-pulse-ring">
                      <Video className="h-4 w-4" /> Grabar muestra {muestraActual}
                    </button>
                  )}
                  {camState === "recording" && (
                    <button onClick={detenerYAnalizar}
                      className="flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background hover:opacity-90">
                      <StopCircle className="h-4 w-4" /> Detener y analizar
                    </button>
                  )}
                </div>
              )}

              {/* Resultados muestra actual */}
              {(camState === "results" || camState === "done") && resultadoActual && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BrainCircuit className="h-5 w-5 text-saboreo-purple" />
                      <h3 className="font-display text-base font-bold">
                        Muestra {resultadoActual.numero_muestra} — Análisis Claude
                      </h3>
                    </div>
                    <span className={`font-num text-3xl font-black ${scoreColor(resultadoActual.score_ia)}`}>
                      {resultadoActual.score_ia}
                    </span>
                  </div>

                  {/* Emociones */}
                  <div className="space-y-1.5">
                    {Object.entries(resultadoActual.emociones)
                      .sort((a, b) => b[1] - a[1])
                      .map(([emo, val]) => (
                        <div key={emo} className="flex items-center gap-3">
                          <span className="w-18 text-xs capitalize text-muted-foreground">{emo}</span>
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${Math.round(val * 100)}%`, backgroundColor: EMOCIONES_COLORES[emo] ?? "var(--saboreo-blue)" }} />
                          </div>
                          <span className="w-9 text-right text-xs font-semibold">{Math.round(val * 100)}%</span>
                        </div>
                      ))}
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {resultadoActual.emocion_dominante && (
                      <span className="flex items-center gap-1"><Smile className="h-3 w-3" /> {resultadoActual.emocion_dominante}</span>
                    )}
                    {resultadoActual.sentimiento_voz && (
                      <span className={`font-semibold ${SENTIMIENTO_UI[resultadoActual.sentimiento_voz]?.color}`}>
                        Voz: {SENTIMIENTO_UI[resultadoActual.sentimiento_voz]?.label}
                      </span>
                    )}
                    {resultadoActual.duracion_seg != null && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtDur(resultadoActual.duracion_seg)}</span>
                    )}
                    <span className="flex items-center gap-1"><Camera className="h-3 w-3" /> {resultadoActual.frames_analizados} frames</span>
                  </div>

                  {/* Resumen Claude */}
                  {resultadoActual.resumen_ia && (
                    <p className="rounded-xl bg-saboreo-purple/8 px-4 py-3 text-sm italic text-muted-foreground">
                      "{resultadoActual.resumen_ia}"
                    </p>
                  )}

                  {/* Transcripción */}
                  {resultadoActual.transcripcion && (
                    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Transcripción</p>
                      <p className="text-sm">{resultadoActual.transcripcion}</p>
                    </div>
                  )}

                  {/* Navegación */}
                  {camState === "results" && (
                    <button onClick={siguienteMuestra}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-bold text-background hover:opacity-90">
                      Siguiente muestra ({muestraActual + 1} / {numMuestras}) <ChevronRight className="h-4 w-4" />
                    </button>
                  )}

                  {camState === "done" && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-saboreo-green/30 bg-saboreo-green/8 px-4 py-3 text-center">
                        <p className="text-sm font-bold text-saboreo-green">✓ Sesión completada — {resultadosMuestras.length} muestras analizadas</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Score promedio: <strong className={scoreColor(Math.round(resultadosMuestras.reduce((a, r) => a + r.score_ia, 0) / resultadosMuestras.length))}>
                            {Math.round(resultadosMuestras.reduce((a, r) => a + r.score_ia, 0) / resultadosMuestras.length)}
                          </strong>
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setVista("list")}
                          className="flex-1 rounded-full border border-border py-2.5 text-sm font-semibold hover:bg-accent">
                          Ver historial
                        </button>
                        <button onClick={nuevaSesion}
                          className="flex-1 rounded-full bg-foreground py-2.5 text-sm font-bold text-background hover:opacity-90">
                          Nueva sesión
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── DETALLE SESIÓN ── */}
          {typeof vista === "object" && (
            <SesionDetalle
              sesion={vista.sesion}
              onClose={() => setVista("list")}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ── Detalle sesión completada ─────────────────────────────────────────────────

function SesionDetalle({ sesion, onClose }: { sesion: Sesion; onClose: () => void }) {
  const cfg = ESTADO_UI[sesion.estado];
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-start justify-between border-b border-border px-6 py-4">
        <div>
          <h2 className="font-display text-lg font-bold">{sesion.titulo}</h2>
          <p className="text-sm text-muted-foreground">{sesion.participante_nombre} · {sesion.participante_edad} años</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
              <cfg.icon className="h-3.5 w-3.5" />{cfg.label}
            </span>
            {sesion.encuesta_titulo && (
              <span className="rounded-full bg-saboreo-blue/10 px-2.5 py-0.5 text-xs text-saboreo-blue font-medium">
                {sesion.encuesta_titulo}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-6 space-y-5">
        {sesion.estado === "completada" && sesion.score_ia != null ? (
          <>
            {/* Score */}
            <div className="flex items-center gap-6 rounded-2xl border border-border bg-muted/30 px-6 py-5">
              <div className="text-center">
                <p className={`font-num text-6xl font-black ${scoreColor(sesion.score_ia)}`}>{sesion.score_ia}</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Índice SABOREO</p>
              </div>
              <div className="flex-1 space-y-2">
                {sesion.duracion_seg != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Duración</span>
                    <span className="font-semibold">{fmtDur(sesion.duracion_seg)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fecha</span>
                  <span className="font-semibold">
                    {new Date(sesion.created_at).toLocaleDateString("es-MX")}
                  </span>
                </div>
              </div>
            </div>

            {/* Emociones */}
            {sesion.emociones && (
              <div>
                <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  <BarChart3 className="h-4 w-4" /> Emociones detectadas
                </p>
                <div className="space-y-2">
                  {Object.entries(sesion.emociones)
                    .sort((a, b) => b[1] - a[1])
                    .map(([emo, pct]) => (
                      <div key={emo} className="flex items-center gap-3">
                        <span className="w-20 text-xs capitalize text-muted-foreground">{emo}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: EMOCIONES_COLORES[emo] ?? "var(--saboreo-blue)",
                            }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs font-semibold">{pct}%</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
            <AlertCircle className="h-10 w-10 opacity-30" />
            <p className="text-sm">Esta sesión aún no tiene resultados de análisis.</p>
          </div>
        )}

        {sesion.notas && (
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notas</p>
            <p className="text-sm">{sesion.notas}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
