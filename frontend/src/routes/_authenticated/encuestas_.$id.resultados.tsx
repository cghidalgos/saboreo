import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Users, BarChart2, ChevronDown, ChevronUp, FileSpreadsheet, FileText, Brain, Loader2, Send, Trash2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { apiFetch, API_BASE } from "@/integrations/api/client";
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
// Estilo de los ejes numéricos: misma fuente (Fraunces) que los números destacados.
const NUM_TICK = { fontSize: 11, fontFamily: "var(--font-num)", fill: "var(--muted-foreground)" } as const;

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
      resumen_ia?: string | null; frames_analizados?: number | null; video_url?: string | null; transcripcion?: string | null;
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
  const [resumenes, setResumenes] = useState<Record<string, { loading: boolean; resumen?: string; muestra_favorita?: number | null }>>({});
  const [modalEmociones, setModalEmociones] = useState<{ emociones: Record<string, number>; dominante: string; muestra: number } | null>(null);

  type ChatMsg = { role: "user" | "assistant"; content: string };
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatIniciadoRef = useRef(false);

  const enviarChatRef = useRef<(mensaje?: string) => Promise<void>>(async () => {});

  async function enviarChat(mensaje?: string) {
    const texto = mensaje ?? chatInput.trim();
    if (!texto && chatMsgs.length > 0) return;
    if (chatLoading) return;
    setChatLoading(true);
    const historialSinUltimo = texto ? [...chatMsgs] : [];
    if (texto) setChatMsgs((p) => [...p, { role: "user", content: texto }]);
    setChatInput("");
    try {
      const res = await apiFetch<{ respuesta: string }>(`/api/encuestas/${id}/resultados/chat`, {
        method: "POST",
        body: JSON.stringify({ mensaje: texto || undefined, historial: historialSinUltimo }),
      });
      setChatMsgs((p) => [...p, { role: "assistant", content: res.respuesta }]);
    } catch {
      setChatMsgs((p) => [...p, { role: "assistant", content: "No se pudo obtener respuesta. Intenta de nuevo." }]);
    } finally {
      setChatLoading(false);
    }
  }
  enviarChatRef.current = enviarChat;

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMsgs]);

  useEffect(() => {
    apiFetch<Resultados>(`/api/encuestas/${id}/resultados`)
      .then(setData)
      .catch(() => toast.error("No se pudieron cargar los resultados"))
      .finally(() => setLoading(false));
  }, [id]);

  // Resumen inicial automático cuando cargan los datos
  useEffect(() => {
    if (data && data.kpis.total_respuestas > 0 && !chatIniciadoRef.current) {
      chatIniciadoRef.current = true;
      enviarChatRef.current();
    }
  }, [data]);

  if (loading) return <AppLayout title="Resultados"><div className="flex h-64 items-center justify-center text-muted-foreground">Cargando…</div></AppLayout>;
  if (!data) return <AppLayout title="Resultados"><div className="flex h-64 items-center justify-center text-muted-foreground">Sin datos</div></AppLayout>;

  const { encuesta, kpis, por_muestra, dist_escala, dist_genero, dist_edad, respuestas } = data;
  const chipsPreguntas = (() => {
    const qs: string[] = [];
    const generos = dist_genero.map((g) => g.genero.toLowerCase());
    const tieneNina = generos.some((g) => g.includes("ni"));
    const tieneMultiGenero = dist_genero.length >= 2;
    const tieneEdades = dist_edad.length >= 2;
    const tieneIA = por_muestra.some((m) => m.promedio_score_ia != null);
    const numMuestras = por_muestra.length;

    if (numMuestras >= 2) {
      const nombres = por_muestra.map((m) => `Muestra #${m.numero_muestra}`).join(" vs ");
      qs.push(`¿Cuál fue la preferida: ${nombres}?`);
    }
    if (tieneMultiGenero && tieneNina) qs.push("¿Qué muestra prefirieron las niñas vs los niños?");
    else if (tieneMultiGenero) qs.push(`¿Hubo diferencias entre ${dist_genero.map((g) => g.genero).join(" y ")}?`);
    if (tieneEdades) qs.push("¿Hubo diferencias por grupo de edad?");
    if (tieneIA) qs.push("¿Qué emociones predominaron en cada muestra?");
    qs.push("¿Qué comentarios dejaron los participantes?");
    qs.push("¿Qué muestra recomendarías lanzar al mercado?");
    return qs;
  })();

  const promedioGeneral = por_muestra.length
    ? (por_muestra.reduce((s, m) => s + Number(m.promedio), 0) / por_muestra.length).toFixed(2)
    : kpis.promedio_escala_unica?.toFixed(2) ?? "—";

  return (
    <>
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
                className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-60"
              >
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <span className="hidden sm:inline">{exportando === "xlsx" ? "Generando…" : "Excel"}</span>
              </button>
              <button
                onClick={async () => { setExportando("pdf"); try { await exportPDF(data); } finally { setExportando(null); } }}
                disabled={exportando === "pdf"}
                className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-60"
              >
                <FileText className="h-4 w-4 text-red-600" />
                <span className="hidden sm:inline">{exportando === "pdf" ? "Generando…" : "PDF"}</span>
              </button>
            </>
          )}
          <button onClick={() => navigate({ to: "/dashboard" })} className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Volver</span>
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
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          {[
            { label: "Respuestas",     value: kpis.total_respuestas,   grad: "bg-gradient-cool" },
            { label: "Participantes",  value: kpis.total_participantes, grad: "bg-gradient-warm" },
            { label: "Prom. calif.",   value: promedioGeneral + " / 5", grad: "bg-gradient-fresh" },
            { label: "Con alergia",    value: kpis.con_alergia,        grad: kpis.con_alergia > 0 ? "bg-red-500" : "bg-gradient-cool" },
          ].map((k) => (
            <div key={k.label} className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-3 shadow-card sm:flex-row sm:items-center sm:gap-4 sm:p-5">
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${k.grad} shadow-soft sm:h-11 sm:w-11`}>
                <BarChart2 className="h-4 w-4 text-white sm:h-5 sm:w-5" />
              </div>
              <div>
                <p className="font-num text-xl font-black sm:text-2xl">{k.value}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">{k.label}</p>
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
                        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke="var(--muted-foreground)" tick={NUM_TICK} />
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
                        <YAxis allowDecimals={false} stroke="var(--muted-foreground)" tick={NUM_TICK} />
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
                      <span className="w-12 shrink-0 text-right font-num text-sm font-bold">{m.promedio_score_ia}/100</span>
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
                      <BarChart data={dist_edad.map((e) => ({ name: `${e.edad} años`, val: e.cantidad }))}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                        <YAxis allowDecimals={false} stroke="var(--muted-foreground)" tick={NUM_TICK} />
                        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v: number) => [v, "Participantes"]} />
                        <Bar dataKey="val" fill="var(--saboreo-green)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Chat IA sobre resultados */}
            <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-violet-50 to-blue-50 px-6 py-4">
                <img src="/logo.png" alt="SaBot" className="h-8 w-8 object-contain" />
                <div className="flex-1">
                  <p className="font-display font-bold text-sm">SaBot</p>
                  <p className="text-xs text-muted-foreground">Pregúntale sobre los datos de esta encuesta</p>
                </div>
                {chatMsgs.length > 0 && (
                  <button
                    onClick={() => { setChatMsgs([]); chatIniciadoRef.current = false; }}
                    title="Limpiar conversación"
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Limpiar
                  </button>
                )}
              </div>
              {/* Mensajes */}
              <div ref={chatScrollRef} className="flex flex-col gap-3 px-6 py-4 max-h-80 overflow-y-auto">
                {chatMsgs.length === 0 && chatLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                    Analizando resultados…
                  </div>
                )}
                {chatMsgs.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" && (
                      <img src="/logo.png" alt="SaBot" className="mr-2 mt-1 h-6 w-6 shrink-0 object-contain" />
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "rounded-tr-sm bg-violet-600 text-white"
                        : "rounded-tl-sm bg-muted text-foreground"
                    }`}>
                      {m.role === "user"
                        ? m.content
                        : m.content.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                            part.startsWith("**") && part.endsWith("**")
                              ? <strong key={j}>{part.slice(2, -2)}</strong>
                              : part
                          )
                      }
                    </div>
                  </div>
                ))}
                {chatMsgs.length > 0 && chatLoading && (
                  <div className="flex justify-start">
                    <img src="/logo.png" alt="SaBot" className="mr-2 mt-1 h-6 w-6 shrink-0 object-contain" />
                    <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                    </div>
                  </div>
                )}
                {(chatMsgs.length === 0 || chatMsgs[chatMsgs.length - 1].role === "assistant") && !chatLoading && (
                  <div className="pl-8">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Preguntas frecuentes:</p>
                    <div className="flex flex-wrap gap-2">
                      {chipsPreguntas.map((q) => (
                        <button
                          key={q}
                          onClick={() => enviarChatRef.current(q)}
                          disabled={chatLoading}
                          className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs text-violet-700 hover:bg-violet-100 disabled:opacity-40 transition-colors text-left"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              {/* Input */}
              <div className="border-t border-border px-4 py-3">
                <form
                  onSubmit={(e) => { e.preventDefault(); enviarChat(); }}
                  className="flex gap-2"
                >
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ej: ¿Qué muestra tuvo mejor reacción entre las niñas?"
                    className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-violet-400"
                    disabled={chatLoading}
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="grid h-9 w-9 place-items-center rounded-full bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
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
                        onClick={() => {
                          const opening = isOpen ? null : r.id;
                          setExpandedId(opening);
                          // Al abrir, si tiene IA y no tenemos resumen aún, llamar al endpoint
                          if (opening && r.evaluaciones?.some((ev) => ev.score_ia != null) && !resumenes[r.id]) {
                            setResumenes((prev) => ({ ...prev, [r.id]: { loading: true } }));
                            apiFetch<{ resumen: string; muestra_favorita: number | null }>(
                              `/api/encuestas/${id}/resultados/${r.id}/resumen-participante`,
                              { method: "POST" }
                            ).then((res) => {
                              setResumenes((prev) => ({ ...prev, [r.id]: { loading: false, resumen: res.resumen, muestra_favorita: res.muestra_favorita } }));
                            }).catch(() => {
                              setResumenes((prev) => ({ ...prev, [r.id]: { loading: false } }));
                            });
                          }
                        }}
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
                          {prom && (
                            <span className="text-right">
                              <span className="font-num text-lg font-black">{prom}</span>
                              <span className="text-xs text-muted-foreground"> /5</span>
                              <p className="text-[10px] text-muted-foreground">prom. de calificaciones</p>
                            </span>
                          )}
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

                          {/* Resumen global IA */}
                          {evals.some((ev) => ev.score_ia != null) && (() => {
                            const estado = resumenes[r.id];
                            return (
                              <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
                                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700">
                                  <Brain className="h-3.5 w-3.5" /> Análisis global del participante
                                </p>
                                {!estado || estado.loading ? (
                                  <div className="flex items-center gap-2 text-xs text-violet-600">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando análisis con IA…
                                  </div>
                                ) : estado.resumen ? (
                                  <div className="space-y-1.5">
                                    {estado.muestra_favorita != null && (
                                      <p className="text-sm font-semibold text-violet-900">
                                        Muestra favorita: <span className="rounded-full bg-violet-200 px-2 py-0.5">#{estado.muestra_favorita}</span>
                                      </p>
                                    )}
                                    <p className="text-sm text-violet-900">{estado.resumen}</p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-violet-500 italic">No se pudo generar el análisis.</p>
                                )}
                              </div>
                            );
                          })()}

                          {evals.some((ev) => ev.score_ia != null) && (
                            <div className="mb-3 flex flex-wrap gap-2 text-xs">
                              <span className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5">
                                <span className="text-base">😊</span>
                                <span><strong>Calificación (1–5)</strong> — lo que el participante dijo que le gustó</span>
                              </span>
                              <span className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5">
                                <span className="inline-block rounded-full bg-yellow-100 px-1.5 text-xs font-bold text-yellow-800">IA</span>
                                <span><strong>Score IA (0–100)</strong> — reacción facial captada por la cámara</span>
                              </span>
                              <span className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-amber-800">
                                <span>⚡</span>
                                <span>Si ambos valores difieren mucho, el participante puede estar ocultando su reacción real</span>
                              </span>
                            </div>
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
                                      <th className="pb-2 text-left font-semibold">
                                        Emoción
                                        <span className="ml-1 font-normal text-muted-foreground text-[10px] normal-case">cara</span>
                                      </th>
                                      <th className="pb-2 text-left font-semibold">
                                        Sentimiento
                                        <span className="ml-1 font-normal text-muted-foreground text-[10px] normal-case">voz</span>
                                      </th>
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
                                        ? <span title={ESCALA_LABELS[ev.calificacion]}>{ESCALA_EMOJIS[ev.calificacion]} <strong className="font-num">{ev.calificacion}</strong></span>
                                        : "—"}
                                    </td>
                                    {evals.some((e) => e.score_ia != null) && (
                                      <>
                                        <td className="py-1.5 text-center">
                                          {ev.score_ia != null
                                            ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-num text-xs font-bold ${
                                                ev.score_ia >= 70 ? 'bg-green-100 text-green-800' :
                                                ev.score_ia >= 40 ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-red-100 text-red-800'}`}>{ev.score_ia}</span>
                                            : "—"}
                                        </td>
                                        <td className="py-1.5 text-xs">
                                          {ev.emocion_dominante
                                            ? <button
                                                onClick={() => ev.emociones && setModalEmociones({ emociones: ev.emociones, dominante: ev.emocion_dominante!, muestra: ev.numero_muestra })}
                                                className={`rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 font-medium ${ev.emociones ? "cursor-pointer hover:bg-blue-100 underline decoration-dotted" : "cursor-default"}`}
                                              >{ev.emocion_dominante}</button>
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
                          {evals.some((ev) => ev.resumen_ia || ev.video_url || ev.transcripcion) && (
                            <div className="mt-3 space-y-2">
                              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                <Brain className="h-3.5 w-3.5" /> Resúmenes & Video Claude Vision
                              </p>
                              {evals.filter((ev) => ev.resumen_ia || ev.video_url || ev.transcripcion).map((ev) => (
                                <div key={ev.numero_muestra} className="rounded-lg bg-card border border-border px-3 py-2">
                                  <span className="mr-2 text-xs font-bold text-muted-foreground">#{ev.numero_muestra}</span>
                                  {ev.resumen_ia && <span className="text-xs text-foreground italic">{ev.resumen_ia}</span>}
                                  {ev.transcripcion && (
                                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-gray-600">
                                      <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 font-semibold text-blue-700">Transcripción</span>
                                      <span className="italic">"{ev.transcripcion}"</span>
                                    </p>
                                  )}
                                  {ev.video_url && (
                                    <video
                                      src={`${API_BASE}${ev.video_url}`}
                                      controls
                                      className="mt-2 w-full max-w-xs rounded-lg"
                                      preload="metadata"
                                    />
                                  )}
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

    {/* Modal emociones */}

    {modalEmociones && (() => {
      const EMOCION_COLORS: Record<string, string> = {
        neutral: "#a78bfa", alegria: "#fbbf24", disgusto: "#ef4444",
        tristeza: "#fb923c", sorpresa: "#22d3ee", interes: "#4ade80",
        miedo: "#f472b6", enojo: "#f97316",
      };
      const entries = Object.entries(modalEmociones.emociones)
        .sort(([, a], [, b]) => b - a);
      const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalEmociones(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="font-display font-bold text-sm">Emociones detectadas</p>
                <p className="text-xs text-muted-foreground">Muestra #{modalEmociones.muestra}</p>
              </div>
              <button onClick={() => setModalEmociones(null)} className="rounded-lg p-1.5 hover:bg-muted">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="space-y-2.5 px-5 py-4">
              {entries.map(([emocion, valor]) => {
                const pct = Math.round((valor / total) * 100);
                const color = EMOCION_COLORS[emocion.toLowerCase()] ?? "#94a3b8";
                return (
                  <div key={emocion}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className={`font-medium capitalize${emocion.toLowerCase() === modalEmociones.dominante.toLowerCase() ? " font-bold" : ""}`}>{emocion}</span>
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-gray-100">
                      <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    })()}
    </>
  );
}
