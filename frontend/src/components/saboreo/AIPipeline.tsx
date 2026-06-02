import { Fragment } from "react";
import { Mic, ScanFace, Sparkles, Gauge, ArrowRight } from "lucide-react";

const steps = [
  { icon: Mic,      title: "Voz",            desc: "Escuchamos lo que dice el niño al probar el alimento y detectamos si su reacción es positiva o negativa.",                         color: "text-saboreo-blue",   bg: "bg-saboreo-blue/10",   border: "border-saboreo-blue/30"   },
  { icon: ScanFace, title: "Rostro",          desc: "La cámara capta sus expresiones faciales: alegría, sorpresa, disgusto, tristeza y más.",                                           color: "text-saboreo-purple", bg: "bg-saboreo-purple/10", border: "border-saboreo-purple/30" },
  { icon: Sparkles, title: "Fusión",          desc: "Combinamos lo que dice, cómo lo dice y cómo reacciona su cara para obtener un resultado completo.",                                color: "text-saboreo-orange", bg: "bg-saboreo-orange/10", border: "border-saboreo-orange/30" },
  { icon: Gauge,    title: "Índice SABOREO",  desc: "Un número del 0 al 100 que resume qué tan bien aceptó el niño el alimento, con una conclusión clara y fácil de leer.",            color: "text-saboreo-green",  bg: "bg-saboreo-green/10",  border: "border-saboreo-green/30"  },
];

export function AIPipeline() {
  return (
    <section id="ia" className="relative overflow-hidden bg-foreground py-24 text-background">
      <div className="absolute inset-0 bg-gradient-hero opacity-30" aria-hidden />
      <div className="blob left-[10%] top-[20%] h-72 w-72 bg-saboreo-purple opacity-30" aria-hidden />
      <div className="blob right-[5%] bottom-[10%] h-80 w-80 bg-saboreo-turquoise opacity-30" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-saboreo-yellow">¿Cómo funciona?</span>
          <h2 className="mt-3 font-serif text-3xl font-black text-white sm:text-4xl sm:text-5xl">
            Así analizamos la reacción de <span className="text-saboreo-yellow">cada niño</span>.
          </h2>
          <p className="mt-4 text-lg text-white/75">
            Grabamos su voz y expresiones al probar el alimento, y nuestra IA transforma esas reacciones en un puntaje de aceptación fácil de interpretar.
          </p>
        </div>

        {/* Steps con flechas */}
        <div className="mt-14 flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0">
          {steps.map((s, i) => (
            <Fragment key={s.title}>
              <li className={`relative flex-1 list-none rounded-3xl border border-white/20 bg-white/10 p-5 sm:p-6 backdrop-blur transition-transform hover:-translate-y-1`}>
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 text-white`}>
                  <s.icon className="h-6 w-6" />
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-serif text-xs font-bold text-white/40">0{i + 1}</span>
                  <h3 className="font-serif text-xl font-bold text-white">{s.title}</h3>
                </div>
                <p className="mt-2 text-sm text-white/70">{s.desc}</p>
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
            { r: "0–20",   l: "No le gustó nada",   c: "bg-saboreo-red"    },
            { r: "21–40",  l: "No le gustó mucho",  c: "bg-saboreo-orange" },
            { r: "41–60",  l: "Le pareció regular",  c: "bg-saboreo-yellow" },
            { r: "61–80",  l: "Le gustó",            c: "bg-saboreo-sky"    },
            { r: "81–100", l: "Le encantó",          c: "bg-saboreo-green"  },
          ].map((x) => (
            <div key={x.r} className="rounded-2xl bg-white/5 p-4">
              <div className={`h-1.5 w-10 rounded-full ${x.c}`} />
              <p className="mt-2 font-serif text-2xl font-black text-white">{x.r}</p>
              <p className="text-xs uppercase tracking-wider text-white/60">{x.l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
