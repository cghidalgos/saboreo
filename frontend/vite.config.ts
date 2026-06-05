import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

const hasCerts = existsSync("certs/key.pem") && existsSync("certs/cert.pem");
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  server: {
    ...(hasCerts
      ? {
          https: {
            key: readFileSync("certs/key.pem"),
            cert: readFileSync("certs/cert.pem"),
          },
        }
      : {}),
    proxy: {
      "/api": { target: "http://backend:9021", changeOrigin: true },
      "/videos": { target: "http://backend:9021", changeOrigin: true },
    },
  },
  plugins: [
    tailwindcss(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      server: { entry: "server" },
    }),
    react(),
  ],
});
