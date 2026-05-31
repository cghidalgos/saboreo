import { Mic, ScanFace, Sparkles, Gauge } from "lucide-react";

const steps = [
  { icon: Mic, title: "Voz", desc: "Whisper transcribe el audio y un modelo de sentimiento clasifica de muy negativo a muy positivo.", color: "text-saboreo-blue", bg: "bg-saboreo-blue/10" },
  { icon: ScanFace, title: "Rostro", desc: "MediaPipe + DeepFace detectan alegría, sorpresa, asco, tristeza, neutralidad e interés.", color: "text-saboreo-purple", bg: "bg-saboreo-purple/10" },
  { icon: Sparkles, title: "Fusión", desc: "Combinamos voz, texto y expresiones en un modelo multimodal con pesos calibrados.", color: "text-saboreo-orange", bg: "bg-saboreo-orange/10" },
  { icon: Gauge, title: "Índice SABOREO", desc: "Score interpretable 0–100 con conclusión automática del nivel de aceptación.", color: "text-saboreo-green", bg: "bg-saboreo-green/10" },
];

export function AIPipeline() {
  return (
    <section id="ia" className="relative overflow-hidden bg-foreground py-24 text-background">
      <div className="blob left-[10%] top-[20%] h-72 w-72 bg-saboreo-purple opacity-30" aria-hidden />
      <div className="blob right-[5%] bottom-[10%] h-80 w-80 bg-saboreo-turquoise opacity-30" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-saboreo-yellow">IA multimodal</span>
          <h2 className="mt-3 font-display text-4xl font-black sm:text-5xl">
            Un pipeline diseñado para la <span className="bg-gradient-warm bg-clip-text text-transparent">ciencia sensorial</span>.
          </h2>
          <p className="mt-4 text-lg text-background/70">
            Arquitectura modular preparada para integrar modelos de voz, sentimiento y
            reconocimiento facial en fases posteriores.
          </p>
        </div>

        <ol className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${s.bg} ${s.color}`}>
                <s.icon className="h-6 w-6" />
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-xs font-bold text-background/40">0{i + 1}</span>
                <h3 className="font-display text-xl font-bold">{s.title}</h3>
              </div>
              <p className="mt-2 text-sm text-background/70">{s.desc}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 md:grid-cols-5">
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
