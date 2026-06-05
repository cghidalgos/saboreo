import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  Users, Activity, Smile, ClipboardCheck, ChevronRight,
  ShieldCheck, FlaskConical,
  CheckCircle2, Clock, Archive, RefreshCw,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  Line, ComposedChart, AreaChart, Area, PieChart, Pie, Cell, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { useAuth, ROLE_LABEL } from "@/hooks/use-auth";
import { AppLayout } from "@/components/saboreo/AppLayout";
import { apiFetch } from "@/integrations/api/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SABOREO" }] }),
  component: Dashboard,
});

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  kpis: {
    total_encuestas: number;
    encuestas_activas: number;
    total_respuestas: number;
    total_participantes: number;
    promedio_escala: number | null;
  };
  por_encuesta: {
    id: string; titulo: string; producto: string; estado: string;
    num_muestras: number; total_respuestas: number;
    promedio_escala: number | null; con_alergia: number;
  }[];
  dist_escala: { valor: number; cantidad: number }[];
  por_muestra: { numero_muestra: number; promedio: number }[];
  dist_por_muestra: { numero_muestra: number; calificacion: number; cantidad: number }[];
  dist_genero: { genero: string; cantidad: number }[];
  dist_edad: { edad: number; cantidad: number }[];
  recientes: {
    participante_nombre: string; participante_edad: number;
    participante_genero: string | null; escala_hedonica: number | null;
    tiene_alergia: boolean | null; created_at: string;
    encuesta_titulo: string; encuesta_producto: string;
  }[];
}

// ── Colores ───────────────────────────────────────────────────────────────────

const ESCALA_LABELS = ["", "Me disgusta", "Me disgusta poco", "Ni me gusta ni me disgusta", "Me gusta", "Me gusta mucho"];
const ESCALA_COLORS = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#0ea5e9"];
const ESCALA_EMOJIS = ["", "😢", "😕", "😐", "😊", "😍"];
const GENERO_COLORS: Record<string, string> = {
  niño: "var(--saboreo-sky)", niña: "var(--saboreo-purple)",
  otro: "var(--saboreo-orange)", "no especificado": "var(--border)",
};
// Estilo de los ejes numéricos de los gráficos: misma fuente (Fraunces) que los números de las tarjetas de métricas.
const NUM_TICK = { fontSize: 11, fontFamily: "var(--font-num)", fill: "var(--muted-foreground)" } as const;

function escalaColor(v: number | null) {
  if (!v) return "text-muted-foreground";
  if (v >= 4) return "text-green-600";
  if (v >= 3) return "text-yellow-600";
  return "text-red-600";
}

// Monta su contenido (y dispara la animación del gráfico) cuando entra en pantalla al hacer scroll.
function ChartReveal({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setShown(true); obs.disconnect(); } },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} className={className}>{shown ? children : null}</div>;
}

// ── Componente principal ──────────────────────────────────────────────────────

function Dashboard() {
  const { profile, user, roles, hasRole } = useAuth();
  const displayName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Investigador";

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  async function cargarDatos() {
    setLoading(true);
    try {
      const d = await apiFetch<DashboardData>("/api/dashboard");
      setData(d);
    } catch { toast.error("Error al cargar datos del dashboard"); }
    finally { setLoading(false); }
  }

  useEffect(() => { cargarDatos(); }, []);

  const kpis = data ? [
    { label: "Encuestas",          value: data.kpis.total_encuestas,   icon: ClipboardCheck, grad: "bg-gradient-warm" },
    { label: "Respuestas",         value: data.kpis.total_respuestas,  icon: Activity,       grad: "bg-gradient-cool" },
    { label: "Participantes",      value: data.kpis.total_participantes, icon: Users,         grad: "bg-gradient-fresh" },
    { label: "Encuestas activas",  value: data.kpis.encuestas_activas, icon: CheckCircle2,   grad: "bg-gradient-warm" },
    { label: "Productos",          value: data.kpis.total_encuestas,   icon: FlaskConical,   grad: "bg-gradient-cool" },
    {
      label: "Prom. escala",
      value: data.kpis.promedio_escala ? `${data.kpis.promedio_escala}/5` : "—",
      icon: Smile, grad: "bg-gradient-fresh",
    },
  ] : [];

  const ESTADO_ICON: Record<string, typeof CheckCircle2> = {
    activa: CheckCircle2, borrador: Clock, cerrada: Archive,
  };
  const ESTADO_COLOR: Record<string, string> = {
    activa: "bg-green-100 text-green-800", borrador: "bg-amber-100 text-amber-800", cerrada: "bg-muted text-muted-foreground",
  };

  return (
    <AppLayout
      title="Investigación · Aceptación infantil"
      subtitle="Panel de resultados y análisis sensorial"
      actions={
        <button
          onClick={cargarDatos}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Actualizar</span>
        </button>
      }
    >
      <div className="mx-auto max-w-[1400px] space-y-6">

        {/* Role banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-orange bg-brand-orange/10 px-5 py-3">
          <div className="flex items-center gap-3 text-sm">
            <ShieldCheck className="h-5 w-5 text-brand-orange-deep" />
            <span>Hola <strong>{displayName}</strong> · Acceso como <strong>{roles.length ? roles.map((r: string) => ROLE_LABEL[r as keyof typeof ROLE_LABEL]).join(", ") : "Sin rol"}</strong></span>
          </div>
          {hasRole("admin") && (
            <span className="rounded-full bg-saboreo-purple/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-saboreo-purple">Permisos completos</span>
          )}
        </div>

        {loading && (
          <div className="flex h-40 items-center justify-center gap-3 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" /> Cargando datos…
          </div>
        )}

        {!loading && data && (
          <>
            {/* KPIs */}
            <section className="grid grid-cols-3 gap-2.5 sm:gap-4 lg:grid-cols-6">
              {kpis.map((k) => (
                <div key={k.label} className="rounded-2xl border border-border bg-card p-3 shadow-card sm:p-5">
                  <div className={`grid h-8 w-8 place-items-center rounded-xl ${k.grad} shadow-soft sm:h-10 sm:w-10`}>
                    <k.icon className="h-4 w-4 text-white sm:h-5 sm:w-5" />
                  </div>
                  <p className="mt-2 font-num text-xl font-black tracking-tight sm:mt-4 sm:text-2xl">{k.value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">{k.label}</p>
                </div>
              ))}
            </section>

            {/* Sin datos */}
            {data.kpis.total_respuestas === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="font-semibold text-muted-foreground">Aún no hay respuestas registradas</p>
                <p className="mt-1 text-sm text-muted-foreground/70">Registra la primera respuesta en el módulo de Encuestas.</p>
                <Link to="/encuestas" className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background hover:opacity-90">
                  Ir a Encuestas <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            )}

            {data.kpis.total_respuestas > 0 && (
              <>
                {/* Gráficos fila 1 */}
                <section className="grid gap-4 lg:grid-cols-3">

                  {/* Respuestas por encuesta */}
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                    <h2 className="font-display text-lg font-bold">Respuestas por encuesta</h2>
                    <p className="mb-4 text-xs text-muted-foreground">Total de participantes registrados</p>
                    <div className="h-64">
                      <ResponsiveContainer>
                        <BarChart data={data.por_encuesta.map((e) => ({ name: e.titulo.slice(0, 16) + (e.titulo.length > 16 ? "…" : ""), val: e.total_respuestas }))} layout="vertical" margin={{ left: 4, right: 16 }}>
                          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" tick={NUM_TICK} />
                          <YAxis dataKey="name" type="category" stroke="var(--muted-foreground)" fontSize={10} width={92} />
                          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v: number) => [v, "Respuestas"]} />
                          <Bar dataKey="val" fill="var(--saboreo-sky)" radius={[0, 8, 8, 0]} animationDuration={900} animationEasing="ease-out" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Distribución escala hedónica */}
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                    <h2 className="font-display text-lg font-bold">Escala hedónica</h2>
                    <p className="mb-4 text-xs text-muted-foreground">Distribución de calificaciones globales</p>
                    {data.dist_escala.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground italic">Sin calificaciones de escala única</p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer>
                          <RadarChart outerRadius="72%" data={[1, 2, 3, 4, 5].map((v) => ({ name: `${ESCALA_EMOJIS[v]} ${v}`, val: data.dist_escala.find((d) => d.valor === v)?.cantidad ?? 0 }))}>
                            <PolarGrid stroke="var(--border)" />
                            <PolarAngleAxis dataKey="name" tick={{ fontSize: 13, fill: "var(--muted-foreground)" }} />
                            <PolarRadiusAxis allowDecimals={false} angle={90} stroke="var(--border)" tick={NUM_TICK} />
                            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}
                              formatter={(v: number, _: string, props: { payload?: { name: string } }) => [v, ESCALA_LABELS[parseInt(props.payload?.name?.split(" ")[1] ?? "0")]]} />
                            <Radar dataKey="val" stroke="var(--brand-orange)" fill="var(--brand-orange)" fillOpacity={0.35} strokeWidth={2} animationDuration={900} animationBegin={150} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Distribución género */}
                  {data.dist_genero.length > 0 && (
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                      <h2 className="font-display text-lg font-bold">Participantes por género</h2>
                      <p className="mb-2 text-xs text-muted-foreground">Distribución demográfica</p>
                      <div className="h-64">
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie data={data.dist_genero.map((g) => ({ name: g.genero, value: g.cantidad }))}
                              dataKey="value" innerRadius={45} outerRadius={80} paddingAngle={3} animationDuration={900} animationBegin={300}>
                              {data.dist_genero.map((g) => (
                                <Cell key={g.genero} fill={GENERO_COLORS[g.genero] ?? "var(--border)"} />
                              ))}
                            </Pie>
                            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </section>

                {/* Gráficos fila 2 */}
                <section className="grid gap-4 lg:grid-cols-2">

                  {/* Distribución de calificaciones por muestra (barras apiladas + promedio) */}
                  {data.dist_por_muestra.length > 0 && (
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                      <h2 className="font-display text-lg font-bold">Distribución por muestra</h2>
                      <p className="mb-4 text-xs text-muted-foreground">Respuestas de cada nivel (😢1 … 😍5) · línea = promedio (1–5)</p>
                      <ChartReveal className="h-56">
                        <ResponsiveContainer>
                          <ComposedChart
                            data={[...new Set(data.dist_por_muestra.map((d) => d.numero_muestra))]
                              .sort((a, b) => a - b)
                              .map((nm) => {
                                const row: Record<string, number | string> = { name: `M${nm}` };
                                for (let v = 1; v <= 5; v++) {
                                  row[`c${v}`] = data.dist_por_muestra.find((d) => d.numero_muestra === nm && d.calificacion === v)?.cantidad ?? 0;
                                }
                                row.prom = Number(data.por_muestra.find((m) => m.numero_muestra === nm)?.promedio ?? 0);
                                return row;
                              })}
                          >
                            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                            <YAxis yAxisId="count" allowDecimals={false} stroke="var(--muted-foreground)" tick={NUM_TICK} width={28} />
                            <YAxis yAxisId="rating" orientation="right" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke="var(--saboreo-purple)" tick={NUM_TICK} width={24} />
                            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v: number, name: string) => (name === "Promedio" ? [Number(v).toFixed(2), "Promedio"] : [v, name])} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                            {[1, 2, 3, 4, 5].map((v) => (
                              <Bar key={v} yAxisId="count" dataKey={`c${v}`} stackId="a" fill={ESCALA_COLORS[v]} name={`${ESCALA_EMOJIS[v]}${v}`} radius={v === 5 ? [6, 6, 0, 0] : undefined} animationDuration={700} animationBegin={v * 110} />
                            ))}
                            <Line yAxisId="rating" type="monotone" dataKey="prom" name="Promedio" stroke="var(--saboreo-purple)" strokeWidth={3} dot={{ r: 4, fill: "var(--saboreo-yellow)", strokeWidth: 2, stroke: "var(--saboreo-purple)" }} animationDuration={900} animationBegin={650} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </ChartReveal>
                    </div>
                  )}

                  {/* Distribución edad */}
                  {data.dist_edad.length > 0 && (
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                      <h2 className="font-display text-lg font-bold">Participantes por edad</h2>
                      <p className="mb-2 text-xs text-muted-foreground">Número de respuestas por año</p>
                      <ChartReveal className="h-56">
                        <ResponsiveContainer>
                          <AreaChart data={data.dist_edad.map((e) => ({ name: `${e.edad}a`, val: e.cantidad }))}>
                            <defs>
                              <linearGradient id="edadFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--saboreo-green)" stopOpacity={0.5} />
                                <stop offset="100%" stopColor="var(--saboreo-green)" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                            <YAxis allowDecimals={false} stroke="var(--muted-foreground)" tick={NUM_TICK} />
                            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v: number) => [v, "Participantes"]} />
                            <Area type="monotone" dataKey="val" stroke="var(--saboreo-green)" strokeWidth={2} fill="url(#edadFill)" animationDuration={1000} animationBegin={150} animationEasing="ease-out" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </ChartReveal>
                    </div>
                  )}
                </section>

                {/* Tabla encuestas */}
                <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
                  <div className="mb-4 flex items-baseline justify-between">
                    <div>
                      <h2 className="font-display text-lg font-bold">Resumen por encuesta</h2>
                      <p className="text-xs text-muted-foreground">Estadísticas de cada encuesta registrada</p>
                    </div>
                    <Link to="/encuestas" className="text-xs font-semibold text-saboreo-blue hover:underline">Ver encuestas</Link>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] table-fixed text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="w-[40%] pb-3 pr-2 font-semibold">Encuesta</th>
                          <th className="w-[12%] pb-3 px-2 font-semibold">Estado</th>
                          <th className="w-[11%] pb-3 px-2 text-center font-semibold">Muestras</th>
                          <th className="w-[13%] pb-3 px-2 text-center font-semibold">Respuestas</th>
                          <th className="w-[13%] pb-3 px-2 text-center font-semibold">Prom. escala</th>
                          <th className="w-[11%] pb-3 pl-2 text-center font-semibold">Con alergia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.por_encuesta.map((e) => {
                          const EIcon = ESTADO_ICON[e.estado] ?? Clock;
                          return (
                            <tr key={e.titulo} className="border-b border-border/60 last:border-0">
                              <td className="py-3 pr-2">
                                <p className="truncate font-semibold">{e.titulo}</p>
                                <p className="truncate text-xs text-muted-foreground">{e.producto}</p>
                              </td>
                              <td className="py-3 px-2">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${ESTADO_COLOR[e.estado]}`}>
                                  <EIcon className="h-3 w-3" /> {e.estado}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-center font-num font-semibold text-muted-foreground">{e.num_muestras}</td>
                              <td className="py-3 px-2 text-center font-num font-bold">{e.total_respuestas}</td>
                              <td className={`py-3 px-2 text-center font-num text-lg font-black ${escalaColor(e.promedio_escala)}`}>
                                {e.promedio_escala ? `${e.promedio_escala}` : "—"}
                              </td>
                              <td className="py-3 pl-2 text-center">
                                {e.con_alergia > 0
                                  ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-num font-bold text-red-700">{e.con_alergia}</span>
                                  : <span className="text-muted-foreground">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Últimas respuestas */}
                {data.recientes.length > 0 && (
                  <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
                    <div className="mb-4 flex items-baseline justify-between">
                      <div>
                        <h2 className="font-display text-lg font-bold">Últimas respuestas</h2>
                        <p className="text-xs text-muted-foreground">Las 5 más recientes</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                            <th className="pb-3 font-semibold">Participante</th>
                            <th className="pb-3 font-semibold">Encuesta</th>
                            <th className="pb-3 text-center font-semibold">Edad</th>
                            <th className="pb-3 text-center font-semibold">Género</th>
                            <th className="pb-3 text-center font-semibold">Escala</th>
                            <th className="pb-3 text-center font-semibold">Alergia</th>
                            <th className="pb-3 text-right font-semibold">Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.recientes.slice(0, 5).map((r, i) => (
                            <tr key={i} className="border-b border-border/60 last:border-0">
                              <td className="py-3 font-semibold">{r.participante_nombre}</td>
                              <td className="py-3 max-w-[180px]">
                                <p className="truncate text-xs text-muted-foreground">{r.encuesta_titulo}</p>
                              </td>
                              <td className="py-3 text-center font-num font-semibold text-muted-foreground">{r.participante_edad}a</td>
                              <td className="py-3 text-center text-xs text-muted-foreground capitalize">{r.participante_genero ?? "—"}</td>
                              <td className="py-3 text-center">
                                {r.escala_hedonica
                                  ? <span title={ESCALA_LABELS[r.escala_hedonica]} className="text-xl">{ESCALA_EMOJIS[r.escala_hedonica]}</span>
                                  : <span className="text-xs text-muted-foreground">—</span>}
                              </td>
                              <td className="py-3 text-center">
                                {r.tiene_alergia === true
                                  ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Sí</span>
                                  : r.tiene_alergia === false
                                  ? <span className="text-xs text-green-700">No</span>
                                  : <span className="text-xs text-muted-foreground">—</span>}
                              </td>
                              <td className="py-3 text-right text-xs text-muted-foreground">
                                {new Date(r.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
