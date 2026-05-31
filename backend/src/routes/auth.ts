import { Router, type Request, type Response, type NextFunction } from "express";
import { pool } from "../db.js";
import { signToken, verifyToken, hashPassword, checkPassword } from "../lib/jwt.js";
import { z } from "zod";

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

const router = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────

const signupSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  fullName: z.string().trim().min(2).max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ── Middleware de autenticación ───────────────────────────────────────────────

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  try {
    const payload = verifyToken(auth.replace("Bearer ", ""));
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ message: "Token inválido o expirado" });
  }
}

// ── POST /api/auth/signup ─────────────────────────────────────────────────────

router.post("/signup", async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0].message });
    return;
  }
  const { email, password, fullName } = parsed.data;

  const existing = await pool.query("SELECT id FROM profiles WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    res.status(400).json({ message: "El correo ya está registrado" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const name = fullName ?? email.split("@")[0];

  const { rows } = await pool.query(
    "INSERT INTO profiles (email, full_name, password_hash) VALUES ($1, $2, $3) RETURNING id",
    [email, name, passwordHash],
  );
  const userId: string = rows[0].id;

  await pool.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'investigador')", [userId]);

  const token = signToken({ sub: userId, email });
  res.status(201).json({ token, user: { id: userId, email, full_name: name } });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────

router.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0].message });
    return;
  }
  const { email, password } = parsed.data;

  const { rows } = await pool.query(
    "SELECT id, email, full_name, password_hash FROM profiles WHERE email = $1",
    [email],
  );
  if (rows.length === 0) {
    res.status(401).json({ message: "Correo o contraseña inválidos" });
    return;
  }

  const user = rows[0];
  const valid = await checkPassword(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ message: "Correo o contraseña inválidos" });
    return;
  }

  const token = signToken({ sub: user.id, email: user.email });
  res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name } });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  const [profileResult, rolesResult] = await Promise.all([
    pool.query(
      "SELECT id, email, full_name, avatar_url, institution FROM profiles WHERE id = $1",
      [req.userId],
    ),
    pool.query("SELECT role FROM user_roles WHERE user_id = $1", [req.userId]),
  ]);

  if (profileResult.rows.length === 0) {
    res.status(404).json({ message: "Usuario no encontrado" });
    return;
  }

  res.json({
    ...profileResult.rows[0],
    roles: rolesResult.rows.map((r: { role: string }) => r.role),
  });
});

// ── PATCH /api/auth/profile ───────────────────────────────────────────────────

router.patch("/profile", requireAuth, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    full_name: z.string().trim().min(1).max(120).optional(),
    avatar_url: z.string().url().optional(),
    institution: z.string().trim().max(200).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0].message });
    return;
  }

  const fields = Object.entries(parsed.data).filter(([, v]) => v !== undefined);
  if (fields.length === 0) {
    res.json({ message: "Sin cambios" });
    return;
  }

  const setClause = fields.map(([k], i) => `${k} = $${i + 2}`).join(", ");
  const values = fields.map(([, v]) => v);

  const { rows } = await pool.query(
    `UPDATE profiles SET ${setClause} WHERE id = $1 RETURNING id, email, full_name, avatar_url, institution`,
    [req.userId, ...values],
  );
  res.json(rows[0]);
});

export { router as authRouter };
