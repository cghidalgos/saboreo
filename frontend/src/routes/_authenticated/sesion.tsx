import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Video, Plus, X, Camera, StopCircle, Play,
  CheckCircle2, Trash2, Clock, AlertCircle, Mic, MicOff,
  BrainCircuit, Smile, BarChart3,
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

interface Encuesta { id: string; titulo: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const ESTADO_UI: Record<EstadoSesion, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pendiente:  { label: "Pendiente",  color: "bg-saboreo-yellow/20 text-amber-800",    icon: Clock         },
  grabando:   { label: "Grabando",   color: "bg-red-100 text-red-700",               icon: Video         },
  completada: { label: "Completada", color: "bg-saboreo-green/15 text-green-800",    icon: CheckCircle2  },
  cancelada:  { label: "Cancelada",  color: "bg-muted text-muted-foreground",         icon: AlertCircle   },
};

const EMOCIONES_COLORES: Record<string, string> = {
  alegría: "var(--saboreo-yellow)", sorpresa: "var(--saboreo-sky)",
  interés: "var(--saboreo-green)",  neutral: "var(--saboreo-purple)",
  asco: "var(--saboreo-red)",       tristeza: "var(--saboreo-orange)",
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

/** Genera un análisis IA simulado realista */
function simularIA(duracion: number) {
  const score = Math.floor(Math.random() * 40 + 55);
  const total = 100;
  const alegria = Math.floor(Math.random() * 35 + 25);
  const sorpresa = Math.floor(Math.random() * 20 + 10);
  const interes = Math.floor(Math.random() * 20 + 10);
  const asco = Math.floor(Math.random() * 10 + 2);
  const tristeza = Math.floor(Math.random() * 5 + 1);
  const neutral = total - alegria - sorpresa - interes - asco - tristeza;
  return {
    score,
    duracion_seg: duracion,
    emociones: { alegría: alegria, sorpresa, interés: interes, neutral: Math.max(neutral, 0), asco, tristeza },
  };
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
  type CameraState = "idle" | "preview" | "recording" | "analyzing" | "results";
  const [camState, setCamState] = useState<CameraState>("idle");
  const [timer, setTimer] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [currentSesionId, setCurrentSesionId] = useState<string | null>(null);
  const [iaResult, setIaResult] = useState<ReturnType<typeof simularIA> | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setCamState("idle");
      setTimer(0);
      setIaResult(null);
      setVista("nueva");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  const iniciarCamara = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: micOn });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setCamState("preview");
    } catch {
      toast.error("No se pudo acceder a la cámara. Verifica los permisos.");
    }
  }, [micOn]);

  function iniciarGrabacion() {
    setCamState("recording");
    setTimer(0);
    timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    // Actualizar estado en BD
    if (currentSesionId) {
      apiFetch(`/api/sesiones/${currentSesionId}`, {
        method: "PATCH",
        body: JSON.stringify({ estado: "grabando" }),
      }).catch(console.error);
    }
  }

  async function detenerGrabacion() {
    if (timerRef.current) clearInterval(timerRef.current);
    setCamState("analyzing");
    stopStream();

    await new Promise((r) => setTimeout(r, 2500)); // simula análisis IA

    const resultado = simularIA(timer);
    setIaResult(resultado);

    if (currentSesionId) {
      const sesActualizada = await apiFetch<Sesion>(`/api/sesiones/${currentSesionId}`, {
        method: "PATCH",
        body: JSON.stringify({ estado: "completada", ...resultado }),
      });
      setSesiones((p) => p.map((s) => s.id === currentSesionId ? sesActualizada : s));
    }
    setCamState("results");
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
    setIaResult(null);
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
            className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Nueva sesión
          </button>
        )
      }
    >
      {/* KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Video,       label: "Total sesiones",    val: sesiones.length,                   grad: "bg-gradient-warm" },
          { icon: CheckCircle2,label: "Completadas",       val: completadas,                        grad: "bg-gradient-cool" },
          { icon: BrainCircuit,label: "Score IA promedio", val: completadas ? `${Math.round(avgScore)}` : "—", grad: "bg-gradient-fresh" },
        ].map((k) => (
          <div key={k.label} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${k.grad} shadow-soft`}>
              <k.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-display text-3xl font-black">{k.val}</p>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
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
                            <span className={`text-sm font-black ${scoreColor(s.score_ia)}`}>{s.score_ia} pts</span>
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
                {camState !== "recording" && (
                  <button onClick={() => { stopStream(); setVista("list"); }}
                    className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Video area */}
              <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
                {(camState === "preview" || camState === "recording") && (
                  <video ref={videoRef} className="h-full w-full object-cover" muted autoPlay playsInline />
                )}

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
                    <p className="font-semibold">Analizando con IA…</p>
                    <p className="text-sm opacity-60">Procesando expresiones faciales y voz</p>
                  </div>
                )}

                {/* Timer badge */}
                {camState === "recording" && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-sm font-bold text-white shadow-lg">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    {fmtDur(timer)}
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
              {camState !== "analyzing" && camState !== "results" && (
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
                      <Video className="h-4 w-4" /> Iniciar grabación
                    </button>
                  )}
                  {camState === "recording" && (
                    <button onClick={detenerGrabacion}
                      className="flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background hover:opacity-90">
                      <StopCircle className="h-4 w-4" /> Detener y analizar
                    </button>
                  )}
                </div>
              )}

              {/* Resultados IA */}
              {camState === "results" && iaResult && (
                <div className="p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <BrainCircuit className="h-5 w-5 text-saboreo-purple" />
                    <h3 className="font-display text-lg font-bold">Análisis IA completado</h3>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-6 rounded-2xl border border-border bg-muted/30 px-6 py-5">
                    <div className="text-center">
                      <p className={`font-display text-6xl font-black ${scoreColor(iaResult.score)}`}>{iaResult.score}</p>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Índice SABOREO</p>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Duración</span>
                        <span className="font-semibold">{fmtDur(iaResult.duracion_seg)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-muted-foreground"><Smile className="h-3.5 w-3.5" /> Emoción dominante</span>
                        <span className="font-semibold capitalize">
                          {Object.entries(iaResult.emociones).sort((a, b) => b[1] - a[1])[0][0]}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Emociones */}
                  <div>
                    <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                      <BarChart3 className="h-4 w-4" /> Distribución de emociones
                    </p>
                    <div className="space-y-2">
                      {Object.entries(iaResult.emociones)
                        .sort((a, b) => b[1] - a[1])
                        .map(([emo, pct]) => (
                          <div key={emo} className="flex items-center gap-3">
                            <span className="w-20 text-xs capitalize text-muted-foreground">{emo}</span>
                            <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full transition-all duration-700"
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

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setCurrentSesionId(null); setCamState("idle"); setIaResult(null); setVista("list"); }}
                      className="flex-1 rounded-full border border-border py-2.5 text-sm font-semibold hover:bg-accent"
                    >
                      Ver historial
                    </button>
                    <button
                      onClick={() => { setCurrentSesionId(null); setCamState("idle"); setIaResult(null);
                        setForm({ titulo: "", participante_nombre: "", participante_edad: "", encuesta_id: "", notas: "" }); }}
                      className="flex-1 rounded-full bg-foreground py-2.5 text-sm font-bold text-background hover:opacity-90"
                    >
                      Nueva sesión
                    </button>
                  </div>
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
                <p className={`font-display text-6xl font-black ${scoreColor(sesion.score_ia)}`}>{sesion.score_ia}</p>
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
