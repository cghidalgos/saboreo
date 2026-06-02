import { Suspense } from "react";
import { createFileRoute, Await } from "@tanstack/react-router";
import { Navbar } from "@/components/saboreo/Navbar";
import { Hero } from "@/components/saboreo/Hero";
import { EncuestasActivas, EncuestasActivasSkeleton, type EncuestaPublica } from "@/components/saboreo/EncuestasActivas";
import { AIPipeline } from "@/components/saboreo/AIPipeline";
import { Footer } from "@/components/saboreo/Footer";

// Fetch de paneles públicos consciente de SSR:
//   - en el navegador usamos una URL relativa (la sirve el proxy de Vite → backend)
//   - en el servidor (SSR) hay que llamar directo al backend (no hay origin relativo)
function publicEncuestasUrl(): string {
  if (import.meta.env.SSR) {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    const base = env?.BACKEND_INTERNAL_URL ?? "http://backend:9021";
    return `${base}/api/encuestas/publicas`;
  }
  return "/api/encuestas/publicas";
}

async function fetchEncuestasPublicas(): Promise<EncuestaPublica[]> {
  try {
    const res = await fetch(publicEncuestasUrl());
    if (!res.ok) return [];
    return (await res.json()) as EncuestaPublica[];
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/")({
  // El loader arranca el fetch en el SERVIDOR durante el SSR. Al devolver la
  // promesa sin await, TanStack la difiere y hace streaming: la página se pinta
  // de inmediato y la sección de paneles llega en cuanto resuelve (sin esperar a
  // hidratar el bundle ni a que arranque un fetch en el cliente).
  loader: () => ({ encuestasPromise: fetchEncuestasPublicas() }),
  staleTime: 30_000,
  head: () => ({
    meta: [
      { title: "SABOREO — IA sensorial infantil" },
      { name: "description", content: "Plataforma científica de análisis sensorial infantil con IA multimodal: voz, expresiones faciales y aceptación de alimentos funcionales." },
      { property: "og:title", content: "SABOREO — IA sensorial infantil" },
      { property: "og:description", content: "Investigación sensorial con IA para soya, avena y cacao." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { encuestasPromise } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main id="plataforma">
        <Hero />
        <Suspense fallback={<EncuestasActivasSkeleton />}>
          <Await promise={encuestasPromise}>
            {(encuestas) => <EncuestasActivas encuestas={encuestas} />}
          </Await>
        </Suspense>
        <AIPipeline />
      </main>
      <Footer />
    </div>
  );
}
