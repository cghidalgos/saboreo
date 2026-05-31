import { Link } from "@tanstack/react-router";
import { ArrowRight, Play, Mic, Camera, Brain } from "lucide-react";

const faces = ["😖", "😕", "😐", "🙂", "🤩"];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Fondo turquesa con blobs */}
      <div className="absolute inset-0 bg-gradient-hero opacity-[0.92]" aria-hidden />
      <div className="blob left-[-8%] top-[10%] h-72 w-72 bg-saboreo-yellow" aria-hidden />
      <div className="blob right-[-6%] top-[25%] h-80 w-80 bg-saboreo-red" aria-hidden />
      <div className="blob left-[30%] bottom-[-10%] h-96 w-96 bg-saboreo-purple" aria-hidden />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-6 pb-24 pt-16 md:grid-cols-12 md:pt-24">
        <div className="md:col-span-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-saboreo-yellow" />
            Investigación científica · IA multimodal
          </span>

          <h1 className="mt-6 text-balance font-display text-5xl font-black leading-[0.95] text-white sm:text-6xl md:text-7xl">
            Inteligencia Artificial para comprender el{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-warm bg-clip-text text-transparent">sabor</span>
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                <path d="M2 9C40 3 100 3 198 8" stroke="#F6D21F" strokeWidth="4" strokeLinecap="round"/>
              </svg>
            </span>{" "}
            desde la percepción infantil.
          </h1>

          <p className="mt-6 max-w-xl text-lg text-white/85">
            SABOREO analiza voz, emociones y expresiones faciales de niños evaluando
            alimentos funcionales de <strong>soya, avena y cacao</strong>. Una plataforma
            científica con IA para investigadores, docentes y laboratorios.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/dashboard"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-foreground shadow-glow transition-transform hover:scale-[1.03]"
            >
              Abrir dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <button className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20">
              <Play className="h-4 w-4 fill-current" /> Ver demo (2 min)
            </button>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-6 text-xs uppercase tracking-wider text-white/75">
            <div className="flex items-center gap-2"><Mic className="h-4 w-4" /> Whisper · Voz</div>
            <div className="flex items-center gap-2"><Camera className="h-4 w-4" /> MediaPipe · DeepFace</div>
            <div className="flex items-center gap-2"><Brain className="h-4 w-4" /> Fusión multimodal</div>
          </div>
        </div>

        {/* Mock card escala hedónica */}
        <div className="md:col-span-5">
          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-white/20 blur-2xl" aria-hidden />
            <div className="relative rounded-[2rem] border border-white/40 bg-white/95 p-6 shadow-glow backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sesión en vivo</p>
                  <p className="font-display text-2xl font-bold">Galleta de cacao + avena</p>
                </div>
                <div className="relative">
                  <div className="h-3 w-3 rounded-full bg-saboreo-red animate-pulse-ring" />
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-gradient-cool p-5 text-white">
                <p className="text-xs uppercase tracking-wider opacity-80">Índice SABOREO</p>
                <div className="mt-1 flex items-end gap-2">
                  <span className="font-display text-6xl font-black leading-none">87</span>
                  <span className="mb-2 text-sm font-semibold opacity-90">/ 100</span>
                </div>
                <p className="mt-1 text-sm font-medium">Alta aceptación</p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
                  <div className="h-full w-[87%] rounded-full bg-saboreo-yellow" />
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Escala hedónica facial</p>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {faces.map((f, i) => (
                    <div
                      key={i}
                      className={`grid aspect-square place-items-center rounded-xl text-2xl transition-transform ${
                        i === 4 ? "bg-saboreo-yellow scale-110 shadow-soft" : "bg-muted"
                      }`}
                    >
                      {f}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Odio</span><span>Me encantó</span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                {[
                  { l: "Alegría", v: "78%", c: "bg-saboreo-yellow" },
                  { l: "Sorpresa", v: "12%", c: "bg-saboreo-sky" },
                  { l: "Neutral", v: "10%", c: "bg-muted" },
                ].map((e) => (
                  <div key={e.l} className="rounded-xl border border-border p-2.5">
                    <div className={`mx-auto h-1.5 w-8 rounded-full ${e.c}`} />
                    <p className="mt-1.5 text-lg font-bold">{e.v}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{e.l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
