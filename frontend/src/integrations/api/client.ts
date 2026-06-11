export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

export function setStoredToken(token: string): void {
  localStorage.setItem("auth_token", token);
}

export function clearStoredToken(): void {
  localStorage.removeItem("auth_token");
}

export async function apiFetch<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const method = (opts.method ?? "GET").toUpperCase();

  // El WAF perimetral bloquea PATCH/PUT/DELETE (devuelve 200 con una página HTML
  // "Unauthorized Request Blocked"). Los tunelizamos como POST + cabecera de
  // override; el backend restaura el método real antes de enrutar.
  const tunneled = method === "PATCH" || method === "PUT" || method === "DELETE";

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    method: tunneled ? "POST" : method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tunneled ? { "X-HTTP-Method-Override": method } : {}),
      ...(opts.headers ?? {}),
    },
  });

  const isJson = (res.headers.get("content-type") ?? "").includes("application/json");

  if (!res.ok) {
    const err = isJson ? await res.json().catch(() => ({})) : {};
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  // 204/200 sin cuerpo: éxito sin datos (p. ej. DELETE).
  if (res.status === 204) return {} as T;
  // Un 200 con HTML (no JSON) es, típicamente, la página de bloqueo del WAF:
  // no lo tratamos como éxito o la UI mostraría cambios que nunca se guardaron.
  if (!isJson) {
    throw new Error("Respuesta inesperada del servidor (posible bloqueo del WAF).");
  }
  return (await res.json().catch(() => ({}))) as T;
}
