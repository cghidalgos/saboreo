import { ClipboardCheck, Camera, BrainCircuit, FileBarChart2, Users2, FlaskConical, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

const modules = [
  { icon: ClipboardCheck, title: "Encuestas sensoriales", desc: "Consentimiento informado, datos demográficos y escala hedónica facial de 5 puntos.", grad: "bg-gradient-warm" },
  { icon: Camera, title: "Sesiones con cámara", desc: "Grabación sincronizada de video y audio durante la evaluación del producto.", grad: "bg-gradient-fresh" },
  { icon: BrainCircuit, title: "Pipeline IA multimodal", desc: "Whisper para voz, MediaPipe y DeepFace para expresiones. Fusión y score 0–100.", grad: "bg-gradient-cool" },
  { icon: FileBarChart2, title: "Dashboards y reportes", desc: "KPIs en tiempo real, ranking de productos y exportación a PDF, Excel y CSV.", grad: "bg-gradient-warm" },
  { icon: Users2, title: "Gestión por roles", desc: "Administrador, Investigador y Operador con permisos específicos y trazabilidad.", grad: "bg-gradient-fresh" },
  { icon: FlaskConical, title: "Investigaciones y productos", desc: "Organiza campañas, formulaciones (soya, avena, cacao) y resultados comparativos.", grad: "bg-gradient-cool" },
];

export function Modules() {
  return (
    <section id="modulos" className="relative bg-background py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-saboreo-blue">Plataforma completa</span>
          <h2 className="mt-3 font-display text-4xl font-black sm:text-5xl">
            Del consentimiento al insight, en una sola plataforma.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Seis módulos integrados para investigación sensorial infantil con rigor científico
            y una experiencia visual amigable.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((m, i) => (
            <div
              key={m.title}
              className="group relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div className={`grid h-12 w-12 place-items-center rounded-2xl ${m.grad} shadow-soft`}>
                  <m.icon className="h-6 w-6 text-white" strokeWidth={2.2} />
                </div>
                <span className="font-display text-4xl font-black text-muted-foreground/10 leading-none select-none">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold">{m.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{m.desc}</p>
              <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-saboreo-turquoise/10 transition-transform group-hover:scale-150" aria-hidden />
            </div>
          ))}
        </div>

        {/* CTA final */}
        <div className="mt-16 flex flex-col items-center gap-4 rounded-3xl bg-gradient-hero p-10 text-center text-white">
          <p className="font-display text-3xl font-black sm:text-4xl">¿Listo para comenzar?</p>
          <p className="max-w-md text-white/80">Crea tu cuenta en segundos y lanza tu primer panel sensorial hoy mismo.</p>
          <Link
            to="/auth"
            search={{ mode: "signup" as const, redirect: "/dashboard" }}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-saboreo-yellow px-8 py-3 text-sm font-bold text-foreground shadow-soft transition-transform hover:scale-[1.03]"
          >
            Crear cuenta gratis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
