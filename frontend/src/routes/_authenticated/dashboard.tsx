import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Users, Activity, Smile, Video, ClipboardCheck, ChevronRight,
  ArrowLeft, LogOut, ShieldCheck, FlaskConical,
  CheckCircle2, Clock, Archive, RefreshCw, BarChart2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useAuth, ROLE_LABEL } from "@/hooks/use-auth";
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

function escalaColor(v: number | null) {
  if (!v) return "text-muted-foreground";
  if (v >= 4) return "text-green-600";
  if (v >= 3) return "text-yellow-600";
  return "text-red-600";
}

// ── Componente principal ──────────────────────────────────────────────────────

function Dashboard() {
  const { profile, user, roles, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const displayName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Investigador";
  const initials = displayName.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

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

  async function handleSignOut() {
    await signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/" });
  }

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
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-accent">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SABOREO · Dashboard</p>
              <h1 className="font-display text-xl font-bold leading-tight">Investigación · Aceptación infantil</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={cargarDatos} disabled={loading} className="hidden items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-60 md:inline-flex">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
            </button>
            <div className="ml-2 flex items-center gap-3 rounded-full border border-border bg-background py-1.5 pl-1.5 pr-3">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-cool text-xs font-bold text-white">{initials}</div>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-xs font-semibold">{displayName}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {roles.length ? roles.map((r: string) => ROLE_LABEL[r as keyof typeof ROLE_LABEL]).join(" · ") : "Sin rol"}
                </p>
              </div>
              <button onClick={handleSignOut} title="Cerrar sesión" className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-8">

        {/* Role banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-saboreo-turquoise/30 bg-saboreo-turquoise/10 px-5 py-3">
          <div className="flex items-center gap-3 text-sm">
            <ShieldCheck className="h-5 w-5 text-saboreo-turquoise" />
            <span>Hola <strong>{displayName}</strong> · Acceso como <strong>{roles.length ? roles.map((r: string) => ROLE_LABEL[r as keyof typeof ROLE_LABEL]).join(", ") : "Sin rol"}</strong></span>
          </div>
          {hasRole("admin") && (
            <span className="rounded-full bg-saboreo-purple/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-saboreo-purple">Permisos completos</span>
          )}
        </div>

        {/* Acceso rápido */}
        <section className="grid gap-4 sm:grid-cols-2">
          {[
            { to: "/encuestas", icon: ClipboardCheck, title: "Encuestas sensoriales", desc: "Consentimiento, datos demográficos y escala hedónica.", grad: "bg-gradient-warm" },
            { to: "/sesion",    icon: Video,          title: "Sesión con cámara",      desc: "Grabación en vivo y análisis IA de emociones.",      grad: "bg-gradient-cool" },
          ].map((m) => (
            <Link key={m.to} to={m.to} className="group flex items-center gap-5 rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-glow">
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${m.grad} shadow-soft`}>
                <m.icon className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-bold">{m.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{m.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </section>

        {loading && (
          <div className="flex h-40 items-center justify-center gap-3 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" /> Cargando datos…
          </div>
        )}

        {!loading && data && (
          <>
            {/* KPIs */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {kpis.map((k) => (
                <div key={k.label} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl ${k.grad} shadow-soft`}>
                    <k.icon className="h-5 w-5 text-white" />
                  </div>
                  <p className="mt-4 font-display text-2xl font-black tracking-tight">{k.value}</p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
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
                <section className="grid gap-4 lg:grid-cols-5">

                  {/* Respuestas por encuesta */}
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-card lg:col-span-3">
                    <h2 className="font-display text-lg font-bold">Respuestas por encuesta</h2>
                    <p className="mb-4 text-xs text-muted-foreground">Total de participantes registrados</p>
                    <div className="h-64">
                      <ResponsiveContainer>
                        <BarChart data={data.por_encuesta.map((e) => ({ name: e.titulo.slice(0, 28) + (e.titulo.length > 28 ? "…" : ""), val: e.total_respuestas }))} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} />
                          <YAxis dataKey="name" type="category" stroke="var(--muted-foreground)" fontSize={10} width={160} />
                          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v: number) => [v, "Respuestas"]} />
                          <Bar dataKey="val" fill="var(--saboreo-sky)" radius={[0, 8, 8, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Distribución escala hedónica */}
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-card lg:col-span-2">
                    <h2 className="font-display text-lg font-bold">Escala hedónica</h2>
                    <p className="mb-4 text-xs text-muted-foreground">Distribución de calificaciones globales</p>
                    {data.dist_escala.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground italic">Sin calificaciones de escala única</p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer>
                          <BarChart data={data.dist_escala.map((d) => ({ name: `${ESCALA_EMOJIS[d.valor]} ${d.valor}`, val: d.cantidad, color: ESCALA_COLORS[d.valor] }))}>
                            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                            <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} />
                            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}
                              formatter={(v: number, _: string, props: { payload?: { name: string } }) => [v, ESCALA_LABELS[parseInt(props.payload?.name?.split(" ")[1] ?? "0")]]} />
                            <Bar dataKey="val" radius={[8, 8, 0, 0]}>
                              {data.dist_escala.map((d) => <Cell key={d.valor} fill={ESCALA_COLORS[d.valor]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </section>

                {/* Gráficos fila 2 */}
                <section className="grid gap-4 lg:grid-cols-3">

                  {/* Promedio por muestra */}
                  {data.por_muestra.length > 0 && (
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                      <h2 className="font-display text-lg font-bold">Promedio por muestra</h2>
                      <p className="mb-2 text-xs text-muted-foreground">Calificación media (1–5)</p>
                      <div className="h-56">
                        <ResponsiveContainer>
                          <LineChart data={data.por_muestra.map((m) => ({ name: `M${m.numero_muestra}`, val: Number(m.promedio) }))}>
                            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                            <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                            <YAxis domain={[1, 5]} stroke="var(--muted-foreground)" fontSize={11} ticks={[1, 2, 3, 4, 5]} />
                            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v: number) => [v.toFixed(2), "Promedio"]} />
                            <Line type="monotone" dataKey="val" stroke="var(--saboreo-purple)" strokeWidth={3}
                              dot={{ r: 4, fill: "var(--saboreo-yellow)", strokeWidth: 2, stroke: "var(--saboreo-purple)" }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Distribución género */}
                  {data.dist_genero.length > 0 && (
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                      <h2 className="font-display text-lg font-bold">Participantes por género</h2>
                      <p className="mb-2 text-xs text-muted-foreground">Distribución demográfica</p>
                      <div className="h-56">
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie data={data.dist_genero.map((g) => ({ name: g.genero, value: g.cantidad }))}
                              dataKey="value" innerRadius={45} outerRadius={80} paddingAngle={3}>
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

                  {/* Distribución edad */}
                  {data.dist_edad.length > 0 && (
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                      <h2 className="font-display text-lg font-bold">Participantes por edad</h2>
                      <p className="mb-2 text-xs text-muted-foreground">Número de respuestas por año</p>
                      <div className="h-56">
                        <ResponsiveContainer>
                          <BarChart data={data.dist_edad.map((e) => ({ name: `${e.edad}a`, val: e.cantidad }))}>
                            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                            <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} />
                            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v: number) => [v, "Participantes"]} />
                            <Bar dataKey="val" fill="var(--saboreo-green)" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
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
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="pb-3 font-semibold">Encuesta</th>
                          <th className="pb-3 font-semibold">Estado</th>
                          <th className="pb-3 text-center font-semibold">Muestras</th>
                          <th className="pb-3 text-center font-semibold">Respuestas</th>
                          <th className="pb-3 text-center font-semibold">Prom. escala</th>
                          <th className="pb-3 text-center font-semibold">Con alergia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.por_encuesta.map((e) => {
                          const EIcon = ESTADO_ICON[e.estado] ?? Clock;
                          return (
                            <tr key={e.titulo} className="border-b border-border/60 last:border-0">
                              <td className="py-3">
                                <p className="font-semibold">{e.titulo}</p>
                                <p className="text-xs text-muted-foreground">{e.producto}</p>
                              </td>
                              <td className="py-3">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO_COLOR[e.estado]}`}>
                                  <EIcon className="h-3 w-3" /> {e.estado}
                                </span>
                              </td>
                              <td className="py-3 text-center text-muted-foreground">{e.num_muestras}</td>
                              <td className="py-3 text-center font-bold">{e.total_respuestas}</td>
                              <td className={`py-3 text-center font-display text-lg font-black ${escalaColor(e.promedio_escala)}`}>
                                {e.promedio_escala ? `${e.promedio_escala}` : "—"}
                              </td>
                              <td className="py-3 text-center">
                                {e.con_alergia > 0
                                  ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{e.con_alergia}</span>
                                  : <span className="text-muted-foreground">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Lista encuestas con link a resultados */}
                <section className="rounded-2xl border border-border bg-card shadow-card">
                  <div className="flex items-center justify-between border-b border-border px-6 py-4">
                    <div>
                      <h2 className="font-display text-lg font-bold">Resultados por encuesta</h2>
                      <p className="text-xs text-muted-foreground">Haz clic en una encuesta para ver el análisis detallado</p>
                    </div>
                    <Link to="/encuestas" className="text-xs font-semibold text-saboreo-blue hover:underline">Gestionar</Link>
                  </div>
                  <div className="divide-y divide-border">
                    {data.por_encuesta.map((e) => {
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
                              <p className="font-display text-2xl font-black">{prom}</p>
                              <p className="text-[11px] text-muted-foreground">prom /5</p>
                            </div>
                          )}
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                        </Link>
                      );
                    })}
                  </div>
                </section>

                {/* Últimas respuestas */}
                {data.recientes.length > 0 && (
                  <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
                    <div className="mb-4 flex items-baseline justify-between">
                      <div>
                        <h2 className="font-display text-lg font-bold">Últimas respuestas</h2>
                        <p className="text-xs text-muted-foreground">Las 10 más recientes</p>
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
                          {data.recientes.map((r, i) => (
                            <tr key={i} className="border-b border-border/60 last:border-0">
                              <td className="py-3 font-semibold">{r.participante_nombre}</td>
                              <td className="py-3 max-w-[180px]">
                                <p className="truncate text-xs text-muted-foreground">{r.encuesta_titulo}</p>
                              </td>
                              <td className="py-3 text-center text-muted-foreground">{r.participante_edad}a</td>
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
      </main>
    </div>
  );
}
