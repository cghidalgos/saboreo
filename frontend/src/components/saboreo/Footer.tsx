import { Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-8">
      <div className="mx-auto max-w-7xl px-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} SABOREO · Todos los derechos reservados.
        </p>
        <div className="text-center text-xs text-muted-foreground sm:text-right">
          <p className="font-medium text-foreground">Información de contacto</p>
          <p>Diana Paola Navia Porras</p>
          <p>
            <a href="mailto:dpnavia@usbcali.edu.co" className="text-primary hover:underline">
              dpnavia@usbcali.edu.co
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
