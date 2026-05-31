import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Sparkles, Mail, Lock, User as UserIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional().catch("login"),
  redirect: z.string().optional().catch("/dashboard"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      throw redirect({ to: search.redirect ?? "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Acceder · SABOREO" },
      { name: "description", content: "Inicia sesión o crea tu cuenta en SABOREO." },
    ],
  }),
  component: AuthPage,
});

const credentialsSchema = z.object({
  email: z.string().trim().email("Correo inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
  fullName: z.string().trim().min(2, "Ingresa tu nombre").max(120).optional(),
});

function AuthPage() {
  const { mode = "login", redirect: redirectTo = "/dashboard" } = Route.useSearch();
  const navigate = useNavigate();
  const isSignup = mode === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = credentialsSchema.safeParse({
      email,
      password,
      fullName: isSignup ? fullName : undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: parsed.data.fullName },
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Revisa tu correo para verificarla.");
        navigate({ to: "/auth", search: { mode: "login", redirect: redirectTo } });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success("¡Bienvenido a SABOREO!");
        navigate({ to: redirectTo });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de autenticación";
      toast.error(msg.includes("Invalid login") ? "Correo o contraseña inválidos" : msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + redirectTo,
      });
      if (result.error) {
        toast.error("No se pudo iniciar sesión con Google");
        return;
      }
      if (result.redirected) return;
      navigate({ to: redirectTo });
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-hero opacity-95" aria-hidden />
      <div className="blob left-[-8%] top-[10%] h-72 w-72 bg-saboreo-yellow" aria-hidden />
      <div className="blob right-[-6%] bottom-[10%] h-80 w-80 bg-saboreo-red" aria-hidden />

      <div className="relative mx-auto grid min-h-screen max-w-6xl place-items-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center justify-center gap-2 text-white">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-warm shadow-soft">
              <Sparkles className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-display text-2xl font-black">SABOREO</span>
          </Link>

          <div className="rounded-3xl border border-white/40 bg-white/95 p-8 shadow-glow backdrop-blur-xl">
            <h1 className="font-display text-3xl font-black">
              {isSignup ? "Crear cuenta" : "Iniciar sesión"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {isSignup
                ? "Únete al equipo de investigación sensorial."
                : "Accede al panel científico de SABOREO."}
            </p>

            <button
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold transition-colors hover:bg-accent disabled:opacity-60"
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              )}
              Continuar con Google
            </button>

            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
              <div className="h-px flex-1 bg-border" />o<div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {isSignup && (
                <Field icon={UserIcon} type="text" placeholder="Nombre completo" value={fullName} onChange={setFullName} autoComplete="name" />
              )}
              <Field icon={Mail} type="email" placeholder="correo@institucion.edu" value={email} onChange={setEmail} autoComplete="email" />
              <Field icon={Lock} type="password" placeholder="Contraseña (mín. 8 caracteres)" value={password} onChange={setPassword} autoComplete={isSignup ? "new-password" : "current-password"} />

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background transition-transform hover:scale-[1.01] disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSignup ? "Crear cuenta" : "Entrar"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              {isSignup ? "¿Ya tienes cuenta? " : "¿Primera vez en SABOREO? "}
              <Link
                to="/auth"
                search={{ mode: isSignup ? "login" : "signup", redirect: redirectTo }}
                className="font-semibold text-saboreo-blue hover:underline"
              >
                {isSignup ? "Inicia sesión" : "Crea una cuenta"}
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-white/75">
            Al continuar aceptas el manejo confidencial de datos de investigación.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon, type, placeholder, value, onChange, autoComplete,
}: {
  icon: typeof Mail; type: string; placeholder: string;
  value: string; onChange: (v: string) => void; autoComplete?: string;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="w-full rounded-full border border-input bg-background px-4 py-3 pl-11 text-sm outline-none ring-saboreo-turquoise transition-all focus:border-saboreo-turquoise focus:ring-2"
      />
    </div>
  );
}
