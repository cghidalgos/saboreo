import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { encuestasRouter } from "./routes/encuestas.js";
import { sesionesRouter } from "./routes/sesiones.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { resultadosRouter } from "./routes/resultados.js";
import { consentimientosRouter } from "./routes/consentimientos.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" }));
app.use(express.json());

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
