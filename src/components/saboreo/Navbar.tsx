import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-warm shadow-soft">
            <Sparkles className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-xl font-black tracking-tight">SABOREO</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">research lab</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          <a href="#plataforma" className="text-muted-foreground transition-colors hover:text-foreground">Plataforma</a>
          <a href="#modulos" className="text-muted-foreground transition-colors hover:text-foreground">Módulos</a>
          <a href="#ia" className="text-muted-foreground transition-colors hover:text-foreground">IA multimodal</a>
          <a href="#equipo" className="text-muted-foreground transition-colors hover:text-foreground">Investigación</a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/dashboard"
            className="hidden rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent sm:inline-flex"
          >
            Iniciar sesión
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:scale-[1.02]"
          >
            Abrir dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}
