import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Sparkles, Mail, Lock, User as UserIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, setStoredToken, getStoredToken } from "@/integrations/api/client";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional().catch("login"),
  redirect: z.string().optional().catch("/dashboard"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    if (typeof window === "undefined") return;
    const token = getStoredToken();
    if (token) throw redirect({ to: search.redirect ?? "/dashboard" });
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
        await apiFetch("/api/auth/signup", {
          method: "POST",
          body: JSON.stringify({
            email: parsed.data.email,
            password: parsed.data.password,
            fullName: parsed.data.fullName,
          }),
        });
        toast.success("Cuenta creada. Ya puedes iniciar sesión.");
        navigate({ to: "/auth", search: { mode: "login", redirect: redirectTo } });
      } else {
        const { token } = await apiFetch<{ token: string }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: parsed.data.email, password: parsed.data.password }),
        });
        setStoredToken(token);
        window.dispatchEvent(new CustomEvent("auth-change"));
        toast.success("¡Bienvenido a SABOREO!");
        navigate({ to: redirectTo });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setLoading(false);
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

            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              {isSignup && (
                <Field
                  icon={UserIcon}
                  type="text"
                  placeholder="Nombre completo"
                  value={fullName}
                  onChange={setFullName}
                  autoComplete="name"
                />
              )}
              <Field
                icon={Mail}
                type="email"
                placeholder="correo@institucion.edu"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />
              <Field
                icon={Lock}
                type="password"
                placeholder="Contraseña (mín. 8 caracteres)"
                value={password}
                onChange={setPassword}
                autoComplete={isSignup ? "new-password" : "current-password"}
              />

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
  icon: Icon,
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  icon: typeof Mail;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
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
