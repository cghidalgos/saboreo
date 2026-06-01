import { Link, useNavigate } from "@tanstack/react-router";
import {
  Sparkles, LayoutDashboard, ClipboardCheck, Video,
  LogOut, ChevronRight, Menu, X, FileText,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth, ROLE_LABEL } from "@/hooks/use-auth";
import { toast } from "sonner";

const NAV = [
  { to: "/dashboard",        label: "Dashboard",           icon: LayoutDashboard },
  { to: "/encuestas",        label: "Encuestas",            icon: ClipboardCheck  },
  { to: "/consentimientos",  label: "Consentimientos",      icon: FileText        },
  { to: "/sesion",           label: "Sesión con cámara",    icon: Video           },
] as const;

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  const { profile, user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const displayName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Usuario";
  const initials = displayName.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  async function handleSignOut() {
    await signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/" });
  }

  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";

  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-background transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-warm shadow-soft">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-lg font-black tracking-tight">SABOREO</span>
            <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">research lab</span>
          </div>
          <button
            className="ml-auto lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = currentPath === to || currentPath.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                {active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-cool text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                {roles.length ? roles.map((r) => ROLE_LABEL[r]).join(" · ") : "Sin rol"}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              title="Cerrar sesión"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <button
            className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-accent lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-bold leading-tight">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
