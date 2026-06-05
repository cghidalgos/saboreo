import { Link } from "@tanstack/react-router";
import { ClipboardCheck, ArrowRight, Star } from "lucide-react";

export interface EncuestaPublica {
  id: string;
  titulo: string;
  descripcion: string | null;
  producto: string;
  num_muestras: number;
  atributos: string[];
  creado_por_nombre: string | null;
  total_respuestas: number;
}

const CARD_GRADIENTS = [
  "from-[#4F86C6] to-[#6B9FD4]",
  "from-[#F4845F] to-[#F6A07A]",
  "from-[#7B5EA7] to-[#9B7EC8]",
  "from-[#3DAA7D] to-[#5DC49A]",
  "from-[#E85D75] to-[#F07D8F]",
  "from-[#F7B731] to-[#F9CA6A]",
];

export function EncuestasActivas({ encuestas }: { encuestas: EncuestaPublica[] }) {
  if (encuestas.length === 0) return null;

  return (
    <section className="relative overflow-hidden bg-[#f8f7f4] py-20">
      {/* Blobs decorativos */}
      <div className="pointer-events-none absolute left-[-5%] top-[10%] h-72 w-72 rounded-full bg-[#4F86C6]/8 blur-3xl" />
      <div className="pointer-events-none absolute right-[-5%] bottom-[10%] h-80 w-80 rounded-full bg-[#F4845F]/8 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Mascota SaBot invitando a participar */}
        <img
          src={`${import.meta.env.BASE_URL}sabot-preguntando.png`}
          alt="SaBot te invita a participar"
          className="pointer-events-none absolute right-0 top-0 hidden w-36 select-none drop-shadow-xl lg:block xl:right-4"
          draggable={false}
        />
        {/* Cabecera */}
        <div className="mb-12 text-center">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#4F86C6]/30 bg-[#4F86C6]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#4F86C6]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#4F86C6]" />
            Paneles activos ahora
          </span>
          <h2 className="font-serif text-4xl font-black leading-tight text-gray-900 md:text-5xl">
            Participa en nuestros<br />
            <span className="bg-gradient-to-r from-[#4F86C6] to-[#F4845F] bg-clip-text text-transparent">
              paneles sensoriales
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-gray-500">
            Tu opinión impulsa el desarrollo de productos más saludables y deliciosos para niños.
          </p>
        </div>

        {/* Contenido */}
        <div className="mx-auto max-w-3xl flex flex-col gap-4">
          {encuestas.map((enc, i) => {
              const grad = CARD_GRADIENTS[i % CARD_GRADIENTS.length];
              return (
                <Link
                  key={enc.id}
                  to="/encuesta/$id"
                  params={{ id: enc.id }}
                  className="group flex items-stretch overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* Banda lateral de color */}
                  <div className={`bg-gradient-to-b ${grad} w-2 flex-shrink-0`} />

                  {/* Icono */}
                  <div className="flex items-center px-5">
                    <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${grad}`}>
                      <ClipboardCheck className="h-5 w-5 text-white" />
                    </div>
                  </div>

                  {/* Info principal */}
                  <div className="flex flex-1 flex-col justify-center gap-1.5 py-5 pr-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-gray-900 leading-snug">{enc.titulo}</h3>
                      <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-bold text-green-700">
                        <Star className="h-2.5 w-2.5" /> Activa
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{enc.producto}</p>
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">
                        {enc.num_muestras} {enc.num_muestras === 1 ? "muestra" : "muestras"}
                      </span>
                      {(enc.atributos ?? []).slice(0, 3).map((a) => (
                        <span key={a} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Lado derecho */}
                  <div className="flex flex-col items-end justify-center gap-1 border-l border-gray-100 px-6 py-5 flex-shrink-0">
                    <span className="text-xs text-gray-400">
                      {enc.total_respuestas} {enc.total_respuestas === 1 ? "evaluación" : "evaluaciones"}
                    </span>
                    <span className="flex items-center gap-1 text-sm font-bold text-[#4F86C6] transition-all group-hover:gap-2">
                      Participar <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

        {/* CTA institucional */}
      </div>
    </section>
  );
}

/** Skeleton mostrado mientras el loader resuelve las encuestas públicas (fallback de streaming SSR). */
export function EncuestasActivasSkeleton() {
  return (
    <section className="relative overflow-hidden bg-[#f8f7f4] py-20">
      <div className="pointer-events-none absolute left-[-5%] top-[10%] h-72 w-72 rounded-full bg-[#4F86C6]/8 blur-3xl" />
      <div className="pointer-events-none absolute right-[-5%] bottom-[10%] h-80 w-80 rounded-full bg-[#F4845F]/8 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#4F86C6]/30 bg-[#4F86C6]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#4F86C6]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#4F86C6]" />
            Paneles activos ahora
          </span>
          <div className="mx-auto mt-3 h-12 w-80 max-w-full animate-pulse rounded-xl bg-gray-200" />
          <div className="mx-auto mt-4 h-4 w-96 max-w-full animate-pulse rounded bg-gray-200/70" />
        </div>

        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-stretch overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
            >
              <div className="w-2 flex-shrink-0 bg-gray-200" />
              <div className="flex items-center px-5">
                <div className="h-11 w-11 flex-shrink-0 animate-pulse rounded-xl bg-gray-200" />
              </div>
              <div className="flex flex-1 flex-col justify-center gap-2 py-5 pr-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-gray-200/70" />
                <div className="mt-1 flex gap-1.5">
                  <div className="h-5 w-20 animate-pulse rounded-full bg-gray-200/70" />
                  <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200/70" />
                </div>
              </div>
              <div className="hidden flex-col items-end justify-center gap-2 border-l border-gray-100 px-6 py-5 sm:flex">
                <div className="h-3 w-16 animate-pulse rounded bg-gray-200/70" />
                <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
