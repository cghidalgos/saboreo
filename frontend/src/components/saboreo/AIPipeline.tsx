import { Fragment } from "react";
import { Mic, ScanFace, Sparkles, Gauge, ArrowRight } from "lucide-react";

const steps = [
  { icon: Mic, title: "Voz", desc: "Whisper transcribe el audio y un modelo de sentimiento clasifica de muy negativo a muy positivo.", color: "text-saboreo-blue", bg: "bg-saboreo-blue/10", border: "border-saboreo-blue/30" },
  { icon: ScanFace, title: "Rostro", desc: "MediaPipe + DeepFace detectan alegría, sorpresa, asco, tristeza, neutralidad e interés.", color: "text-saboreo-purple", bg: "bg-saboreo-purple/10", border: "border-saboreo-purple/30" },
  { icon: Sparkles, title: "Fusión", desc: "Combinamos voz, texto y expresiones en un modelo multimodal con pesos calibrados.", color: "text-saboreo-orange", bg: "bg-saboreo-orange/10", border: "border-saboreo-orange/30" },
  { icon: Gauge, title: "Índice SABOREO", desc: "Score interpretable 0–100 con conclusión automática del nivel de aceptación.", color: "text-saboreo-green", bg: "bg-saboreo-green/10", border: "border-saboreo-green/30" },
];

export function AIPipeline() {
  return (
    <section id="ia" className="relative overflow-hidden bg-foreground py-24 text-background">
      <div className="blob left-[10%] top-[20%] h-72 w-72 bg-saboreo-purple opacity-30" aria-hidden />
      <div className="blob right-[5%] bottom-[10%] h-80 w-80 bg-saboreo-turquoise opacity-30" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-saboreo-yellow">IA multimodal</span>
          <h2 className="mt-3 font-display text-3xl font-black sm:text-4xl sm:text-5xl">
            Un pipeline diseñado para la <span className="bg-gradient-warm bg-clip-text text-transparent">ciencia sensorial</span>.
          </h2>
          <p className="mt-4 text-lg text-background/70">
            Arquitectura modular que integra análisis de voz, sentimiento y reconocimiento facial
            en un único score científico.
          </p>
        </div>

        {/* Steps con flechas */}
        <div className="mt-14 flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0">
          {steps.map((s, i) => (
            <Fragment key={s.title}>
              <li className={`relative flex-1 list-none rounded-3xl border ${s.border} bg-white/5 p-5 sm:p-6 backdrop-blur transition-transform hover:-translate-y-1`}>
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${s.bg} ${s.color}`}>
                  <s.icon className="h-6 w-6" />
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-xs font-bold text-background/40">0{i + 1}</span>
                  <h3 className={`font-display text-xl font-bold ${s.color}`}>{s.title}</h3>
                </div>
                <p className="mt-2 text-sm text-background/70">{s.desc}</p>
              </li>
              {i < steps.length - 1 && (
                <div className="flex shrink-0 items-center justify-center py-1 lg:px-2 lg:py-0">
                  <ArrowRight className="h-5 w-5 rotate-90 text-white/30 lg:rotate-0" />
                </div>
              )}
            </Fragment>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 md:grid-cols-3 lg:grid-cols-5">
          {[
            { r: "0–20", l: "Rechazo fuerte", c: "bg-saboreo-red" },
            { r: "21–40", l: "Poca aceptación", c: "bg-saboreo-orange" },
            { r: "41–60", l: "Aceptación moderada", c: "bg-saboreo-yellow" },
            { r: "61–80", l: "Buena aceptación", c: "bg-saboreo-sky" },
            { r: "81–100", l: "Alta aceptación", c: "bg-saboreo-green" },
          ].map((x) => (
            <div key={x.r} className="rounded-2xl bg-background/5 p-4">
              <div className={`h-1.5 w-10 rounded-full ${x.c}`} />
              <p className="mt-2 font-display text-2xl font-black">{x.r}</p>
              <p className="text-xs uppercase tracking-wider text-background/60">{x.l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
