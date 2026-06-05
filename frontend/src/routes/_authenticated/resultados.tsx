import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  BarChart2, ChevronRight, CheckCircle2, Clock, Archive, RefreshCw, ClipboardCheck,
} from "lucide-react";
import { AppLayout } from "@/components/saboreo/AppLayout";
import { apiFetch } from "@/integrations/api/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/resultados")({
  head: () => ({ meta: [{ title: "Resultados — SABOREO" }] }),
  component: ResultadosPage,
});

interface EncuestaResumen {
  id: string;
  titulo: string;
  producto: string;
  estado: string;
  num_muestras: number;
  total_respuestas: number;
  promedio_escala: number | null;
}

const ESTADO_ICON: Record<string, typeof CheckCircle2> = {
  activa: CheckCircle2, borrador: Clock, cerrada: Archive,
};
const ESTADO_COLOR: Record<string, string> = {
  activa: "bg-green-100 text-green-800",
  borrador: "bg-amber-100 text-amber-800",
  cerrada: "bg-muted text-muted-foreground",
};

function ResultadosPage() {
  const [encuestas, setEncuestas] = useState<EncuestaResumen[] | null>(null);
  const [loading, setLoading] = useState(true);

  async function cargar() {
    setLoading(true);
    try {
      const d = await apiFetch<{ por_encuesta: EncuestaResumen[] }>("/api/dashboard");
      setEncuestas(d.por_encuesta);
    } catch {
      toast.error("Error al cargar los resultados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  return (
    <AppLayout
      title="Resultados"
      subtitle="Análisis detallado de cada encuesta"
      actions={
        <button
          onClick={cargar}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Actualizar</span>
        </button>
      }
    >
      <div className="mx-auto max-w-[1400px]">
        {loading && (
          <div className="flex h-40 items-center justify-center gap-3 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" /> Cargando resultados…
          </div>
        )}

        {!loading && encuestas && encuestas.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="font-semibold text-muted-foreground">Aún no hay encuestas</p>
            <p className="mt-1 text-sm text-muted-foreground/70">Crea una encuesta para ver sus resultados aquí.</p>
            <Link
              to="/encuestas"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background hover:opacity-90"
            >
              Ir a Encuestas <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {!loading && encuestas && encuestas.length > 0 && (
          <section className="rounded-2xl border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="font-display text-lg font-bold">Resultados por encuesta</h2>
                <p className="text-xs text-muted-foreground">Haz clic en una encuesta para ver el análisis detallado</p>
              </div>
              <Link to="/encuestas" className="text-xs font-semibold text-saboreo-blue hover:underline">Gestionar</Link>
            </div>
            <div className="divide-y divide-border">
              {encuestas.map((e) => {
                const EIcon = ESTADO_ICON[e.estado] ?? Clock;
                const prom = e.promedio_escala;
                return (
                  <Link
                    key={e.id}
                    to="/encuestas/$id/resultados"
                    params={{ id: e.id }}
                    className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-accent/40"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-warm shadow-soft">
                      <BarChart2 className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-semibold">{e.titulo}</p>
                      <p className="truncate text-xs text-muted-foreground">{e.producto}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO_COLOR[e.estado]}`}>
                          <EIcon className="h-3 w-3" />{e.estado}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{e.total_respuestas} respuesta{e.total_respuestas !== 1 ? "s" : ""}</span>
                        {e.num_muestras > 1 && <span className="text-[11px] text-muted-foreground">{e.num_muestras} muestras</span>}
                      </div>
                    </div>
                    {prom && (
                      <div className="shrink-0 text-right">
                        <p className="font-num text-2xl font-black">{prom}</p>
                        <p className="text-[11px] text-muted-foreground">prom /5</p>
                      </div>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
