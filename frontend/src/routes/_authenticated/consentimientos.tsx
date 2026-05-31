import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { FileText, Plus, X, Pencil, Trash2, ChevronRight, Users } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/integrations/api/client";
import { AppLayout } from "@/components/saboreo/AppLayout";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/consentimientos")({
  head: () => ({ meta: [{ title: "Consentimientos — SABOREO" }] }),
  component: ConsentimientosPage,
});

interface Consentimiento {
  id: string;
  titulo: string;
  titulo_investigacion: string | null;
  investigadores: { nombre: string; email?: string; tel?: string }[];
  texto_intro: string | null;
  ingredientes: { ingrediente: string; marca?: string; porcentaje?: string }[];
  tiene_pregunta_alergia: boolean;
  texto_alergia: string | null;
  parrafos: string[];
  texto_contacto: string | null;
  created_at: string;
}

function ConsentimientosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [lista, setLista] = useState<Consentimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [creando, setCreando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { cargarLista(); }, [user]);

  async function cargarLista() {
    setLoading(true);
    try {
      const data = await apiFetch<Consentimiento[]>("/api/consentimientos");
      setLista(data);
    } catch { toast.error("Error al cargar consentimientos"); }
    finally { setLoading(false); }
  }

  async function crear() {
    if (!titulo.trim()) { toast.error("Escribe un nombre para el consentimiento"); return; }
    setSaving(true);
    try {
      const nuevo = await apiFetch<Consentimiento>("/api/consentimientos", {
        method: "POST",
        body: JSON.stringify({ titulo }),
      });
      toast.success("Consentimiento creado");
      navigate({ to: "/consentimientos/$id/edit", params: { id: nuevo.id } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este consentimiento?")) return;
    try {
      await apiFetch(`/api/consentimientos/${id}`, { method: "DELETE" });
      setLista((p) => p.filter((c) => c.id !== id));
      toast.success("Eliminado");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  }

  return (
    <AppLayout
      title="Consentimientos informados"
      subtitle="Crea y gestiona los formularios de consentimiento para tus paneles"
      actions={
        !creando && (
          <button
            onClick={() => setCreando(true)}
            className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Nuevo consentimiento
          </button>
        )
      }
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Formulario creación rápida */}
        {creando && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-bold">Nuevo consentimiento</h2>
              <button onClick={() => setCreando(false)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              Dale un nombre interno para identificarlo (ej. "Proyecto Orquídeas"). Después podrás editar todos los campos.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Nombre del consentimiento…"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && crear()}
                className="input-base flex-1"
                autoFocus
              />
              <button
                onClick={crear}
                disabled={saving}
                className="rounded-full bg-foreground px-5 py-2 text-sm font-bold text-background hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Creando…" : "Crear y editar"}
              </button>
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="rounded-2xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-6 py-4">
            <h2 className="font-display text-base font-bold">Mis consentimientos</h2>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30" />
              <p className="font-semibold text-muted-foreground">No hay consentimientos aún</p>
              <button
                onClick={() => setCreando(true)}
                className="text-sm font-semibold text-saboreo-blue hover:underline"
              >
                Crea el primero
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {lista.map((c) => (
                <li key={c.id} className="group flex items-start gap-4 px-6 py-5 hover:bg-accent/30 transition-colors">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50">
                    <FileText className="h-5 w-5 text-saboreo-blue" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight">{c.titulo}</p>
                    {c.titulo_investigacion && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.titulo_investigacion}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {c.investigadores.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {c.investigadores.length} investigador{c.investigadores.length !== 1 ? "es" : ""}
                        </span>
                      )}
                      {c.ingredientes.length > 0 && (
                        <span>{c.ingredientes.length} ingrediente{c.ingredientes.length !== 1 ? "s" : ""}</span>
                      )}
                      {c.parrafos.length > 0 && (
                        <span>{c.parrafos.length} párrafo{c.parrafos.length !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => navigate({ to: "/consentimientos/$id/edit", params: { id: c.id } })}
                      className="flex items-center gap-1.5 rounded-full bg-saboreo-blue/10 px-3 py-1.5 text-xs font-semibold text-saboreo-blue opacity-0 transition group-hover:opacity-100 hover:bg-saboreo-blue/20"
                    >
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                    <button
                      onClick={() => eliminar(c.id)}
                      className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
