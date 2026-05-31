import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Save, ArrowLeft, Plus, Trash2, GripVertical, Eye,
  Users, FlaskConical, FileText, Phone, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/integrations/api/client";
import { AppLayout } from "@/components/saboreo/AppLayout";

export const Route = createFileRoute("/_authenticated/consentimientos_/$id/edit")({
  head: () => ({ meta: [{ title: "Editar consentimiento — SABOREO" }] }),
  component: EditConsentimientoPage,
});

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Investigador { nombre: string; email: string; tel: string }
interface Ingrediente  { ingrediente: string; marca: string; porcentaje: string }

interface ConsentimientoForm {
  titulo: string;
  titulo_investigacion: string;
  investigadores: Investigador[];
  texto_intro: string;
  ingredientes: Ingrediente[];
  tiene_pregunta_alergia: boolean;
  texto_alergia: string;
  parrafos: string[];
  texto_contacto: string;
}

const DEFAULT: ConsentimientoForm = {
  titulo: "",
  titulo_investigacion: "",
  investigadores: [],
  texto_intro: "",
  ingredientes: [],
  tiene_pregunta_alergia: true,
  texto_alergia: "¿Tiene algún tipo de alergia a los ingredientes del producto que probará en el ensayo?",
  parrafos: [],
  texto_contacto: "",
};

// ── Componente principal ──────────────────────────────────────────────────────

function EditConsentimientoPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState<ConsentimientoForm>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    apiFetch<ConsentimientoForm & { id: string }>(`/api/consentimientos/${id}`)
      .then((data) => {
        setForm({
          titulo:                data.titulo ?? "",
          titulo_investigacion:  data.titulo_investigacion ?? "",
          investigadores:        Array.isArray(data.investigadores) ? data.investigadores.map((i) => ({ nombre: i.nombre ?? "", email: (i as any).email ?? "", tel: (i as any).tel ?? "" })) : [],
          texto_intro:           data.texto_intro ?? "",
          ingredientes:          Array.isArray(data.ingredientes) ? data.ingredientes.map((i) => ({ ingrediente: i.ingrediente ?? "", marca: (i as any).marca ?? "", porcentaje: (i as any).porcentaje ?? "" })) : [],
          tiene_pregunta_alergia: data.tiene_pregunta_alergia ?? true,
          texto_alergia:         data.texto_alergia ?? DEFAULT.texto_alergia,
          parrafos:              Array.isArray(data.parrafos) ? data.parrafos : [],
          texto_contacto:        data.texto_contacto ?? "",
        });
      })
      .catch(() => toast.error("Error al cargar el consentimiento"))
      .finally(() => setLoading(false));
  }, [id]);

  function set<K extends keyof ConsentimientoForm>(k: K, v: ConsentimientoForm[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function guardar() {
    if (!form.titulo.trim()) { toast.error("El nombre es requerido"); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/consentimientos/${id}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      toast.success("Consentimiento guardado");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  if (loading) return (
    <AppLayout title="Cargando…">
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">Cargando…</div>
    </AppLayout>
  );

  return (
    <AppLayout
      title={form.titulo || "Editor de consentimiento"}
      subtitle="Edita el contenido del formulario de consentimiento informado"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreview((p) => !p)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${preview ? "border-saboreo-blue bg-saboreo-blue/10 text-saboreo-blue" : "border-border bg-card text-muted-foreground hover:border-saboreo-blue hover:text-saboreo-blue"}`}
          >
            <Eye className="h-4 w-4" /> {preview ? "Ocultar preview" : "Vista previa"}
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background hover:opacity-90 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar"}
          </button>
          <button
            onClick={() => navigate({ to: "/consentimientos" })}
            className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className={`grid gap-6 ${preview ? "lg:grid-cols-2" : ""}`}>
        {/* EDITOR */}
        <div className="space-y-5">
          {/* Nombre interno */}
          <Card icon={<FileText className="h-4 w-4" />} titulo="Identificación">
            <Field label="Nombre interno *">
              <input type="text" value={form.titulo} onChange={(e) => set("titulo", e.target.value)}
                placeholder="Ej. Proyecto Orquídeas" className="input-base" />
            </Field>
            <Field label="Título oficial de la investigación">
              <textarea rows={2} value={form.titulo_investigacion}
                onChange={(e) => set("titulo_investigacion", e.target.value)}
                placeholder="Ej. Diseño de un producto proteico enriquecido con subproductos de cacao…"
                className="input-base resize-none" />
            </Field>
          </Card>

          {/* Investigadores */}
          <Card icon={<Users className="h-4 w-4" />} titulo="Investigadores">
            <div className="space-y-3">
              {form.investigadores.map((inv, idx) => (
                <div key={idx} className="group relative rounded-xl border border-border bg-muted/20 p-3">
                  <button
                    onClick={() => set("investigadores", form.investigadores.filter((_, i) => i !== idx))}
                    className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <div className="grid gap-2 sm:grid-cols-3 pr-6">
                    <input type="text" placeholder="Nombre completo" value={inv.nombre}
                      onChange={(e) => set("investigadores", form.investigadores.map((x, i) => i === idx ? { ...x, nombre: e.target.value } : x))}
                      className="input-base text-sm" />
                    <input type="email" placeholder="Correo electrónico" value={inv.email}
                      onChange={(e) => set("investigadores", form.investigadores.map((x, i) => i === idx ? { ...x, email: e.target.value } : x))}
                      className="input-base text-sm" />
                    <input type="text" placeholder="Teléfono" value={inv.tel}
                      onChange={(e) => set("investigadores", form.investigadores.map((x, i) => i === idx ? { ...x, tel: e.target.value } : x))}
                      className="input-base text-sm" />
                  </div>
                </div>
              ))}
              <button
                onClick={() => set("investigadores", [...form.investigadores, { nombre: "", email: "", tel: "" }])}
                className="flex items-center gap-2 text-sm font-semibold text-saboreo-blue hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar investigador
              </button>
            </div>
          </Card>

          {/* Texto de introducción */}
          <Card icon={<FileText className="h-4 w-4" />} titulo="Texto de introducción">
            <textarea rows={4} value={form.texto_intro}
              onChange={(e) => set("texto_intro", e.target.value)}
              placeholder="El propósito de este consentimiento informado es proveer a los participantes una clara explicación…"
              className="input-base resize-none" />
          </Card>

          {/* Ingredientes */}
          <Card icon={<FlaskConical className="h-4 w-4" />} titulo="Tabla de ingredientes">
            {form.ingredientes.length > 0 && (
              <div className="mb-3 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Ingrediente</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Marca</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Porcentaje</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {form.ingredientes.map((ing, idx) => (
                      <tr key={idx} className="group">
                        <td className="px-3 py-1.5">
                          <input type="text" value={ing.ingrediente} placeholder="Ingrediente"
                            onChange={(e) => set("ingredientes", form.ingredientes.map((x, i) => i === idx ? { ...x, ingrediente: e.target.value } : x))}
                            className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm focus:border-border focus:bg-white focus:outline-none" />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="text" value={ing.marca} placeholder="Marca"
                            onChange={(e) => set("ingredientes", form.ingredientes.map((x, i) => i === idx ? { ...x, marca: e.target.value } : x))}
                            className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm focus:border-border focus:bg-white focus:outline-none" />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="text" value={ing.porcentaje} placeholder="20-30%"
                            onChange={(e) => set("ingredientes", form.ingredientes.map((x, i) => i === idx ? { ...x, porcentaje: e.target.value } : x))}
                            className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm focus:border-border focus:bg-white focus:outline-none" />
                        </td>
                        <td className="px-2">
                          <button
                            onClick={() => set("ingredientes", form.ingredientes.filter((_, i) => i !== idx))}
                            className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button
              onClick={() => set("ingredientes", [...form.ingredientes, { ingrediente: "", marca: "", porcentaje: "" }])}
              className="flex items-center gap-2 text-sm font-semibold text-saboreo-blue hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar ingrediente
            </button>
          </Card>

          {/* Pregunta de alergia */}
          <Card icon={<FileText className="h-4 w-4" />} titulo="Pregunta de alergia">
            <label className="mb-3 flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={form.tiene_pregunta_alergia}
                onChange={(e) => set("tiene_pregunta_alergia", e.target.checked)}
                className="h-4 w-4 accent-saboreo-blue" />
              <span className="text-sm font-medium">Incluir pregunta de alergia</span>
            </label>
            {form.tiene_pregunta_alergia && (
              <input type="text" value={form.texto_alergia}
                onChange={(e) => set("texto_alergia", e.target.value)}
                className="input-base" />
            )}
          </Card>

          {/* Párrafos del cuerpo */}
          <Card icon={<FileText className="h-4 w-4" />} titulo="Cuerpo del documento">
            <p className="mb-3 text-xs text-muted-foreground">Agrega cada párrafo por separado. Se mostrarán en orden.</p>
            <div className="space-y-2">
              {form.parrafos.map((p, idx) => (
                <div key={idx} className="group flex gap-2">
                  <div className="flex shrink-0 flex-col gap-1 pt-2">
                    <button
                      disabled={idx === 0}
                      onClick={() => {
                        const arr = [...form.parrafos];
                        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                        set("parrafos", arr);
                      }}
                      className="grid h-5 w-5 place-items-center rounded text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground disabled:opacity-20"
                    ><ChevronUp className="h-3 w-3" /></button>
                    <button
                      disabled={idx === form.parrafos.length - 1}
                      onClick={() => {
                        const arr = [...form.parrafos];
                        [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
                        set("parrafos", arr);
                      }}
                      className="grid h-5 w-5 place-items-center rounded text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground disabled:opacity-20"
                    ><ChevronDown className="h-3 w-3" /></button>
                  </div>
                  <textarea rows={2} value={p}
                    onChange={(e) => set("parrafos", form.parrafos.map((x, i) => i === idx ? e.target.value : x))}
                    className="input-base flex-1 resize-none text-sm"
                    placeholder={`Párrafo ${idx + 1}…`} />
                  <button
                    onClick={() => set("parrafos", form.parrafos.filter((_, i) => i !== idx))}
                    className="mt-1 grid h-7 w-7 shrink-0 place-items-center self-start rounded-full text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                  ><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <button
                onClick={() => set("parrafos", [...form.parrafos, ""])}
                className="flex items-center gap-2 text-sm font-semibold text-saboreo-blue hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar párrafo
              </button>
            </div>
          </Card>

          {/* Contacto */}
          <Card icon={<Phone className="h-4 w-4" />} titulo="Información de contacto">
            <textarea rows={3} value={form.texto_contacto}
              onChange={(e) => set("texto_contacto", e.target.value)}
              placeholder={"Diana Paola Navia Porras\nTel: 3175757338\nCorreo: dpnavia@usbcali.edu.co"}
              className="input-base resize-none" />
          </Card>
        </div>

        {/* VISTA PREVIA */}
        {preview && (
          <div className="lg:sticky lg:top-6 lg:self-start">
            <PreviewConsentimiento form={form} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ── Subcomponentes editor ─────────────────────────────────────────────────────

function Card({ icon, titulo, children }: { icon: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
        <span className="text-muted-foreground">{icon}</span> {titulo}
      </div>
      <div className="space-y-3">{children}</div>
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

// ── Vista previa del consentimiento ──────────────────────────────────────────

export function PreviewConsentimiento({ form }: { form: { titulo: string; titulo_investigacion?: string | null; investigadores?: { nombre: string; email?: string; tel?: string }[]; texto_intro?: string | null; ingredientes?: { ingrediente: string; marca?: string; porcentaje?: string }[]; tiene_pregunta_alergia?: boolean; texto_alergia?: string | null; parrafos?: string[]; texto_contacto?: string | null } }) {
  return (
    <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
      {/* Encabezado */}
      <div className="bg-gradient-to-br from-slate-700 to-slate-900 px-6 py-6 text-white">
        <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Consentimiento informado</p>
        {form.titulo_investigacion ? (
          <h2 className="text-base font-bold leading-snug">{form.titulo_investigacion}</h2>
        ) : (
          <h2 className="text-base font-bold opacity-40 italic">Sin título de investigación</h2>
        )}
        {(form.investigadores ?? []).length > 0 && (
          <p className="mt-2 text-xs opacity-70">
            {form.investigadores!.map((i) => [i.nombre, i.email].filter(Boolean).join(" · ")).join(" | ")}
          </p>
        )}
      </div>

      <div className="space-y-4 p-6 text-sm">
        {/* Campos participante */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-400">
            Nombre del participante: ___________
          </div>
          <div className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-400">
            Fecha: ___________
          </div>
        </div>

        {/* Intro */}
        {form.texto_intro && (
          <div>
            <p className="font-semibold text-gray-700 mb-1">Información previa:</p>
            {form.texto_intro.split(/\n\n+/).map((par, i) => (
              <p key={i} className="text-xs leading-relaxed text-gray-500 mb-1 text-justify">{par}</p>
            ))}
          </div>
        )}

        {/* Ingredientes */}
        {(form.ingredientes ?? []).length > 0 && (
          <div>
            <p className="font-semibold text-gray-700 mb-2">Ingredientes/Componentes:</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-200">
                  <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Ingrediente</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Marca</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-gray-600">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.ingredientes!.map((ing, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1">{ing.ingrediente || "—"}</td>
                    <td className="px-2 py-1 text-gray-500">{ing.marca || "—"}</td>
                    <td className="px-2 py-1 text-gray-500">{ing.porcentaje || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pregunta alergia */}
        {form.tiene_pregunta_alergia && form.texto_alergia && (
          <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <span className="font-semibold">Alergia:</span> {form.texto_alergia}{" "}
            <span className="opacity-50">( ) SÍ  ( ) NO</span>
          </div>
        )}

        {/* Párrafos */}
        {(form.parrafos ?? []).map((p, i) => (
          <p key={i} className="text-xs leading-relaxed text-gray-500 text-justify">{p || <span className="italic opacity-40">Párrafo vacío…</span>}</p>
        ))}

        {/* Aceptar */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-center text-xs text-gray-500">
          Pulsando el botón <strong>"Aceptar"</strong> se entiende que está de acuerdo con las condiciones del panel sensorial y confirma su participación.
          <div className="mt-3">
            <span className="rounded-full bg-slate-700 px-6 py-1.5 text-white text-xs font-bold">Aceptar</span>
          </div>
        </div>

        {/* Contacto */}
        {form.texto_contacto && (
          <div>
            <p className="font-semibold text-gray-700 mb-1">Información de contacto:</p>
            {form.texto_contacto.split("\n").map((l, i) => (
              <p key={i} className="text-xs text-gray-500">{l}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
