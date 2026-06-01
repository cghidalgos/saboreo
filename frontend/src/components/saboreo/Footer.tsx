import { Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-6">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} SABOREO · Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
