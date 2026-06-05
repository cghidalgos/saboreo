import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { resolve, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = process.env.PORT ?? 9020;
const BASE = "/saboreo";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const clientDir = resolve(__dirname, "dist/client");

const MIME = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
};

const { default: handler } = await import("./dist/server/server.js");

createServer(async (req, res) => {
  const url = req.url ?? "/";

  // Strip base prefix for static file lookup
  const stripBase = url.startsWith(BASE + "/") ? url.slice(BASE.length) : url;
  const filePath = join(clientDir, stripBase.split("?")[0]);

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath).toLowerCase();
    const mime = MIME[ext] ?? "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": mime,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    });
    createReadStream(filePath).pipe(res);
    return;
  }

  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  const proto = req.headers["x-forwarded-proto"] ?? "http";
  const fullUrl = `${proto}://${host}${url}`;

  const body =
    req.method !== "GET" && req.method !== "HEAD"
      ? new ReadableStream({
          start(ctrl) {
            req.on("data", (chunk) => ctrl.enqueue(chunk));
            req.on("end", () => ctrl.close());
            req.on("error", (err) => ctrl.error(err));
          },
        })
      : undefined;

  const request = new Request(fullUrl, {
    method: req.method,
    headers: req.headers,
    body,
    duplex: "half",
  });

  try {
    const response = await handler.fetch(request, {}, {});
    res.writeHead(
      response.status,
      response.statusText,
      Object.fromEntries(response.headers.entries())
    );
    if (response.body) {
      const buf = await response.arrayBuffer();
      res.end(Buffer.from(buf));
    } else {
      res.end();
    }
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
}).listen(PORT, () => {
  console.log(`Frontend server running on http://0.0.0.0:${PORT}`);
});
