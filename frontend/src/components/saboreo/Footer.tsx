import { Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-warm">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display text-lg font-black">SABOREO</span>
          <span className="text-xs text-muted-foreground">· Research Lab</span>
        </div>
        <p className="text-center text-xs text-muted-foreground md:text-right">
          © {new Date().getFullYear()} SABOREO · Inteligencia Artificial para comprender el sabor
          desde la percepción infantil.
        </p>
      </div>
    </footer>
  );
}
