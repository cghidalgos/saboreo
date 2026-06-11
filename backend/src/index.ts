import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { mkdirSync } from "fs";
import { authRouter } from "./routes/auth.js";
import { encuestasRouter } from "./routes/encuestas.js";
import { sesionesRouter } from "./routes/sesiones.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { resultadosRouter } from "./routes/resultados.js";
import { consentimientosRouter } from "./routes/consentimientos.js";

const app = express();
const PORT = process.env.PORT ?? 9021;

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:9020" }));
// El análisis de video envía hasta 8 fotogramas JPEG en base64 dentro del cuerpo
// JSON (~80-200 kb), lo que supera el límite por defecto de express.json (100 kb)
// y provocaba PayloadTooLargeError → el análisis IA fallaba y score_ia quedaba en
// NULL, ocultando toda la sección de IA en los resultados. Subimos el límite a 10 MB.
app.use(express.json({ limit: "10mb" }));

// El WAF perimetral de la universidad bloquea PATCH/PUT/DELETE (responde una
// página HTML "Unauthorized Request Blocked" con HTTP 200, sin llegar al backend).
// El frontend los envía como POST con la cabecera X-HTTP-Method-Override y aquí
// restauramos el método real antes del enrutado, para conservar la semántica REST.
app.use((req, _res, next) => {
  const override = req.headers["x-http-method-override"];
  if (req.method === "POST" && typeof override === "string") {
    const m = override.toUpperCase();
    if (m === "PATCH" || m === "PUT" || m === "DELETE") req.method = m;
  }
  next();
});

// Serve uploaded videos
const videosDir = path.join(process.cwd(), "uploads", "videos");
mkdirSync(videosDir, { recursive: true });
app.use("/videos", express.static(videosDir));

app.use("/api/auth", authRouter);
app.use("/api/encuestas", encuestasRouter);
app.use("/api/sesiones", sesionesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/encuestas/:id/resultados", resultadosRouter);
app.use("/api/consentimientos", consentimientosRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
