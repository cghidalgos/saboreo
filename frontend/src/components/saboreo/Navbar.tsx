import { Link } from "@tanstack/react-router";
import { LayoutDashboard, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function Navbar() {
  const { user, profile, signOut } = useAuth();
  const displayName = profile?.full_name ?? user?.email?.split("@")[0] ?? "";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="SABOREO" className="h-10 w-10 object-contain" />
          <div className="flex flex-col leading-none">
            <span className="font-serif text-xl font-black tracking-tight">SABOREO</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background hover:scale-[1.02]"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <div className="hidden items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold sm:flex">
                <UserIcon className="h-3.5 w-3.5" />
                {displayName}
              </div>
              <button
                onClick={() => signOut()}
                title="Cerrar sesión"
                className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-accent"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                search={{ mode: "login" as const, redirect: "/dashboard" }}
                className="hidden rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent sm:inline-flex"
              >
                Iniciar sesión
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
