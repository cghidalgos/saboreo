import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft, Save, Pencil, Check, X, Plus, Trash2,
  ChevronUp, ChevronDown, AlertCircle, Info, FileText, ExternalLink, Video,
  Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/integrations/api/client";
import { AppLayout } from "@/components/saboreo/AppLayout";

export const Route = createFileRoute("/_authenticated/encuestas_/$id/edit")({
  head: () => ({ meta: [{ title: "Editar encuesta — SABOREO" }] }),
  component: EditarEncuestaPage,
});

// ── Tipos ─────────────────────────────────────────────────────────────────────

type EstadoEncuesta = "borrador" | "activa" | "cerrada";
type TipoPregunta = "escala" | "texto" | "si_no" | "opcion_multiple";

interface Pregunta {
  id: string;
  tipo: TipoPregunta;
  texto: string;
  requerida: boolean;
  opciones?: string[];
  escala_min?: number;
  escala_max?: number;
  etiqueta_min?: string;
  etiqueta_max?: string;
}

interface CampoParticipante {
  key: string;
  label: string;
  tipo: "texto" | "numero" | "select";
  activo: boolean;
  requerido: boolean;
  opciones?: string[];
}

interface ConsentimientoResumen {
  id: string;
  titulo: string;
  titulo_investigacion: string | null;
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
  requiere_video: boolean;
  secciones_ocultas: string[] | null;
  total_respuestas: number;
  created_at: string;
}

const DEFAULT_CAMPOS: CampoParticipante[] = [
  { key: "nombre",      label: "Nombre completo",       tipo: "texto",  activo: true,  requerido: true  },
  { key: "edad",        label: "Edad",                  tipo: "numero", activo: true,  requerido: true  },
  { key: "genero",      label: "Género",                tipo: "select", activo: true,  requerido: false, opciones: ["Niño", "Niña", "Otro"] },
  { key: "institucion", label: "Institución / escuela", tipo: "texto",  activo: true,  requerido: false },
];

const ESCALA_EMOJIS = ["😢", "😕", "😐", "😊", "😍"];

function uid() { return Math.random().toString(36).slice(2, 10); }

// ── Página principal ──────────────────────────────────────────────────────────

function EditarEncuestaPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [encuesta, setEncuesta] = useState<Encuesta | null>(null);

  // Estado editable
  const [titulo, setTitulo] = useState("");
  const [producto, setProducto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estado, setEstado] = useState<EstadoEncuesta>("activa");
  const [instrucciones, setInstrucciones] = useState("");
  const [textoConsentimiento, setTextoConsentimiento] = useState("");
  const [textoAlergia, setTextoAlergia] = useState("");
  const [numMuestras, setNumMuestras] = useState(1);
  const [atributos, setAtributos] = useState<string[]>(["SABOR"]);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [camposParticipante, setCamposParticipante] = useState<CampoParticipante[]>(DEFAULT_CAMPOS);
  const [usarConsentimiento, setUsarConsentimiento] = useState(false);
  const [consentimientoId, setConsentimientoId] = useState<string | null>(null);
  const [requiereVideo, setRequiereVideo] = useState(false);
  const [seccionesOcultas, setSeccionesOcultas] = useState<string[]>([]);
  const [listaConsentimientos, setListaConsentimientos] = useState<ConsentimientoResumen[]>([]);

  // Sección actualmente en edición
  const [seccionActiva, setSeccionActiva] = useState<string | null>(null);
  const [nuevoAtributo, setNuevoAtributo] = useState("");
  const [editandoPreguntaId, setEditandoPreguntaId] = useState<string | null>(null);
  const [showTipoMenu, setShowTipoMenu] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<Encuesta>(`/api/encuestas/${id}`),
      apiFetch<ConsentimientoResumen[]>("/api/consentimientos"),
    ]).then(([enc, consentimientos]) => {
        setEncuesta(enc);
        setTitulo(enc.titulo);
        setProducto(enc.producto);
        setDescripcion(enc.descripcion ?? "");
        setEstado(enc.estado);
        setInstrucciones(enc.instrucciones ?? "");
        setTextoConsentimiento(enc.texto_consentimiento ?? "");
        setTextoAlergia(enc.texto_alergia ?? "¿Tiene algún tipo de alergia a los ingredientes del producto?");
        setNumMuestras(enc.num_muestras ?? 1);
        setAtributos(enc.atributos?.length ? enc.atributos : ["SABOR"]);
        setPreguntas(Array.isArray(enc.preguntas) ? enc.preguntas : []);
        const cp = enc.campos_participante;
        setCamposParticipante(Array.isArray(cp) ? cp : DEFAULT_CAMPOS);
        setUsarConsentimiento(enc.usar_consentimiento ?? false);
        setConsentimientoId(enc.consentimiento_id ?? null);
        setRequiereVideo(enc.requiere_video ?? false);
        setSeccionesOcultas(Array.isArray(enc.secciones_ocultas) ? enc.secciones_ocultas : []);
        setListaConsentimientos(consentimientos);
      })
      .catch(() => toast.error("No se pudo cargar la encuesta"))
      .finally(() => setLoading(false));
  }, [id]);

  async function guardar() {
    if (!titulo.trim()) { toast.error("El título es requerido"); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/encuestas/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          titulo, producto, descripcion: descripcion || undefined, estado,
          instrucciones: instrucciones || undefined,
          texto_consentimiento: textoConsentimiento || undefined,
          texto_alergia: textoAlergia || undefined,
          num_muestras: numMuestras,
          atributos, preguntas,
          campos_participante: camposParticipante,
          usar_consentimiento: usarConsentimiento,
          consentimiento_id: usarConsentimiento ? consentimientoId : null,
          requiere_video: requiereVideo,
          secciones_ocultas: seccionesOcultas,
        }),
      });
      toast.success("Encuesta guardada");
      navigate({ to: "/encuestas" });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error al guardar"); }
    finally { setSaving(false); }
  }

  // ── Helpers preguntas ──────────────────────────────────────────────────────

  function agregarPregunta(tipo: TipoPregunta) {
    const nueva: Pregunta = {
      id: uid(), tipo, texto: "", requerida: true,
      ...(tipo === "escala" ? { escala_min: 1, escala_max: 5, etiqueta_min: "Muy malo", etiqueta_max: "Excelente" } : {}),
      ...(tipo === "opcion_multiple" ? { opciones: ["Opción 1", "Opción 2"] } : {}),
    };
    setPreguntas((p) => [...p, nueva]);
    setEditandoPreguntaId(nueva.id);
    setShowTipoMenu(false);
  }

  function updatePregunta(pid: string, cambios: Partial<Pregunta>) {
    setPreguntas((p) => p.map((q) => q.id === pid ? { ...q, ...cambios } : q));
  }

  function moverPregunta(pid: string, dir: -1 | 1) {
    setPreguntas((prev) => {
      const idx = prev.findIndex((q) => q.id === pid);
      const ni = idx + dir;
      if (ni < 0 || ni >= prev.length) return prev;
      const a = [...prev]; [a[idx], a[ni]] = [a[ni], a[idx]]; return a;
    });
  }

  if (loading) return <AppLayout title="Editar encuesta"><div className="flex h-64 items-center justify-center text-muted-foreground">Cargando…</div></AppLayout>;
  if (!encuesta) return <AppLayout title="Editar encuesta"><div className="flex h-64 items-center justify-center text-muted-foreground">No encontrada</div></AppLayout>;

  const toggleSeccion = (s: string) => setSeccionActiva((v) => v === s ? null : s);
  const estaOculta = (s: string) => seccionesOcultas.includes(s);
  const toggleOcultar = (s: string) =>
    setSeccionesOcultas((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);

  return (
    <AppLayout
      title="Editor de encuesta"
      subtitle={titulo}
      actions={
        <div className="flex gap-2">
          <button onClick={() => navigate({ to: "/encuestas" })} className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Volver</span>
          </button>
          <button onClick={guardar} disabled={saving} className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-60">
            <Save className="h-4 w-4" /> <span className="hidden sm:inline">{saving ? "Guardando…" : "Guardar cambios"}</span>
          </button>
        </div>
      }
    >
      {/* Aviso editor visual */}
      <div className="mx-auto mb-4 max-w-3xl flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
        <Info className="h-4 w-4 shrink-0" />
        Haz clic en el lápiz <Pencil className="inline h-3 w-3" /> para editar una sección, o en <EyeOff className="inline h-3 w-3" /> para ocultarla del formulario que ven los participantes.
      </div>

      <div className="mx-auto max-w-3xl space-y-4">

        {/* ═══ SECCIÓN CABECERA ═══ */}
        <SeccionEditable
          titulo="Cabecera de la encuesta"
          activa={seccionActiva === "cabecera"}
          onToggle={() => toggleSeccion("cabecera")}
          preview={
            <div>
              <p className="text-lg font-bold">{titulo || <span className="italic text-muted-foreground">Sin título</span>}</p>
              <p className="text-sm text-muted-foreground">{producto}</p>
              {descripcion && <p className="mt-1 text-xs text-muted-foreground">{descripcion}</p>}
              <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${estado === "activa" ? "bg-green-100 text-green-800" : estado === "borrador" ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`}>
                {estado === "activa" ? "Activa" : estado === "borrador" ? "Borrador" : "Cerrada"}
              </span>
            </div>
          }
          editor={
            <div className="space-y-3">
              <EField label="Título *">
                <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input-base" />
              </EField>
              <EField label="Producto evaluado">
                <input type="text" value={producto} onChange={(e) => setProducto(e.target.value)} className="input-base" />
              </EField>
              <EField label="Descripción">
                <textarea rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="input-base resize-none" />
              </EField>
              <EField label="Estado">
                <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoEncuesta)} className="input-base">
                  <option value="activa">Activa</option>
                  <option value="borrador">Borrador</option>
                  <option value="cerrada">Cerrada</option>
                </select>
              </EField>
            </div>
          }
        />

        {/* ═══ INSTRUCCIONES ═══ */}
        <SeccionEditable
          titulo="Instrucciones del panel sensorial"
          activa={seccionActiva === "instrucciones"}
          onToggle={() => toggleSeccion("instrucciones")}
          oculta={estaOculta("instrucciones")}
          onToggleOcultar={() => toggleOcultar("instrucciones")}
          preview={
            instrucciones ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <ul className="space-y-1 text-xs text-blue-700">
                  {instrucciones.split("\n").filter(Boolean).map((l, i) => (
                    <li key={i}>• {l.replace(/^[•\-\*]\s*/, "")}</li>
                  ))}
                </ul>
              </div>
            ) : <p className="text-sm italic text-muted-foreground">Sin instrucciones — haz clic para agregar</p>
          }
          editor={
            <EField label="Instrucciones (una por línea)">
              <textarea
                rows={6}
                value={instrucciones}
                onChange={(e) => setInstrucciones(e.target.value)}
                className="input-base resize-y font-mono text-xs"
                placeholder={"Por favor no pruebe las muestras antes de que se le indique.\nEvalúe el atributo SABOR de cada muestra.\nPruebe un bocado por muestra.\nBeba agua entre cada muestra para limpiar su paladar."}
              />
              <p className="text-xs text-muted-foreground">Cada línea se mostrará como un punto de la lista.</p>
            </EField>
          }
        />

        {/* ═══ CONSENTIMIENTO ═══ */}
        <SeccionEditable
          titulo="1. Consentimiento informado"
          activa={seccionActiva === "consentimiento"}
          onToggle={() => toggleSeccion("consentimiento")}
          oculta={estaOculta("consentimiento")}
          onToggleOcultar={() => toggleOcultar("consentimiento")}
          preview={
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">{textoConsentimiento || <span className="italic">Sin texto de consentimiento</span>}</p>
              <div className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled className="h-4 w-4" />
                <span>Confirmo que cuento con el consentimiento del tutor</span>
              </div>
              <div className="border-t border-border pt-2">
                <p className="text-xs font-semibold text-muted-foreground">{textoAlergia}</p>
                <div className="mt-1 flex gap-4 text-sm">
                  <label className="flex items-center gap-1.5"><input type="radio" disabled /> No</label>
                  <label className="flex items-center gap-1.5"><input type="radio" disabled /> Sí</label>
                </div>
              </div>
            </div>
          }
          editor={
            <div className="space-y-3">
              <EField label="Texto del consentimiento">
                <textarea rows={4} value={textoConsentimiento} onChange={(e) => setTextoConsentimiento(e.target.value)} className="input-base resize-y" placeholder="El padre/madre o tutor autoriza la participación del menor…" />
              </EField>
              <EField label="Pregunta de alergias">
                <input type="text" value={textoAlergia} onChange={(e) => setTextoAlergia(e.target.value)} className="input-base" placeholder="¿Tiene algún tipo de alergia a los ingredientes del producto?" />
              </EField>
            </div>
          }
        />

        {/* ═══ CONSENTIMIENTO FORMAL ═══ */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50">
                <FileText className="h-4 w-4 text-saboreo-blue" />
              </div>
              <div>
                <p className="font-semibold">Consentimiento informado formal</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Si está activo, el participante deberá completar un formulario de consentimiento antes de tomar la encuesta.
                </p>
              </div>
            </div>
            {/* Toggle */}
            <button
              onClick={() => setUsarConsentimiento((v) => !v)}
              className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${usarConsentimiento ? "bg-saboreo-green" : "bg-muted-foreground/30"}`}
            >
              <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${usarConsentimiento ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          {usarConsentimiento && (
            <div className="mt-4 space-y-3">
              {listaConsentimientos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-center">
                  <p className="text-sm text-muted-foreground">No tienes consentimientos creados aún.</p>
                  <button
                    onClick={() => navigate({ to: "/consentimientos" })}
                    className="mt-2 flex items-center gap-1 mx-auto text-sm font-semibold text-saboreo-blue hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Crear consentimiento
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seleccionar consentimiento</p>
                  {listaConsentimientos.map((c) => (
                    <label
                      key={c.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${consentimientoId === c.id ? "border-saboreo-blue bg-blue-50/50" : "border-border hover:border-muted-foreground/40"}`}
                    >
                      <input type="radio" name="consentimiento_id" value={c.id}
                        checked={consentimientoId === c.id}
                        onChange={() => setConsentimientoId(c.id)}
                        className="mt-0.5 accent-saboreo-blue" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{c.titulo}</p>
                        {c.titulo_investigacion && (
                          <p className="text-xs text-muted-foreground truncate">{c.titulo_investigacion}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); navigate({ to: "/consentimientos/$id/edit", params: { id: c.id } }); }}
                        className="shrink-0 grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                        title="Editar este consentimiento"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </label>
                  ))}
                  <button
                    onClick={() => navigate({ to: "/consentimientos" })}
                    className="flex items-center gap-1 text-xs font-semibold text-saboreo-blue hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Crear nuevo consentimiento
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ DATOS PARTICIPANTE ═══ */}
        <SeccionEditable
          titulo="2. Datos del participante"
          activa={seccionActiva === "participante"}
          onToggle={() => toggleSeccion("participante")}
          preview={
            <div className="grid gap-3 sm:grid-cols-2">
              {camposParticipante.filter((c) => c.activo).map((c) => (
                <div key={c.key} className="space-y-1 opacity-70">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {c.label}{c.requerido ? " *" : ""}
                  </p>
                  <div className="input-base h-9 bg-muted/20" />
                </div>
              ))}
              {camposParticipante.filter((c) => c.activo).length === 0 && (
                <p className="col-span-2 text-sm italic text-muted-foreground">Sin campos activos</p>
              )}
            </div>
          }
          editor={<EditorCampos campos={camposParticipante} onChange={setCamposParticipante} />}
        />

        {/* ═══ EVALUACIÓN DE MUESTRAS ═══ */}
        <SeccionEditable
          titulo={`3. Evaluación de muestras — ${atributos.join(", ")}`}
          activa={seccionActiva === "muestras"}
          onToggle={() => toggleSeccion("muestras")}
          preview={
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Escala: 1 = Me disgusta · 5 = Me gusta mucho</p>
              {/* Leyenda */}
              <div className="flex justify-between rounded-xl bg-muted/40 px-3 py-2">
                {ESCALA_EMOJIS.map((e, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <span className="text-lg leading-none">{e}</span>
                    <span className="text-[10px] font-bold">{i + 1}</span>
                  </div>
                ))}
              </div>
              {/* Primeras 3 muestras */}
              {Array.from({ length: Math.min(3, numMuestras) }, (_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-3 opacity-70">
                  <p className="mb-2 text-xs font-bold">Muestra {i + 1}</p>
                  {atributos.map((a) => (
                    <div key={a} className="mb-1 flex items-center gap-2">
                      <span className="w-20 text-xs text-muted-foreground">{a}</span>
                      <div className="flex gap-1">
                        {ESCALA_EMOJIS.map((e, j) => (
                          <div key={j} className="flex h-8 w-8 flex-col items-center justify-center rounded-lg border border-border bg-muted/20 text-sm">{e}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="mt-2 h-7 rounded-lg border border-border bg-muted/20 px-2 text-xs text-muted-foreground flex items-center">Observaciones (opcional)</div>
                </div>
              ))}
              {numMuestras > 3 && <p className="text-center text-xs text-muted-foreground">… y {numMuestras - 3} muestra{numMuestras - 3 !== 1 ? "s" : ""} más</p>}
            </div>
          }
          editor={
            <div className="space-y-4">
              <EField label="Número de muestras">
                <input type="number" min={1} max={30} value={numMuestras} onChange={(e) => setNumMuestras(parseInt(e.target.value) || 1)} className="input-base w-32" />
              </EField>

              {/* Toggle video */}
              <div className="flex items-start gap-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saboreo-blue/10">
                  <Video className="h-5 w-5 text-saboreo-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Grabación de video por muestra</p>
                  <p className="text-xs text-muted-foreground mt-0.5">El participante debe grabar video antes de calificar cada muestra. Claude Vision analiza sus expresiones faciales.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRequiereVideo((v) => !v)}
                  className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
                    requiereVideo ? 'bg-saboreo-blue' : 'bg-muted-foreground/30'
                  }`}
                  role="switch"
                  aria-checked={requiereVideo}
                >
                  <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    requiereVideo ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Atributos a evaluar</p>
                {atributos.map((a) => (
                  <div key={a} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <span className="flex-1 text-sm font-semibold">{a}</span>
                    <button
                      onClick={() => {
                        if (atributos.length === 1) { toast.error("Debe haber al menos un atributo"); return; }
                        setAtributos((p) => p.filter((x) => x !== a));
                      }}
                      className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text" value={nuevoAtributo}
                    onChange={(e) => setNuevoAtributo(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") { const v = nuevoAtributo.trim(); if (v && !atributos.includes(v) && atributos.length < 10) { setAtributos((p) => [...p, v]); setNuevoAtributo(""); } } }}
                    placeholder="Nuevo: TEXTURA, AROMA, COLOR…"
                    className="input-base flex-1 text-sm"
                  />
                  <button
                    onClick={() => { const v = nuevoAtributo.trim(); if (v && !atributos.includes(v) && atributos.length < 10) { setAtributos((p) => [...p, v]); setNuevoAtributo(""); } }}
                    className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-accent"
                  >
                    <Plus className="h-4 w-4" /> Agregar
                  </button>
                </div>
              </div>

              {atributos.length > 1 && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{numMuestras} muestras × {atributos.length} atributos = <strong>{numMuestras * atributos.length} calificaciones</strong></p>
                </div>
              )}
            </div>
          }
        />

        {/* ═══ PREGUNTAS ADICIONALES ═══ */}
        <div className={`overflow-hidden rounded-2xl border bg-card shadow-card ${estaOculta("preguntas") ? "border-dashed border-border opacity-60" : "border-border"}`}>
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold">4. Preguntas adicionales</p>
                {estaOculta("preguntas") && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <EyeOff className="h-3 w-3" /> Oculta
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Aparecen al final del formulario · {preguntas.length} pregunta{preguntas.length !== 1 ? "s" : ""}</p>
            </div>
            <button
              onClick={() => toggleOcultar("preguntas")}
              title={estaOculta("preguntas") ? "Mostrar esta sección a los participantes" : "Ocultar esta sección a los participantes"}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
            >
              {estaOculta("preguntas") ? <><Eye className="h-3.5 w-3.5" /> Mostrar</> : <><EyeOff className="h-3.5 w-3.5" /> Ocultar</>}
            </button>
          </div>

          {!estaOculta("preguntas") && (
          <div className="p-5 space-y-3">
            {preguntas.length === 0 && (
              <p className="text-center text-sm italic text-muted-foreground py-4">Sin preguntas adicionales — agrega una abajo</p>
            )}

            {preguntas.map((q, idx) => (
              <TarjetaPregunta
                key={q.id}
                pregunta={q}
                idx={idx}
                total={preguntas.length}
                editando={editandoPreguntaId === q.id}
                onToggleEdit={() => setEditandoPreguntaId(editandoPreguntaId === q.id ? null : q.id)}
                onUpdate={(c) => updatePregunta(q.id, c)}
                onDelete={() => { setPreguntas((p) => p.filter((x) => x.id !== q.id)); if (editandoPreguntaId === q.id) setEditandoPreguntaId(null); }}
                onMover={(d) => moverPregunta(q.id, d)}
              />
            ))}

            {/* Botón agregar */}
            <div>
              <button
                onClick={() => setShowTipoMenu((v) => !v)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
              >
                <Plus className="h-4 w-4" /> Agregar pregunta
              </button>
              {showTipoMenu && (
                <div className="mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                  {([
                    ["si_no",          "Sí / No",          "Respuesta binaria"],
                    ["texto",          "Respuesta libre",  "Texto abierto"],
                    ["escala",         "Escala numérica",  "Calificación de 1 a N"],
                    ["opcion_multiple","Opción múltiple",  "Seleccionar una opción"],
                  ] as [TipoPregunta, string, string][]).map(([tipo, label, desc]) => (
                    <button key={tipo} onClick={() => agregarPregunta(tipo)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent">
                      <div>
                        <p className="text-sm font-semibold">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* ═══ Botones finales ═══ */}
        <div className="flex gap-3 pb-8">
          <button onClick={() => navigate({ to: "/encuestas" })} className="flex-1 rounded-full border border-border py-3 text-sm font-semibold hover:bg-accent">Cancelar</button>
          <button onClick={guardar} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-bold text-background hover:opacity-90 disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}

// ── Editor de campos del participante ────────────────────────────────────────

function EditorCampos({ campos, onChange }: {
  campos: CampoParticipante[];
  onChange: React.Dispatch<React.SetStateAction<CampoParticipante[]>>;
}) {
  const [nuevoLabel, setNuevoLabel] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<CampoParticipante["tipo"]>("texto");
  const [editandoOpcKey, setEditandoOpcKey] = useState<string | null>(null);
  const [nuevaOpcion, setNuevaOpcion] = useState("");

  function set(key: string, cambios: Partial<CampoParticipante>) {
    onChange((p) => p.map((c) => c.key === key ? { ...c, ...cambios } : c));
  }

  function mover(key: string, dir: -1 | 1) {
    onChange((prev) => {
      const idx = prev.findIndex((c) => c.key === key);
      const ni = idx + dir;
      if (ni < 0 || ni >= prev.length) return prev;
      const a = [...prev]; [a[idx], a[ni]] = [a[ni], a[idx]]; return a;
    });
  }

  function eliminar(key: string) {
    onChange((p) => p.filter((c) => c.key !== key));
  }

  function agregar() {
    const label = nuevoLabel.trim();
    if (!label) { toast.error("Escribe el nombre del campo"); return; }
    const key = `campo_${uid()}`;
    const nuevo: CampoParticipante = {
      key, label, tipo: nuevoTipo, activo: true, requerido: false,
      ...(nuevoTipo === "select" ? { opciones: ["Opción 1"] } : {}),
    };
    onChange((p) => [...p, nuevo]);
    setNuevoLabel("");
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Activa/desactiva campos, marca cuáles son requeridos, agrega o elimina campos personalizados.</p>

      {/* Tabla de campos */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="w-6 px-2 py-2" />
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campo</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo</th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activo</th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Req.</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {campos.map((c, idx) => (
              <>
                <tr key={c.key} className={!c.activo ? "opacity-40" : ""}>
                  {/* Orden */}
                  <td className="px-2 py-2">
                    <div className="flex flex-col">
                      <button onClick={() => mover(c.key, -1)} disabled={idx === 0} className="grid h-5 w-5 place-items-center rounded hover:bg-muted disabled:opacity-20"><ChevronUp className="h-3 w-3" /></button>
                      <button onClick={() => mover(c.key, 1)} disabled={idx === campos.length - 1} className="grid h-5 w-5 place-items-center rounded hover:bg-muted disabled:opacity-20"><ChevronDown className="h-3 w-3" /></button>
                    </div>
                  </td>
                  {/* Label editable */}
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={c.label}
                      onChange={(e) => set(c.key, { label: e.target.value })}
                      className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium hover:border-border focus:border-border focus:outline-none"
                    />
                  </td>
                  {/* Tipo */}
                  <td className="px-3 py-2">
                    <select
                      value={c.tipo}
                      onChange={(e) => {
                        const t = e.target.value as CampoParticipante["tipo"];
                        set(c.key, { tipo: t, ...(t === "select" && !c.opciones?.length ? { opciones: ["Opción 1"] } : {}) });
                      }}
                      className="rounded-lg border border-border bg-card px-2 py-1 text-xs"
                    >
                      <option value="texto">Texto</option>
                      <option value="numero">Número</option>
                      <option value="select">Selección</option>
                    </select>
                  </td>
                  {/* Activo */}
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox" checked={c.activo}
                      onChange={(e) => set(c.key, { activo: e.target.checked, requerido: e.target.checked ? c.requerido : false })}
                      className="h-4 w-4 accent-saboreo-blue"
                    />
                  </td>
                  {/* Requerido */}
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox" checked={c.requerido} disabled={!c.activo}
                      onChange={(e) => set(c.key, { requerido: e.target.checked })}
                      className="h-4 w-4 accent-saboreo-blue disabled:opacity-30"
                    />
                  </td>
                  {/* Acciones */}
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      {c.tipo === "select" && (
                        <button
                          onClick={() => setEditandoOpcKey(editandoOpcKey === c.key ? null : c.key)}
                          className={`grid h-6 w-6 place-items-center rounded text-xs font-bold transition-colors ${editandoOpcKey === c.key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}
                          title="Editar opciones"
                        >
                          ⋯
                        </button>
                      )}
                      <button onClick={() => eliminar(c.key)} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
                {/* Editor de opciones para tipo select */}
                {c.tipo === "select" && editandoOpcKey === c.key && (
                  <tr key={`${c.key}-opts`}>
                    <td colSpan={6} className="bg-muted/20 px-4 pb-3 pt-2">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">Opciones del campo "{c.label}":</p>
                      <div className="space-y-1">
                        {(c.opciones ?? []).map((op, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              type="text" value={op}
                              onChange={(e) => {
                                const ops = [...(c.opciones ?? [])];
                                ops[i] = e.target.value;
                                set(c.key, { opciones: ops });
                              }}
                              className="input-base flex-1 text-xs"
                            />
                            <button onClick={() => set(c.key, { opciones: (c.opciones ?? []).filter((_, j) => j !== i) })} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-1">
                          <input
                            type="text" value={nuevaOpcion}
                            onChange={(e) => setNuevaOpcion(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && nuevaOpcion.trim()) { set(c.key, { opciones: [...(c.opciones ?? []), nuevaOpcion.trim()] }); setNuevaOpcion(""); } }}
                            placeholder="Nueva opción…"
                            className="input-base flex-1 text-xs"
                          />
                          <button onClick={() => { if (nuevaOpcion.trim()) { set(c.key, { opciones: [...(c.opciones ?? []), nuevaOpcion.trim()] }); setNuevaOpcion(""); } }} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-accent">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Agregar nuevo campo */}
      <div className="flex gap-2">
        <input
          type="text" value={nuevoLabel}
          onChange={(e) => setNuevoLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && agregar()}
          placeholder="Nombre del nuevo campo…"
          className="input-base flex-1 text-sm"
        />
        <select value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value as CampoParticipante["tipo"])} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
          <option value="texto">Texto</option>
          <option value="numero">Número</option>
          <option value="select">Selección</option>
        </select>
        <button onClick={agregar} className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-accent whitespace-nowrap">
          <Plus className="h-4 w-4" /> Agregar
        </button>
      </div>
    </div>
  );
}

// ── Sección editable genérica ─────────────────────────────────────────────────

function SeccionEditable({ titulo, activa, onToggle, preview, editor, oculta, onToggleOcultar }: {
  titulo: string; activa: boolean; onToggle: () => void;
  preview: React.ReactNode; editor: React.ReactNode;
  oculta?: boolean; onToggleOcultar?: () => void;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border bg-card shadow-card transition-all ${oculta ? "border-dashed border-border opacity-60" : activa ? "border-foreground/30" : "border-border"}`}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-bold">{titulo}</p>
          {oculta && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <EyeOff className="h-3 w-3" /> Oculta
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onToggleOcultar && (
            <button
              onClick={onToggleOcultar}
              title={oculta ? "Mostrar esta sección a los participantes" : "Ocultar esta sección a los participantes"}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
            >
              {oculta ? <><Eye className="h-3.5 w-3.5" /> Mostrar</> : <><EyeOff className="h-3.5 w-3.5" /> Ocultar</>}
            </button>
          )}
          {!oculta && (
            <button
              onClick={onToggle}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${activa ? "bg-foreground text-background" : "border border-border hover:bg-accent text-muted-foreground"}`}
            >
              {activa ? <><Check className="h-3.5 w-3.5" /> Listo</> : <><Pencil className="h-3.5 w-3.5" /> Editar</>}
            </button>
          )}
        </div>
      </div>

      {/* Preview (oculto cuando la sección está oculta a participantes) */}
      {!oculta && (
        <div className={`p-5 transition-opacity ${activa ? "opacity-40" : "opacity-100"}`}>
          {preview}
        </div>
      )}

      {/* Editor (visible solo cuando activo) */}
      {activa && !oculta && (
        <div className="border-t border-border bg-muted/20 p-5 space-y-3">
          {editor}
        </div>
      )}
    </div>
  );
}

// ── Tarjeta de pregunta ───────────────────────────────────────────────────────

function TarjetaPregunta({ pregunta: q, idx, total, editando, onToggleEdit, onUpdate, onDelete, onMover }: {
  pregunta: Pregunta; idx: number; total: number; editando: boolean;
  onToggleEdit: () => void; onUpdate: (c: Partial<Pregunta>) => void;
  onDelete: () => void; onMover: (d: -1|1) => void;
}) {
  const [nuevaOpcion, setNuevaOpcion] = useState("");

  const TIPO_LABELS: Record<TipoPregunta, string> = {
    escala: "Escala numérica", texto: "Respuesta libre",
    si_no: "Sí / No", opcion_multiple: "Opción múltiple",
  };

  // Preview de la pregunta según tipo
  const previewRespuesta = () => {
    if (q.tipo === "si_no") return (
      <div className="mt-2 flex gap-3">
        {["Sí", "No"].map((o) => (
          <label key={o} className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input type="radio" disabled className="h-3.5 w-3.5" /> {o}
          </label>
        ))}
      </div>
    );
    if (q.tipo === "texto") return <div className="mt-2 h-8 rounded-lg border border-border bg-muted/20 px-2 text-xs text-muted-foreground flex items-center">Texto libre…</div>;
    if (q.tipo === "escala") return (
      <div className="mt-2 flex items-center gap-2">
        {q.etiqueta_min && <span className="text-xs text-muted-foreground">{q.etiqueta_min}</span>}
        <div className="flex gap-1">
          {Array.from({ length: (q.escala_max ?? 5) - (q.escala_min ?? 1) + 1 }, (_, i) => (
            <div key={i} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-muted/20 text-[11px] font-bold text-muted-foreground">
              {(q.escala_min ?? 1) + i}
            </div>
          ))}
        </div>
        {q.etiqueta_max && <span className="text-xs text-muted-foreground">{q.etiqueta_max}</span>}
      </div>
    );
    if (q.tipo === "opcion_multiple") return (
      <div className="mt-2 space-y-1">
        {(q.opciones ?? []).map((op, i) => (
          <label key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="radio" disabled className="h-3.5 w-3.5" /> {op}
          </label>
        ))}
      </div>
    );
  };

  return (
    <div className={`rounded-xl border bg-card transition-all ${editando ? "border-foreground/30 shadow-sm" : "border-border"}`}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">{idx + 1}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${!q.texto ? "italic text-muted-foreground" : ""}`}>
            {q.texto || "Escribe la pregunta…"}
            {q.requerida && <span className="ml-1 text-red-500">*</span>}
          </p>
          <p className="text-xs text-muted-foreground">{TIPO_LABELS[q.tipo]}</p>
          {!editando && previewRespuesta()}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => onMover(-1)} disabled={idx === 0} className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
          <button onClick={() => onMover(1)} disabled={idx === total - 1} className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
          <button onClick={onToggleEdit} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${editando ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:bg-accent"}`}>
            {editando ? <><Check className="h-3 w-3" /> Listo</> : <><Pencil className="h-3 w-3" /> Editar</>}
          </button>
          <button onClick={onDelete} className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Editor inline */}
      {editando && (
        <div className="space-y-3 border-t border-border bg-muted/20 p-4">
          <EField label="Texto de la pregunta *">
            <textarea rows={2} value={q.texto} onChange={(e) => onUpdate({ texto: e.target.value })} className="input-base resize-none" placeholder="Escribe la pregunta…" autoFocus />
          </EField>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={q.requerida} onChange={(e) => onUpdate({ requerida: e.target.checked })} className="h-4 w-4 accent-saboreo-blue" />
            <span className="font-medium">Respuesta requerida</span>
          </label>

          {q.tipo === "escala" && (
            <div className="grid grid-cols-2 gap-3">
              <EField label="Valor mínimo"><input type="number" value={q.escala_min ?? 1} onChange={(e) => onUpdate({ escala_min: parseInt(e.target.value) })} className="input-base" /></EField>
              <EField label="Valor máximo"><input type="number" value={q.escala_max ?? 5} onChange={(e) => onUpdate({ escala_max: parseInt(e.target.value) })} className="input-base" /></EField>
              <EField label="Etiqueta mínimo"><input type="text" value={q.etiqueta_min ?? ""} onChange={(e) => onUpdate({ etiqueta_min: e.target.value })} className="input-base" placeholder="Muy malo" /></EField>
              <EField label="Etiqueta máximo"><input type="text" value={q.etiqueta_max ?? ""} onChange={(e) => onUpdate({ etiqueta_max: e.target.value })} className="input-base" placeholder="Excelente" /></EField>
            </div>
          )}

          {q.tipo === "opcion_multiple" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opciones</p>
              {(q.opciones ?? []).map((op, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" disabled className="h-3.5 w-3.5 shrink-0" />
                  <input type="text" value={op} onChange={(e) => { const o = [...(q.opciones ?? [])]; o[i] = e.target.value; onUpdate({ opciones: o }); }} className="input-base flex-1 text-sm" />
                  <button onClick={() => onUpdate({ opciones: (q.opciones ?? []).filter((_, j) => j !== i) })} className="grid h-7 w-7 place-items-center rounded-full hover:bg-red-50 hover:text-red-600 text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <input type="text" value={nuevaOpcion} onChange={(e) => setNuevaOpcion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && nuevaOpcion.trim()) { onUpdate({ opciones: [...(q.opciones ?? []), nuevaOpcion.trim()] }); setNuevaOpcion(""); } }} placeholder="Nueva opción…" className="input-base flex-1 text-sm" />
                <button onClick={() => { if (nuevaOpcion.trim()) { onUpdate({ opciones: [...(q.opciones ?? []), nuevaOpcion.trim()] }); setNuevaOpcion(""); } }} className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-accent"><Plus className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
