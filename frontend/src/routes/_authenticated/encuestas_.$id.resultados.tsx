import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Users, BarChart2, ChevronDown, ChevronUp, FileSpreadsheet, FileText, Brain } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { apiFetch } from "@/integrations/api/client";
import { AppLayout } from "@/components/saboreo/AppLayout";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/encuestas_/$id/resultados")({
  head: () => ({ meta: [{ title: "Resultados — SABOREO" }] }),
  component: ResultadosPage,
});

const ESCALA_EMOJIS = ["", "😢", "😕", "😐", "😊", "😍"];
const ESCALA_LABELS = ["", "Me disgusta", "Me disgusta poco", "Ni me gusta ni me disgusta", "Me gusta", "Me gusta mucho"];
const ESCALA_COLORS = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#0ea5e9"];
const GENERO_COLORS: Record<string, string> = {
  niño: "#0ea5e9", niña: "#a855f7", otro: "#f97316", "no especificado": "#94a3b8",
};

interface Resultados {
  encuesta: { titulo: string; producto: string; estado: string; num_muestras: number; atributos: string[] };
  kpis: { total_respuestas: number; total_participantes: number; con_alergia: number; promedio_escala_unica: number | null };
  por_muestra: { numero_muestra: number; promedio: number; cantidad: number; minimo: number; maximo: number; promedio_score_ia: number | null; emocion_dominante_comun: string | null }[];
  dist_escala: { valor: number; cantidad: number }[];
  dist_genero: { genero: string; cantidad: number }[];
  dist_edad: { edad: number; cantidad: number }[];
  respuestas: {
    id: string; participante_nombre: string; participante_edad: number;
    participante_genero: string | null; participante_institucion: string | null;
    consentimiento: boolean; tiene_alergia: boolean | null;
    escala_hedonica: number | null; comentarios: string | null;
    created_at: string;
    evaluaciones: {
      numero_muestra: number; calificacion: number | null; observaciones: string | null;
      score_ia?: number | null; emociones?: Record<string, number> | null;
      emocion_dominante?: string | null; sentimiento_voz?: string | null;
      resumen_ia?: string | null; frames_analizados?: number | null;
    }[];
  }[];
}

function exportXLSX(data: Resultados) {
  // Importación dinámica para no bloquear el bundle inicial
  import("xlsx").then(({ utils, writeFile }) => {
    const wb = utils.book_new();
    const enc = data.encuesta;

    // Hoja 1: Resumen
    const resumen = [
      ["Encuesta", enc.titulo],
      ["Producto", enc.producto],
      ["Estado", enc.estado],
      ["Muestras", enc.num_muestras],
      ["Atributos", enc.atributos?.join(", ")],
      [],
      ["Total respuestas", data.kpis.total_respuestas],
      ["Total participantes", data.kpis.total_participantes],
      ["Con alergia", data.kpis.con_alergia],
      ["Promedio calificación", data.kpis.promedio_escala_unica ?? "Ver hoja Muestras"],
    ];
    utils.book_append_sheet(wb, utils.aoa_to_sheet(resumen), "Resumen");

    // Hoja 2: Respuestas individuales
    const header = ["Nombre", "Edad", "Género", "Institución", "Consentimiento", "Alergia", "Comentarios", "Fecha"];
    const rows = data.respuestas.map((r) => [
      r.participante_nombre,
      r.participante_edad,
      r.participante_genero ?? "",
      r.participante_institucion ?? "",
      r.consentimiento ? "Sí" : "No",
      r.tiene_alergia === true ? "Sí" : r.tiene_alergia === false ? "No" : "",
      r.comentarios ?? "",
      new Date(r.created_at).toLocaleString("es-CO"),
    ]);
    utils.book_append_sheet(wb, utils.aoa_to_sheet([header, ...rows]), "Respuestas");

    // Hoja 3: Evaluaciones por muestra
    if (data.respuestas.some((r) => r.evaluaciones?.length > 0)) {
      const hasIA = data.respuestas.some((r) => r.evaluaciones?.some((ev) => ev.score_ia != null));
      const evalHeader = hasIA
        ? ["Participante", "Muestra", "Calificación", "Observaciones", "Score IA", "Emoción dominante", "Sentimiento voz", "Resumen IA", "Frames"]
        : ["Participante", "Muestra", "Calificación", "Observaciones"];
      const evalRows: (string | number)[][] = [];
      for (const r of data.respuestas) {
        for (const ev of r.evaluaciones ?? []) {
          evalRows.push(hasIA
            ? [r.participante_nombre, ev.numero_muestra, ev.calificacion ?? "", ev.observaciones ?? "",
               ev.score_ia ?? "", ev.emocion_dominante ?? "", ev.sentimiento_voz ?? "", ev.resumen_ia ?? "", ev.frames_analizados ?? ""]
            : [r.participante_nombre, ev.numero_muestra, ev.calificacion ?? "", ev.observaciones ?? ""]
          );
        }
      }
      utils.book_append_sheet(wb, utils.aoa_to_sheet([evalHeader, ...evalRows]), "Evaluaciones por muestra");
    }

    // Hoja 4: Promedios por muestra
    if (data.por_muestra.length > 0) {
      const mHeader = ["Muestra", "Promedio", "Mínimo", "Máximo", "Cantidad"];
      const mRows = data.por_muestra.map((m) => [m.numero_muestra, m.promedio, m.minimo, m.maximo, m.cantidad]);
      utils.book_append_sheet(wb, utils.aoa_to_sheet([mHeader, ...mRows]), "Promedios por muestra");
    }

    writeFile(wb, `resultados_${enc.titulo.replace(/\s+/g, "_").slice(0, 40)}.xlsx`);
    toast.success("Archivo XLSX descargado");
  });
}

async function exportPDF(data: Resultados) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const enc = data.encuesta;
  const margen = 14;
  let y = 20;

  // Título
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(enc.titulo, margen, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Producto: ${enc.producto}   ·   Estado: ${enc.estado}   ·   Muestras: ${enc.num_muestras}`, margen, y);
  y += 6;
  doc.text(`Atributos: ${enc.atributos?.join(", ") ?? "—"}   ·   Generado: ${new Date().toLocaleDateString("es-CO", { dateStyle: "long" })}`, margen, y);
  y += 10;

  // KPIs
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(`Respuestas: ${data.kpis.total_respuestas}   |   Participantes: ${data.kpis.total_participantes}   |   Con alergia: ${data.kpis.con_alergia}`, margen, y);
  y += 10;

  // Promedios por muestra
  if (data.por_muestra.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Promedios por muestra", margen, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [["Muestra", "Promedio", "Mínimo", "Máximo", "N"]],
      body: data.por_muestra.map((m) => [`Muestra ${m.numero_muestra}`, String(m.promedio), String(m.minimo), String(m.maximo), String(m.cantidad)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
      margin: { left: margen, right: margen },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Tabla de respuestas (nueva página si no hay espacio)
  if (y > 160) { doc.addPage(); y = 20; }
  doc.setFont("helvetica", "bold");
  doc.text("Respuestas individuales", margen, y);
  y += 2;

  const hasEvals = data.respuestas.some((r) => r.evaluaciones?.length > 0);
  const respHeaders = hasEvals
    ? ["Participante", "Edad", "Género", "Alergia", "Prom.", "Fecha"]
    : ["Participante", "Edad", "Género", "Alergia", "Escala", "Comentarios", "Fecha"];

  const respRows = data.respuestas.map((r) => {
    const evals = r.evaluaciones ?? [];
    const prom = evals.filter((e) => e.calificacion).length
      ? (evals.filter((e) => e.calificacion).reduce((s, e) => s + (e.calificacion ?? 0), 0) / evals.filter((e) => e.calificacion).length).toFixed(2)
      : "";
    return hasEvals
      ? [r.participante_nombre, r.participante_edad, r.participante_genero ?? "—", r.tiene_alergia === true ? "Sí" : "No", prom, new Date(r.created_at).toLocaleDateString("es-CO")]
      : [r.participante_nombre, r.participante_edad, r.participante_genero ?? "—", r.tiene_alergia === true ? "Sí" : "No", r.escala_hedonica ?? "—", r.comentarios ?? "—", new Date(r.created_at).toLocaleDateString("es-CO")];
  });

  autoTable(doc, {
    startY: y,
    head: [respHeaders],
    body: respRows.map((r) => r.map(String)),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margen, right: margen },
  });

  // Hoja de evaluaciones por muestra detalladas (nueva página)
  if (hasEvals) {
    doc.addPage();
    y = 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Evaluaciones por muestra — detalle", margen, y);
    y += 8;

    const allEvalRows: string[][] = [];
    const hasIA = data.respuestas.some((r) => r.evaluaciones?.some((ev) => ev.score_ia != null));
    for (const r of data.respuestas) {
      for (const ev of r.evaluaciones ?? []) {
        const row = [r.participante_nombre, String(ev.numero_muestra), String(ev.calificacion ?? "—"), ev.observaciones ?? "—"];
        if (hasIA) row.push(ev.score_ia != null ? String(ev.score_ia) : "—", ev.emocion_dominante ?? "—", ev.sentimiento_voz ?? "—");
        allEvalRows.push(row);
      }
    }
    const evalPdfHead = hasIA
      ? ["Participante", "Muestra", "Calif.", "Observaciones", "Score IA", "Emoción", "Sentimiento"]
      : ["Participante", "Muestra", "Calificación", "Observaciones"];
    autoTable(doc, {
      startY: y,
      head: [evalPdfHead],
      body: allEvalRows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margen, right: margen },
    });
  }

  doc.save(`resultados_${enc.titulo.replace(/\s+/g, "_").slice(0, 40)}.pdf`);
  toast.success("Archivo PDF descargado");
}

function ResultadosPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Resultados | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exportando, setExportando] = useState<"xlsx" | "pdf" | null>(null);

  useEffect(() => {
    apiFetch<Resultados>(`/api/encuestas/${id}/resultados`)
      .then(setData)
      .catch(() => toast.error("No se pudieron cargar los resultados"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <AppLayout title="Resultados"><div className="flex h-64 items-center justify-center text-muted-foreground">Cargando…</div></AppLayout>;
  if (!data) return <AppLayout title="Resultados"><div className="flex h-64 items-center justify-center text-muted-foreground">Sin datos</div></AppLayout>;

  const { encuesta, kpis, por_muestra, dist_escala, dist_genero, dist_edad, respuestas } = data;
  const promedioGeneral = por_muestra.length
    ? (por_muestra.reduce((s, m) => s + Number(m.promedio), 0) / por_muestra.length).toFixed(2)
    : kpis.promedio_escala_unica?.toFixed(2) ?? "—";

  return (
    <AppLayout
      title="Resultados"
      subtitle={encuesta.titulo}
      actions={
        <div className="flex gap-2">
          {data && (
            <>
              <button
                onClick={async () => { setExportando("xlsx"); try { exportXLSX(data); } finally { setExportando(null); } }}
                disabled={exportando === "xlsx"}
                className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-60"
              >
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                {exportando === "xlsx" ? "Generando…" : "Excel"}
              </button>
              <button
                onClick={async () => { setExportando("pdf"); try { await exportPDF(data); } finally { setExportando(null); } }}
                disabled={exportando === "pdf"}
                className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-60"
              >
                <FileText className="h-4 w-4 text-red-600" />
                {exportando === "pdf" ? "Generando…" : "PDF"}
              </button>
            </>
          )}
          <button onClick={() => navigate({ to: "/dashboard" })} className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
        </div>
      }
    >
      <div className="space-y-6">

        {/* Info encuesta */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="font-display text-xl font-bold">{encuesta.titulo}</p>
          <p className="mt-1 text-sm text-muted-foreground">{encuesta.producto}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full px-2.5 py-1 font-semibold ${encuesta.estado === "activa" ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}>{encuesta.estado}</span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">{encuesta.num_muestras} muestras</span>
            {encuesta.atributos?.map((a: string) => (
              <span key={a} className="rounded-full bg-muted px-2.5 py-1 font-semibold text-muted-foreground">{a}</span>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Respuestas",     value: kpis.total_respuestas,   grad: "bg-gradient-cool" },
            { label: "Participantes",  value: kpis.total_participantes, grad: "bg-gradient-warm" },
            { label: "Prom. calif.",   value: promedioGeneral + " / 5", grad: "bg-gradient-fresh" },
            { label: "Con alergia",    value: kpis.con_alergia,        grad: kpis.con_alergia > 0 ? "bg-red-500" : "bg-gradient-cool" },
          ].map((k) => (
            <div key={k.label} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${k.grad} shadow-soft`}>
                <BarChart2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-display text-2xl font-black">{k.value}</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
              </div>
            </div>
          ))}
        </div>

        {kpis.total_respuestas === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="font-semibold text-muted-foreground">Sin respuestas todavía</p>
            <Link to="/encuestas" className="mt-3 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background hover:opacity-90">
              Registrar respuesta
            </Link>
          </div>
        ) : (
          <>
            {/* Gráficos */}
            <div className="grid gap-4 lg:grid-cols-3">

              {/* Promedio por muestra */}
              {por_muestra.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-6 shadow-card lg:col-span-2">
                  <h2 className="font-display text-base font-bold">Promedio por muestra</h2>
                  <p className="mb-4 text-xs text-muted-foreground">Calificación media (escala 1–5)</p>
                  <div className="h-64">
                    <ResponsiveContainer>
                      <LineChart data={por_muestra.map((m) => ({ name: `M${m.numero_muestra}`, val: Number(m.promedio), min: m.minimo, max: m.maximo }))}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke="var(--muted-foreground)" fontSize={11} />
                        <Tooltip
                          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}
                          formatter={(v: number, key: string) => [v.toFixed ? v.toFixed(2) : v, key === "val" ? "Promedio" : key === "min" ? "Mínimo" : "Máximo"]}
                        />
                        <Line type="monotone" dataKey="val" stroke="var(--saboreo-purple)" strokeWidth={3} dot={{ r: 5, fill: "var(--saboreo-yellow)", stroke: "var(--saboreo-purple)", strokeWidth: 2 }} name="Promedio" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Distribución escala */}
              {dist_escala.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                  <h2 className="font-display text-base font-bold">Distribución</h2>
                  <p className="mb-4 text-xs text-muted-foreground">Total de calificaciones por valor</p>
                  <div className="h-64">
                    <ResponsiveContainer>
                      <BarChart data={dist_escala.map((d) => ({ name: `${ESCALA_EMOJIS[d.valor]} ${d.valor}`, val: d.cantidad }))}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={13} />
                        <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} />
                        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}
                          formatter={(v: number, _: string, p: { payload?: { name: string } }) => [v, ESCALA_LABELS[parseInt(p.payload?.name?.split(" ")[1] ?? "0")]]} />
                        <Bar dataKey="val" radius={[8, 8, 0, 0]}>
                          {dist_escala.map((d) => <Cell key={d.valor} fill={ESCALA_COLORS[d.valor]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Score IA por muestra (solo si hay datos de video) */}
            {por_muestra.some((m) => m.promedio_score_ia != null) && (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h2 className="font-display flex items-center gap-2 text-base font-bold">
                  <Brain className="h-4 w-4 text-saboreo-blue" /> Score IA por muestra
                </h2>
                <p className="mb-4 text-xs text-muted-foreground">Promedio del análisis de expresiones faciales (0–100)</p>
                <div className="space-y-3">
                  {por_muestra.filter((m) => m.promedio_score_ia != null).map((m) => (
                    <div key={m.numero_muestra} className="flex items-center gap-3">
                      <span className="w-12 shrink-0 text-xs font-semibold text-muted-foreground">M{m.numero_muestra}</span>
                      <div className="flex-1 overflow-hidden rounded-full bg-muted h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            (m.promedio_score_ia ?? 0) >= 70 ? 'bg-green-500' :
                            (m.promedio_score_ia ?? 0) >= 40 ? 'bg-yellow-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${m.promedio_score_ia}%` }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-sm font-bold">{m.promedio_score_ia}/100</span>
                      {m.emocion_dominante_comun && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{m.emocion_dominante_comun}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Demografía */}
            <div className="grid gap-4 lg:grid-cols-2">
              {dist_genero.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                  <h2 className="font-display text-base font-bold">Género</h2>
                  <div className="h-52">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={dist_genero.map((g) => ({ name: g.genero, value: g.cantidad }))} dataKey="value" innerRadius={40} outerRadius={75} paddingAngle={3}>
                          {dist_genero.map((g) => <Cell key={g.genero} fill={GENERO_COLORS[g.genero] ?? "#94a3b8"} />)}
                        </Pie>
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {dist_edad.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                  <h2 className="font-display text-base font-bold">Edad</h2>
                  <div className="h-52">
                    <ResponsiveContainer>
                      <BarChart data={dist_edad.map((e) => ({ name: `${e.edad}a`, val: e.cantidad }))}>
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
            </div>

            {/* Tabla de respuestas */}
            <div className="rounded-2xl border border-border bg-card shadow-card">
              <div className="border-b border-border px-6 py-4">
                <h2 className="font-display text-base font-bold">Respuestas individuales</h2>
                <p className="text-xs text-muted-foreground">{respuestas.length} respuesta{respuestas.length !== 1 ? "s" : ""} · haz clic para ver evaluaciones por muestra</p>
              </div>
              <div className="divide-y divide-border">
                {respuestas.map((r) => {
                  const evals = r.evaluaciones ?? [];
                  const prom = evals.length ? (evals.filter(e => e.calificacion).reduce((s, e) => s + (e.calificacion ?? 0), 0) / evals.filter(e => e.calificacion).length).toFixed(2) : null;
                  const isOpen = expandedId === r.id;
                  return (
                    <div key={r.id}>
                      <button
                        className="flex w-full items-center gap-4 px-6 py-4 text-left hover:bg-accent/30 transition-colors"
                        onClick={() => setExpandedId(isOpen ? null : r.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{r.participante_nombre}</p>
                            {r.tiene_alergia && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Alergia</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {r.participante_edad} años{r.participante_genero ? ` · ${r.participante_genero}` : ""}{r.participante_institucion ? ` · ${r.participante_institucion}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          {prom && <span className="text-right"><span className="font-display text-lg font-black">{prom}</span><span className="text-xs text-muted-foreground"> /5</span></span>}
                          {r.escala_hedonica && <span className="text-2xl">{ESCALA_EMOJIS[r.escala_hedonica]}</span>}
                          <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("es-CO", { dateStyle: "short" })}</span>
                          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>

                      {isOpen && evals.length > 0 && (
                        <div className="border-t border-border bg-muted/20 px-6 py-4">
                          {r.comentarios && (
                            <p className="mb-3 rounded-lg bg-card border border-border px-3 py-2 text-sm italic text-muted-foreground">"{r.comentarios}"</p>
                          )}
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border text-xs text-muted-foreground">
                                  <th className="pb-2 text-left font-semibold">Muestra</th>
                                  <th className="pb-2 text-center font-semibold">Calificación</th>
                                  {evals.some((ev) => ev.score_ia != null) && (
                                    <>
                                      <th className="pb-2 text-center font-semibold">Score IA</th>
                                      <th className="pb-2 text-left font-semibold">Emoción</th>
                                      <th className="pb-2 text-left font-semibold">Sentimiento</th>
                                    </>
                                  )}
                                  <th className="pb-2 text-left font-semibold">Observaciones</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {evals.map((ev) => (
                                  <tr key={ev.numero_muestra}>
                                    <td className="py-1.5 font-medium text-muted-foreground">#{ev.numero_muestra}</td>
                                    <td className="py-1.5 text-center">
                                      {ev.calificacion
                                        ? <span title={ESCALA_LABELS[ev.calificacion]}>{ESCALA_EMOJIS[ev.calificacion]} <strong>{ev.calificacion}</strong></span>
                                        : "—"}
                                    </td>
                                    {evals.some((e) => e.score_ia != null) && (
                                      <>
                                        <td className="py-1.5 text-center">
                                          {ev.score_ia != null
                                            ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                                                ev.score_ia >= 70 ? 'bg-green-100 text-green-800' :
                                                ev.score_ia >= 40 ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-red-100 text-red-800'}`}>{ev.score_ia}</span>
                                            : "—"}
                                        </td>
                                        <td className="py-1.5 text-xs">
                                          {ev.emocion_dominante
                                            ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 font-medium">{ev.emocion_dominante}</span>
                                            : "—"}
                                        </td>
                                        <td className="py-1.5 text-xs">
                                          {ev.sentimiento_voz === 'positivo' && <span className="text-green-600 font-semibold">positivo</span>}
                                          {ev.sentimiento_voz === 'negativo' && <span className="text-red-600 font-semibold">negativo</span>}
                                          {ev.sentimiento_voz === 'neutro' && <span className="text-gray-500">neutro</span>}
                                          {!ev.sentimiento_voz && "—"}
                                        </td>
                                      </>
                                    )}
                                    <td className="py-1.5 text-xs text-muted-foreground">{ev.observaciones || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {evals.some((ev) => ev.resumen_ia) && (
                            <div className="mt-3 space-y-2">
                              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                <Brain className="h-3.5 w-3.5" /> Resúmenes Claude Vision
                              </p>
                              {evals.filter((ev) => ev.resumen_ia).map((ev) => (
                                <div key={ev.numero_muestra} className="rounded-lg bg-card border border-border px-3 py-2">
                                  <span className="mr-2 text-xs font-bold text-muted-foreground">#{ev.numero_muestra}</span>
                                  <span className="text-xs text-foreground italic">{ev.resumen_ia}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
