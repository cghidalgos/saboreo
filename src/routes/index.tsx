import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/saboreo/Navbar";
import { Hero } from "@/components/saboreo/Hero";
import { Modules } from "@/components/saboreo/Modules";
import { AIPipeline } from "@/components/saboreo/AIPipeline";
import { Footer } from "@/components/saboreo/Footer";

export const Route = createFileRoute("/")({
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
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main id="plataforma">
        <Hero />
        <Modules />
        <AIPipeline />
      </main>
      <Footer />
    </div>
  );
}
