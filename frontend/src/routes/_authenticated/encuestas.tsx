import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ClipboardCheck, Plus, X, ChevronRight, Trash2,
  CheckCircle2, Clock, Archive, Users, BarChart2, AlertCircle, Pencil, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/integrations/api/client";
import { AppLayout } from "@/components/saboreo/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/encuestas")({
  head: () => ({ meta: [{ title: "Encuestas — SABOREO" }] }),
  component: EncuestasPage,
});

// ── Tipos ─────────────────────────────────────────────────────────────────────

type EstadoEncuesta = "borrador" | "activa" | "cerrada";

interface EvaluacionMuestra {
  numero_muestra: number;
  calificacion: number | null;
  observaciones: string | null;
}

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
  estado: EstadoEncuesta;
  num_muestras: number;
  instrucciones: string | null;
  atributos: string[];
  preguntas: Pregunta[];
  texto_consentimiento: string | null;
  texto_alergia: string | null;
  campos_participante: CampoParticipante[] | null;
  usar_consentimiento: boolean;
  consentimiento_id: string | null;
  total_respuestas: number;
  created_at: string;
}

interface Respuesta {
  id: string;
  participante_nombre: string;
  participante_edad: number;
  participante_genero: string | null;
  participante_institucion: string | null;
  consentimiento: boolean;
  tiene_alergia: boolean | null;
  escala_hedonica: number | null;
  comentarios: string | null;
  evaluaciones: EvaluacionMuestra[];
  created_at: string;
}

// ── Constantes UI ─────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<EstadoEncuesta, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  activa:   { label: "Activa",   color: "bg-saboreo-green/15 text-green-800",   icon: CheckCircle2 },
  borrador: { label: "Borrador", color: "bg-saboreo-yellow/20 text-amber-800",  icon: Clock        },
  cerrada:  { label: "Cerrada",  color: "bg-muted text-muted-foreground",        icon: Archive      },
};

const ESCALA = [
  { val: 1, emoji: "😢", label: "Me disgusta",              color: "border-red-400 bg-red-50"       },
  { val: 2, emoji: "😕", label: "Me disgusta poco",         color: "border-orange-400 bg-orange-50" },
  { val: 3, emoji: "😐", label: "Ni me gusta ni me disgusta", color: "border-yellow-400 bg-yellow-50" },
  { val: 4, emoji: "😊", label: "Me gusta",                 color: "border-green-400 bg-green-50"   },
  { val: 5, emoji: "😍", label: "Me gusta mucho",           color: "border-sky-400 bg-sky-50"       },
];

// ── Componente principal ──────────────────────────────────────────────────────

function EncuestasPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [encuestas, setEncuestas] = useState<Encuesta[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  type Panel =
    | "list"
    | "crear"
    | { encuesta: Encuesta; subview: "respuestas" | "nueva_respuesta" | "consentimiento" };

  const [panel, setPanel] = useState<Panel>("list");
  const [respuestas, setRespuestas] = useState<Respuesta[]>([]);
  const [loadingResp, setLoadingResp] = useState(false);

  // form crear encuesta
  const [formE, setFormE] = useState({
    titulo: "", descripcion: "", producto: "",
    estado: "activa" as EstadoEncuesta, num_muestras: "1",
  });
  const [savingE, setSavingE] = useState(false);

  const [savingR, setSavingR] = useState(false);

  useEffect(() => { loadEncuestas(); }, [user]);

  async function loadEncuestas() {
    setLoadingList(true);
    try {
      const data = await apiFetch<Encuesta[]>("/api/encuestas");
      setEncuestas(data);
    } catch { toast.error("Error al cargar encuestas"); }
    finally { setLoadingList(false); }
  }

  async function loadRespuestas(encuestaId: string) {
    setLoadingResp(true);
    try {
      const data = await apiFetch<Respuesta[]>(`/api/encuestas/${encuestaId}/respuestas`);
      setRespuestas(data);
    } catch { toast.error("Error al cargar respuestas"); }
    finally { setLoadingResp(false); }
  }

  async function crearEncuesta() {
    if (!formE.titulo.trim() || !formE.producto.trim()) {
      toast.error("Completa título y producto"); return;
    }
    setSavingE(true);
    try {
      const nueva = await apiFetch<Encuesta>("/api/encuestas", {
        method: "POST",
        body: JSON.stringify({
          ...formE,
          num_muestras: parseInt(formE.num_muestras) || 1,
        }),
      });
      setEncuestas((p) => [nueva, ...p]);
      setFormE({ titulo: "", descripcion: "", producto: "", estado: "activa", num_muestras: "1" });
      setPanel("list");
      toast.success("Encuesta creada");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    finally { setSavingE(false); }
  }

  function abrirEdicion(enc: Encuesta) {
    navigate({ to: "/encuestas/$id/edit", params: { id: enc.id } });
  }

  async function toggleEstado(enc: Encuesta) {
    const nuevoEstado: EstadoEncuesta = enc.estado === "activa" ? "cerrada" : "activa";
    try {
      await apiFetch(`/api/encuestas/${enc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      setEncuestas((p) => p.map((e) => e.id === enc.id ? { ...e, estado: nuevoEstado } : e));
      if (typeof panel === "object" && panel.encuesta.id === enc.id) {
        setPanel((prev) => typeof prev === "object" ? { ...prev, encuesta: { ...prev.encuesta, estado: nuevoEstado } } : prev);
      }
      toast.success(nuevoEstado === "activa" ? "Encuesta activada" : "Encuesta desactivada");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  }

  async function eliminarEncuesta(id: string) {
    try {
      await apiFetch(`/api/encuestas/${id}`, { method: "DELETE" });
      setEncuestas((p) => p.filter((e) => e.id !== id));
      if (typeof panel === "object" && panel.encuesta.id === id) setPanel("list");
      toast.success("Encuesta eliminada");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  }

  const [deleteTarget, setDeleteTarget] = useState<Encuesta | null>(null);
  const [deleteInput, setDeleteInput] = useState("");

  async function enviarRespuesta(encuesta: Encuesta, data: Parameters<React.ComponentProps<typeof FormRespuesta>["onSubmit"]>[0]) {
    if (!data.consentimiento) { toast.error("Debes confirmar el consentimiento"); return; }

    const campos = encuesta.campos_participante?.filter((c) => c.activo) ?? [];
    for (const c of campos) {
      if (c.requerido && !data.campos[c.key]?.trim()) {
        toast.error(`El campo "${c.label}" es requerido`); return;
      }
    }

    const sinCalificar = data.evalMuestras.filter((m) => !m.calificacion).length;
    if (sinCalificar > 0) {
      toast.error(`Faltan ${sinCalificar} muestra${sinCalificar > 1 ? "s" : ""} por calificar`); return;
    }

    for (const q of (encuesta.preguntas ?? [])) {
      if (q.requerida && !data.respuestas_extra[q.id]) {
        toast.error(`La pregunta "${q.texto.slice(0, 40)}…" es requerida`); return;
      }
    }

    setSavingR(true);
    try {
      const body = {
        participante_nombre: data.campos["nombre"] ?? "",
        participante_edad: parseInt(data.campos["edad"] ?? "0"),
        participante_genero: data.campos["genero"]?.toLowerCase() || undefined,
        participante_institucion: data.campos["institucion"] || undefined,
        consentimiento: data.consentimiento,
        tiene_alergia: data.tiene_alergia,
        comentarios: data.comentarios || undefined,
        respuestas_extra: data.respuestas_extra,
        evaluaciones: data.evalMuestras.map((m, i) => ({
          numero_muestra: i + 1,
          calificacion: m.calificacion || undefined,
          observaciones: m.observaciones || undefined,
        })),
      };

      const nueva = await apiFetch<Respuesta>(`/api/encuestas/${encuesta.id}/respuestas`, {
        method: "POST", body: JSON.stringify(body),
      });
      setRespuestas((p) => [nueva, ...p]);
      setEncuestas((p) => p.map((e) => e.id === encuesta.id ? { ...e, total_respuestas: e.total_respuestas + 1 } : e));
      if (typeof panel === "object") setPanel({ ...panel, subview: "respuestas" });
      toast.success("Respuesta registrada ✓");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    finally { setSavingR(false); }
  }

  async function eliminarRespuesta(encuestaId: string, respId: string) {
    try {
      await apiFetch(`/api/encuestas/${encuestaId}/respuestas/${respId}`, { method: "DELETE" });
      setRespuestas((p) => p.filter((r) => r.id !== respId));
      setEncuestas((p) => p.map((e) => e.id === encuestaId ? { ...e, total_respuestas: Math.max(0, e.total_respuestas - 1) } : e));
      toast.success("Respuesta eliminada");
    } catch { toast.error("Error al eliminar"); }
  }

  async function abrirEncuesta(enc: Encuesta) {
    // Carga la encuesta completa (con campos_participante, preguntas, etc.)
    try {
      const completa = await apiFetch<Encuesta>(`/api/encuestas/${enc.id}`);
      setPanel({ encuesta: { ...completa, total_respuestas: enc.total_respuestas }, subview: "respuestas" });
      loadRespuestas(enc.id);
    } catch {
      setPanel({ encuesta: enc, subview: "respuestas" });
      loadRespuestas(enc.id);
    }
  }

  const totalEncuestas = encuestas.length;
  const totalRespuestas = encuestas.reduce((s, e) => s + e.total_respuestas, 0);
  const activas = encuestas.filter((e) => e.estado === "activa").length;

  return (
    <>
    <AppLayout
      title="Encuestas sensoriales"
      subtitle="Consentimiento, datos demográficos y escala hedónica facial"
      actions={
        panel !== "crear" && (
          <button
            onClick={() => setPanel("crear")}
            className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Nueva encuesta
          </button>
        )
      }
    >
      {/* KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { icon: ClipboardCheck, label: "Total encuestas",   val: totalEncuestas,  grad: "bg-gradient-warm"  },
          { icon: Users,          label: "Total respuestas",  val: totalRespuestas, grad: "bg-gradient-cool"  },
          { icon: BarChart2,      label: "Encuestas activas", val: activas,         grad: "bg-gradient-fresh" },
        ].map((k) => (
          <div key={k.label} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${k.grad} shadow-soft`}>
              <k.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-num text-3xl font-black">{k.val}</p>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Lista encuestas */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-display text-base font-bold">Mis encuestas</h2>
            </div>

            {loadingList ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Cargando…</div>
            ) : encuestas.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <ClipboardCheck className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No hay encuestas aún.</p>
                <button onClick={() => setPanel("crear")} className="text-sm font-semibold text-saboreo-blue hover:underline">
                  Crea la primera
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {encuestas.map((enc) => {
                  const cfg = ESTADO_CONFIG[enc.estado];
                  const isActive = typeof panel === "object" && panel.encuesta.id === enc.id;
                  return (
                    <li key={enc.id} className={`group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-accent/40 ${isActive ? "bg-accent/60" : ""}`}>
                      <button className="min-w-0 flex-1 text-left" onClick={() => abrirEncuesta(enc)}>
                        <p className="truncate font-semibold leading-tight">{enc.titulo}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{enc.producto}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.color}`}>
                            <cfg.icon className="h-3 w-3" />{cfg.label}
                          </span>
                          {enc.num_muestras > 1 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                              {enc.num_muestras} muestras
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground">
                            {enc.total_respuestas} respuesta{enc.total_respuestas !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center gap-1 pt-1">
                        {/* Toggle activa/cerrada */}
                        <button
                          title={enc.estado === "activa" ? "Desactivar encuesta" : "Activar encuesta"}
                          onClick={(e) => { e.stopPropagation(); toggleEstado(enc); }}
                          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none ${enc.estado === "activa" ? "bg-saboreo-green" : "bg-muted-foreground/30"}`}
                        >
                          <span
                            className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${enc.estado === "activa" ? "translate-x-4" : "translate-x-0"}`}
                          />
                        </button>
                        <button onClick={() => abrirEncuesta(enc)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-muted">
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); abrirEdicion(enc); }}
                          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-blue-50 hover:text-blue-600 group-hover:opacity-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteInput(""); setDeleteTarget(enc); }}
                          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Panel derecho */}
        <div className="lg:col-span-3">
          {panel === "list" && (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 text-center">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground/30" />
              <p className="font-semibold text-muted-foreground">Selecciona una encuesta</p>
              <p className="text-sm text-muted-foreground/70">o crea una nueva para comenzar</p>
            </div>
          )}

          {panel === "crear" && (
            <div className="flex max-h-[calc(100vh-13rem)] flex-col rounded-2xl border border-border bg-card shadow-card">
              <div className="shrink-0 flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="font-display text-lg font-bold">Nueva encuesta</h2>
                <button onClick={() => setPanel("list")} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                <Field label="Título *">
                  <input
                    type="text"
                    placeholder="Ej. Panel Sensorial Barra – Proyecto Orquídeas"
                    value={formE.titulo}
                    onChange={(e) => setFormE((p) => ({ ...p, titulo: e.target.value }))}
                    className="input-base"
                  />
                </Field>
                <Field label="Producto evaluado *">
                  <input
                    type="text"
                    placeholder="Ej. Barra proteica cacao-avena"
                    value={formE.producto}
                    onChange={(e) => setFormE((p) => ({ ...p, producto: e.target.value }))}
                    className="input-base"
                  />
                </Field>
                <Field label="Descripción (opcional)">
                  <textarea
                    rows={2}
                    placeholder="Objetivos, contexto, atributos a evaluar…"
                    value={formE.descripcion}
                    onChange={(e) => setFormE((p) => ({ ...p, descripcion: e.target.value }))}
                    className="input-base resize-none"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Número de muestras">
                    <input
                      type="number"
                      min={1} max={30}
                      value={formE.num_muestras}
                      onChange={(e) => setFormE((p) => ({ ...p, num_muestras: e.target.value }))}
                      className="input-base"
                    />
                  </Field>
                  <Field label="Estado inicial">
                    <select
                      value={formE.estado}
                      onChange={(e) => setFormE((p) => ({ ...p, estado: e.target.value as EstadoEncuesta }))}
                      className="input-base"
                    >
                      <option value="activa">Activa</option>
                      <option value="borrador">Borrador</option>
                    </select>
                  </Field>
                </div>
                <button
                  onClick={crearEncuesta}
                  disabled={savingE}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-bold text-background hover:opacity-90 disabled:opacity-60"
                >
                  {savingE ? "Guardando…" : <><Plus className="h-4 w-4" /> Crear encuesta</>}
                </button>
              </div>
            </div>
          )}

          {typeof panel === "object" && (
            <div className="flex max-h-[calc(100vh-13rem)] flex-col rounded-2xl border border-border bg-card shadow-card">
              {/* Header encuesta — fijo */}
              <div className="shrink-0 border-b border-border px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold">{panel.encuesta.titulo}</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">{panel.encuesta.producto}</p>
                  </div>
                  <button onClick={() => setPanel("list")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-muted">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {(["respuestas", "nueva_respuesta"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        if (t === "nueva_respuesta" && panel.encuesta.estado === "cerrada") {
                          toast.error("Esta encuesta está cerrada"); return;
                        }
                        setPanel({ ...panel, subview: t });
                      }}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                        panel.subview === t
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {t === "respuestas" ? `Respuestas (${panel.encuesta.total_respuestas})` : "Vista previa"}
                    </button>
                  ))}
                  {panel.encuesta.usar_consentimiento && panel.encuesta.consentimiento_id && (
                    <button
                      onClick={() => setPanel({ ...panel, subview: "consentimiento" })}
                      className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                        panel.subview === "consentimiento"
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <FileText className="h-3 w-3" /> Vista previa consentimiento
                    </button>
                  )}
                  <button
                    onClick={() => abrirEdicion(panel.encuesta)}
                    className="flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent"
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </button>
                </div>
              </div>

              {/* Respuestas */}
              {panel.subview === "respuestas" && (
                <div className="flex-1 overflow-y-auto p-4">
                  {loadingResp ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
                  ) : respuestas.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                      <Users className="h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">Sin respuestas aún</p>
                      <button
                        onClick={() => setPanel({ ...panel, subview: "nueva_respuesta" })}
                        className="text-sm font-semibold text-saboreo-blue hover:underline"
                      >
                        Registrar primera respuesta
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {respuestas.map((r) => (
                        <RespuestaCard
                          key={r.id}
                          r={r}
                          onDelete={() => eliminarRespuesta(panel.encuesta.id, r.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Nueva respuesta */}
              {panel.subview === "nueva_respuesta" && (
                <div className="flex-1 overflow-y-auto">
                  <FormRespuesta
                    encuesta={panel.encuesta}
                    saving={savingR}
                    onSubmit={(data) => enviarRespuesta(panel.encuesta, data)}
                  />
                </div>
              )}

              {/* Vista previa consentimiento */}
              {panel.subview === "consentimiento" && panel.encuesta.consentimiento_id && (
                <div className="flex-1 overflow-y-auto p-4">
                  <PreviewConsentimientoPanel consentimientoId={panel.encuesta.consentimiento_id} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>

    {/* ── Dialog captcha eliminar encuesta ── */}
    <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600">Eliminar encuesta</DialogTitle>
          <DialogDescription className="pt-1">
            Esta acción es <strong>irreversible</strong>. Se eliminarán todas las
            respuestas y evaluaciones asociadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Escribe el título de la encuesta para confirmar:
          </p>
          <p className="rounded-md bg-muted px-3 py-2 text-sm font-semibold select-all">
            {deleteTarget?.titulo}
          </p>
          <input
            autoFocus
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            placeholder="Escribe el título aquí…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={() => setDeleteTarget(null)}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            disabled={deleteInput !== deleteTarget?.titulo}
            onClick={async () => {
              if (!deleteTarget) return;
              await eliminarEncuesta(deleteTarget.id);
              setDeleteTarget(null);
            }}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Eliminar definitivamente
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

// ── Tarjeta de respuesta ──────────────────────────────────────────────────────

function RespuestaCard({ r, onDelete }: { r: Respuesta; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const esMultimuestra = r.evaluaciones && r.evaluaciones.length > 0;

  const promedio = esMultimuestra
    ? r.evaluaciones.filter((e) => e.calificacion).reduce((s, e, _, a) => s + (e.calificacion ?? 0) / a.length, 0)
    : null;

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{r.participante_nombre}</p>
          <p className="text-xs text-muted-foreground">
            {r.participante_edad} años
            {r.participante_genero && ` · ${r.participante_genero}`}
            {r.participante_institucion && ` · ${r.participante_institucion}`}
          </p>
          {r.tiene_alergia !== null && (
            <p className={`mt-1 text-xs font-medium ${r.tiene_alergia ? "text-red-600" : "text-green-700"}`}>
              {r.tiene_alergia ? "⚠ Reportó alergia" : "Sin alergias reportadas"}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {/* Botón eliminar */}
          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-red-600 font-medium">¿Eliminar?</span>
              <button
                onClick={onDelete}
                className="text-[11px] font-semibold text-red-600 hover:underline"
              >Sí</button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[11px] text-muted-foreground hover:underline"
              >No</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-muted-foreground/40 hover:text-red-500 transition-colors"
              title="Eliminar respuesta"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {/* Escala/promedio */}
          {esMultimuestra ? (
            <>
              <span className="text-xs font-semibold text-muted-foreground">
                {r.evaluaciones.length} muestras · prom {promedio?.toFixed(1)}
              </span>
              <span className="text-2xl leading-none" title={`Promedio ${promedio?.toFixed(1)}`}>
                {ESCALA[Math.round(promedio ?? 3) - 1].emoji}
              </span>
            </>
          ) : r.escala_hedonica ? (
            <span className="text-3xl leading-none" title={ESCALA[r.escala_hedonica - 1].label}>
              {ESCALA[r.escala_hedonica - 1].emoji}
            </span>
          ) : null}
        </div>
      </div>

      {esMultimuestra && (
        <>
          <button
            onClick={() => setExpanded((p) => !p)}
            className="mt-2 text-xs font-semibold text-saboreo-blue hover:underline"
          >
            {expanded ? "Ocultar evaluaciones" : "Ver evaluaciones por muestra"}
          </button>
          {expanded && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-1 pr-3 text-left font-semibold">Muestra</th>
                    <th className="py-1 pr-3 text-center font-semibold">Cal.</th>
                    <th className="py-1 text-left font-semibold">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {r.evaluaciones.map((ev) => (
                    <tr key={ev.numero_muestra} className="border-b border-border/50 last:border-0">
                      <td className="py-1 pr-3 font-medium">#{ev.numero_muestra}</td>
                      <td className="py-1 pr-3 text-center">
                        {ev.calificacion ? (
                          <span title={ESCALA[ev.calificacion - 1].label}>
                            {ESCALA[ev.calificacion - 1].emoji} {ev.calificacion}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-1 text-muted-foreground">{ev.observaciones || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {r.comentarios && (
        <p className="mt-2 text-sm text-muted-foreground">"{r.comentarios}"</p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground/60">
        {new Date(r.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
      </p>
    </div>
  );
}

// ── Formulario de nueva respuesta (dinámico) ──────────────────────────────────

type FormRespuestaState = {
  consentimiento: boolean;
  tiene_alergia: boolean | null;
  campos: Record<string, string>;       // key → valor
  comentarios: string;
  respuestas_extra: Record<string, string>; // pregunta.id → valor
};

function FormRespuesta({ encuesta, saving, onSubmit }: {
  encuesta: Encuesta;
  saving: boolean;
  onSubmit: (data: FormRespuestaState & { evalMuestras: { calificacion: number; observaciones: string }[] }) => void;
}) {
  const campos = encuesta.campos_participante?.filter((c) => c.activo) ?? [
    { key: "nombre", label: "Nombre completo", tipo: "texto" as const, activo: true, requerido: true },
    { key: "edad",   label: "Edad",            tipo: "numero" as const, activo: true, requerido: true },
  ];
  const atributos = encuesta.atributos?.length ? encuesta.atributos : ["SABOR"];
  const preguntas = encuesta.preguntas ?? [];
  const instrucciones = encuesta.instrucciones;
  const textoConsent = encuesta.texto_consentimiento || "El padre/madre o tutor autoriza la participación del menor en esta evaluación sensorial, incluyendo la captura de datos con fines científicos.";
  const textoAlergia = encuesta.texto_alergia || "¿Tiene algún tipo de alergia a los ingredientes del producto?";

  const [form, setForm] = useState<FormRespuestaState>({
    consentimiento: false, tiene_alergia: null,
    campos: Object.fromEntries(campos.map((c) => [c.key, ""])),
    comentarios: "", respuestas_extra: {},
  });
  const [evalMuestras, setEvalMuestras] = useState(
    Array.from({ length: encuesta.num_muestras }, () => ({ calificacion: 0, observaciones: "" }))
  );

  function setEval(idx: number, field: "calificacion" | "observaciones", value: number | string) {
    setEvalMuestras((p) => p.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }

  function handleSubmit() {
    onSubmit({ ...form, evalMuestras });
  }

  const secNum = { consent: 1, datos: 2, eval: 3, pregs: 4 };

  return (
    <div className="space-y-5 p-6">

      {/* Instrucciones */}
      {instrucciones && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-blue-800">
            <AlertCircle className="h-4 w-4" /> Instrucciones del panel sensorial
          </h3>
          <ul className="space-y-1 text-xs leading-relaxed text-blue-700">
            {instrucciones.split("\n").filter(Boolean).map((l, i) => (
              <li key={i}>• {l.replace(/^[•\-\*]\s*/, "")}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 1. Consentimiento */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <h3 className="mb-2 font-semibold">{secNum.consent}. Consentimiento informado</h3>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{textoConsent}</p>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={form.consentimiento}
            onChange={(e) => setForm((p) => ({ ...p, consentimiento: e.target.checked }))}
            className="mt-0.5 h-4 w-4 accent-saboreo-blue"
          />
          <span className="text-sm font-medium">Confirmo que cuento con el consentimiento del tutor</span>
        </label>
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{textoAlergia}</p>
          <div className="flex gap-3">
            {[{ val: false, label: "No" }, { val: true, label: "Sí" }].map(({ val, label }) => (
              <label key={label} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input type="radio" checked={form.tiene_alergia === val}
                  onChange={() => setForm((p) => ({ ...p, tiene_alergia: val }))}
                  className="accent-saboreo-blue" />
                {label}
              </label>
            ))}
          </div>
          {form.tiene_alergia === true && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              ⚠ El participante reporta alergia. Verifique con el tutor antes de continuar.
            </p>
          )}
        </div>
      </div>

      {/* 2. Datos del participante — dinámico */}
      <div>
        <h3 className="mb-3 font-semibold">{secNum.datos}. Datos del participante</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {campos.map((c) => (
            <Field key={c.key} label={`${c.label}${c.requerido ? " *" : ""}`}>
              {c.tipo === "select" ? (
                <select
                  value={form.campos[c.key] ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, campos: { ...p.campos, [c.key]: e.target.value } }))}
                  className="input-base"
                >
                  <option value="">Seleccionar…</option>
                  {(c.opciones ?? []).map((op) => <option key={op} value={op}>{op}</option>)}
                </select>
              ) : (
                <input
                  type={c.tipo === "numero" ? "number" : "text"}
                  min={c.tipo === "numero" ? 3 : undefined}
                  max={c.tipo === "numero" ? 18 : undefined}
                  placeholder={c.tipo === "numero" ? "Años" : c.label}
                  value={form.campos[c.key] ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, campos: { ...p.campos, [c.key]: e.target.value } }))}
                  className="input-base"
                />
              )}
            </Field>
          ))}
        </div>
      </div>

      {/* 3. Evaluación de muestras — dinámico */}
      <div>
        <h3 className="mb-1 font-semibold">{secNum.eval}. Evaluación de muestras — {atributos.join(", ")}</h3>
        <p className="mb-3 text-xs text-muted-foreground">Escala: 1 = Me disgusta · 5 = Me gusta mucho</p>
        <div className="mb-4 flex justify-between rounded-xl bg-muted/40 px-3 py-2">
          {ESCALA.map((e) => (
            <div key={e.val} className="flex flex-col items-center gap-0.5">
              <span className="text-lg leading-none">{e.emoji}</span>
              <span className="text-[10px] font-bold">{e.val}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {evalMuestras.map((m, idx) => (
            <div key={idx} className="rounded-xl border border-border bg-card p-3">
              <p className="mb-2 text-xs font-bold text-muted-foreground">Muestra {idx + 1}</p>
              {atributos.map((a) => (
                <div key={a} className="mb-2">
                  <p className="mb-1 text-xs text-muted-foreground">{a}</p>
                  <div className="flex gap-1.5">
                    {ESCALA.map((e) => (
                      <button key={e.val} type="button"
                        onClick={() => setEval(idx, "calificacion", e.val)}
                        className={`flex flex-1 flex-col items-center rounded-lg border-2 py-1.5 transition-all ${
                          m.calificacion === e.val ? `${e.color} scale-105 shadow-sm` : "border-border bg-card hover:border-muted-foreground/30"
                        }`}
                      >
                        <span className="text-base leading-none">{e.emoji}</span>
                        <span className="text-[10px] font-bold">{e.val}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <input type="text" placeholder="Observaciones (opcional)"
                value={m.observaciones}
                onChange={(e) => setEval(idx, "observaciones", e.target.value)}
                className="input-base text-xs" />
            </div>
          ))}
        </div>
      </div>

      {/* 4. Preguntas adicionales — dinámicas */}
      {preguntas.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">{secNum.pregs}. Preguntas adicionales</h3>
          {preguntas.map((q, idx) => (
            <div key={q.id} className="rounded-xl border border-border bg-card p-4">
              <p className="mb-2 text-sm font-medium">
                {idx + 1}. {q.texto}{q.requerida && <span className="ml-1 text-red-500">*</span>}
              </p>
              {q.tipo === "si_no" && (
                <div className="flex gap-4">
                  {["Sí", "No"].map((op) => (
                    <label key={op} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="radio" name={`p_${q.id}`}
                        checked={form.respuestas_extra[q.id] === op}
                        onChange={() => setForm((p) => ({ ...p, respuestas_extra: { ...p.respuestas_extra, [q.id]: op } }))}
                        className="accent-saboreo-blue" />
                      {op}
                    </label>
                  ))}
                </div>
              )}
              {q.tipo === "texto" && (
                <textarea rows={2} placeholder="Escribe tu respuesta…"
                  value={form.respuestas_extra[q.id] ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, respuestas_extra: { ...p.respuestas_extra, [q.id]: e.target.value } }))}
                  className="input-base resize-none text-sm" />
              )}
              {q.tipo === "escala" && (
                <div className="flex items-center gap-2">
                  {q.etiqueta_min && <span className="text-xs text-muted-foreground">{q.etiqueta_min}</span>}
                  <div className="flex gap-1">
                    {Array.from({ length: (q.escala_max ?? 5) - (q.escala_min ?? 1) + 1 }, (_, i) => {
                      const v = String((q.escala_min ?? 1) + i);
                      return (
                        <button key={v} type="button"
                          onClick={() => setForm((p) => ({ ...p, respuestas_extra: { ...p.respuestas_extra, [q.id]: v } }))}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 text-sm font-bold transition-all ${
                            form.respuestas_extra[q.id] === v ? "border-saboreo-blue bg-blue-50 text-saboreo-blue scale-105" : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
                          }`}
                        >{v}</button>
                      );
                    })}
                  </div>
                  {q.etiqueta_max && <span className="text-xs text-muted-foreground">{q.etiqueta_max}</span>}
                </div>
              )}
              {q.tipo === "opcion_multiple" && (
                <div className="space-y-2">
                  {(q.opciones ?? []).map((op) => (
                    <label key={op} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="radio" name={`p_${q.id}`}
                        checked={form.respuestas_extra[q.id] === op}
                        onChange={() => setForm((p) => ({ ...p, respuestas_extra: { ...p.respuestas_extra, [q.id]: op } }))}
                        className="accent-saboreo-blue" />
                      {op}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Field label="Comentarios adicionales (opcional)">
        <textarea rows={2} placeholder="Observaciones del evaluador…"
          value={form.comentarios}
          onChange={(e) => setForm((p) => ({ ...p, comentarios: e.target.value }))}
          className="input-base resize-none" />
      </Field>

      <button onClick={handleSubmit} disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-saboreo-green py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60">
        {saving ? "Guardando…" : <><CheckCircle2 className="h-4 w-4" /> Guardar respuesta</>}
      </button>
    </div>
  );
}

// ── Vista previa consentimiento (panel admin) ─────────────────────────────────

function PreviewConsentimientoPanel({ consentimientoId }: { consentimientoId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/consentimientos/publico/${consentimientoId}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [consentimientoId]);

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Cargando consentimiento…</p>;
  if (!data) return <p className="py-8 text-center text-sm text-red-500">No se pudo cargar el consentimiento.</p>;

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden text-sm">
      <div className="bg-slate-800 px-5 py-4 text-white">
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Consentimiento informado</p>
        <h3 className="font-bold leading-snug">{data.titulo_investigacion || data.titulo}</h3>
        {data.investigadores?.length > 0 && (
          <p className="mt-1 text-xs opacity-60">{data.investigadores.map((i: any) => i.nombre).join(" · ")}</p>
        )}
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-400">Nombre: ___________</div>
          <div className="rounded border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-400">Fecha: ___________</div>
        </div>
        {data.texto_intro && data.texto_intro.split(/\n\n+/).map((par, i) => (
          <p key={i} className="text-xs leading-relaxed text-gray-500 mb-1 text-justify">{par}</p>
        ))}
        {data.ingredientes?.length > 0 && (
          <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                {["Ingrediente","Marca","%"].map((h) => <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.ingredientes.map((i: any, idx: number) => (
                <tr key={idx}>
                  <td className="px-2 py-1">{i.ingrediente}</td>
                  <td className="px-2 py-1 text-gray-500">{i.marca}</td>
                  <td className="px-2 py-1 text-gray-500">{i.porcentaje}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data.tiene_pregunta_alergia && data.texto_alergia && (
          <div className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {data.texto_alergia} <span className="opacity-50">( ) SÍ  ( ) NO</span>
          </div>
        )}
        {data.parrafos?.map((p: string, i: number) => (
          <p key={i} className="text-xs leading-relaxed text-gray-500 text-justify">{p}</p>
        ))}
        <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3 text-center text-xs text-gray-500">
          Pulsando <strong>"Aceptar"</strong> confirma su participación.
          <div className="mt-2"><span className="rounded-full bg-slate-700 px-5 py-1.5 text-white text-xs font-bold">Aceptar</span></div>
        </div>
        {data.texto_contacto && (
          <div className="text-xs text-gray-400">
            {data.texto_contacto.split("\n").map((l: string, i: number) => <p key={i}>{l}</p>)}
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
