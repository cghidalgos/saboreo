import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users, Activity, Smile, Video, Mic, FlaskConical,
  TrendingUp, ArrowLeft, Download, Filter,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SABOREO" },
      { name: "description", content: "Panel de control con KPIs, gráficos y análisis multimodal de aceptación sensorial infantil." },
    ],
  }),
  component: Dashboard,
});

const kpis = [
  { label: "Participantes", value: "1.284", trend: "+12%", icon: Users, grad: "bg-gradient-warm" },
  { label: "Pruebas realizadas", value: "3.961", trend: "+24%", icon: Activity, grad: "bg-gradient-cool" },
  { label: "Aceptación promedio", value: "76 / 100", trend: "+4.1", icon: Smile, grad: "bg-gradient-fresh" },
  { label: "Videos analizados", value: "2.107", trend: "+18%", icon: Video, grad: "bg-gradient-warm" },
  { label: "Audios procesados", value: "2.107", trend: "+18%", icon: Mic, grad: "bg-gradient-cool" },
  { label: "Productos evaluados", value: "14", trend: "+3", icon: FlaskConical, grad: "bg-gradient-fresh" },
];

const productData = [
  { name: "Galleta cacao+avena", score: 87 },
  { name: "Bebida soya-fresa", score: 81 },
  { name: "Snack avena-miel", score: 74 },
  { name: "Mousse cacao", score: 71 },
  { name: "Cereal soya", score: 63 },
  { name: "Barra cacao-avena", score: 58 },
];

const ageData = [
  { age: "5", score: 72 },
  { age: "6", score: 78 },
  { age: "7", score: 81 },
  { age: "8", score: 84 },
  { age: "9", score: 79 },
  { age: "10", score: 76 },
  { age: "11", score: 74 },
];

const emotions = [
  { name: "Alegría", value: 42, color: "var(--saboreo-yellow)" },
  { name: "Sorpresa", value: 22, color: "var(--saboreo-sky)" },
  { name: "Interés", value: 18, color: "var(--saboreo-green)" },
  { name: "Neutral", value: 10, color: "var(--saboreo-purple)" },
  { name: "Asco", value: 5, color: "var(--saboreo-red)" },
  { name: "Tristeza", value: 3, color: "var(--saboreo-orange)" },
];

const recent = [
  { name: "María L.", age: 8, prod: "Galleta cacao+avena", score: 92, emo: "Alegría" },
  { name: "Juan P.", age: 7, prod: "Bebida soya-fresa", score: 84, emo: "Sorpresa" },
  { name: "Sofía R.", age: 9, prod: "Mousse cacao", score: 71, emo: "Interés" },
  { name: "Diego A.", age: 6, prod: "Snack avena-miel", score: 65, emo: "Neutral" },
  { name: "Camila V.", age: 10, prod: "Cereal soya", score: 48, emo: "Asco" },
];

function emoColor(e: string) {
  const map: Record<string, string> = {
    "Alegría": "bg-saboreo-yellow/20 text-amber-900",
    "Sorpresa": "bg-saboreo-sky/30 text-sky-900",
    "Interés": "bg-saboreo-green/20 text-green-900",
    "Neutral": "bg-muted text-muted-foreground",
    "Asco": "bg-saboreo-red/20 text-red-900",
  };
  return map[e] ?? "bg-muted";
}

function scoreColor(s: number) {
  if (s >= 81) return "text-saboreo-green";
  if (s >= 61) return "text-saboreo-sky";
  if (s >= 41) return "text-saboreo-yellow";
  if (s >= 21) return "text-saboreo-orange";
  return "text-saboreo-red";
}

function Dashboard() {
  return (
    <div className="min-h-screen bg-muted/40">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-accent">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SABOREO · Dashboard</p>
              <h1 className="font-display text-xl font-bold leading-tight">Investigación · Aceptación infantil 2026</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent">
              <Filter className="h-4 w-4" /> Filtros
            </button>
            <button className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90">
              <Download className="h-4 w-4" /> Exportar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-8">
        {/* KPIs */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between">
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${k.grad} shadow-soft`}>
                  <k.icon className="h-5 w-5 text-white" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-saboreo-green/15 px-2 py-0.5 text-[11px] font-bold text-green-700">
                  <TrendingUp className="h-3 w-3" /> {k.trend}
                </span>
              </div>
              <p className="mt-4 font-display text-2xl font-black tracking-tight">{k.value}</p>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
            </div>
          ))}
        </section>

        {/* Charts row 1 */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card lg:col-span-2">
            <div className="mb-4 flex items-baseline justify-between">
              <div>
                <h2 className="font-display text-lg font-bold">Aceptación por producto</h2>
                <p className="text-xs text-muted-foreground">Índice SABOREO promedio (0–100)</p>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={productData} layout="vertical" margin={{ left: 30, right: 20 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="var(--muted-foreground)" fontSize={11} width={140} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  <Bar dataKey="score" radius={[0, 8, 8, 0]}>
                    {productData.map((_, i) => (
                      <Cell key={i} fill={["var(--saboreo-green)","var(--saboreo-sky)","var(--saboreo-yellow)","var(--saboreo-orange)","var(--saboreo-purple)","var(--saboreo-red)"][i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="font-display text-lg font-bold">Emociones detectadas</h2>
            <p className="text-xs text-muted-foreground">Distribución del último mes</p>
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={emotions} dataKey="value" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {emotions.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Charts row 2 */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card lg:col-span-1">
            <h2 className="font-display text-lg font-bold">Aceptación por edad</h2>
            <p className="text-xs text-muted-foreground">Score promedio por años</p>
            <div className="mt-2 h-56">
              <ResponsiveContainer>
                <LineChart data={ageData}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="age" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis domain={[40, 100]} stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  <Line type="monotone" dataKey="score" stroke="var(--saboreo-purple)" strokeWidth={3} dot={{ r: 5, fill: "var(--saboreo-yellow)", strokeWidth: 2, stroke: "var(--saboreo-purple)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-card lg:col-span-2">
            <div className="mb-4 flex items-baseline justify-between">
              <div>
                <h2 className="font-display text-lg font-bold">Sesiones recientes</h2>
                <p className="text-xs text-muted-foreground">Últimas evaluaciones con IA</p>
              </div>
              <button className="text-xs font-semibold text-saboreo-blue hover:underline">Ver todas</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 font-semibold">Participante</th>
                    <th className="pb-3 font-semibold">Edad</th>
                    <th className="pb-3 font-semibold">Producto</th>
                    <th className="pb-3 font-semibold">Emoción dominante</th>
                    <th className="pb-3 text-right font-semibold">Índice</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.name} className="border-b border-border/60 last:border-0">
                      <td className="py-3 font-semibold">{r.name}</td>
                      <td className="py-3 text-muted-foreground">{r.age}</td>
                      <td className="py-3 text-muted-foreground">{r.prod}</td>
                      <td className="py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${emoColor(r.emo)}`}>{r.emo}</span>
                      </td>
                      <td className={`py-3 text-right font-display text-lg font-black ${scoreColor(r.score)}`}>{r.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
