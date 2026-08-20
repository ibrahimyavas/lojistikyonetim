import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import worker from "./worker/index.js";
import { createD1Database } from "./server/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  const envConfig = {
    AUTH_PASSWORD: process.env.AUTH_PASSWORD || "admin",
    SESSION_SECRET: process.env.SESSION_SECRET || "lojistik-session-secret-key-2026",
    DRIVER_PIN_PEPPER: process.env.DRIVER_PIN_PEPPER || "driver-pepper-secret-2026",
    DRIVER_TOKEN_SECRET: process.env.DRIVER_TOKEN_SECRET || "driver-token-secret-2026",
  };

  // Initialize SQLite D1 Database adapter
  const db = await createD1Database(envConfig);

  const env = {
    DB: db,
    ...envConfig,
  };

  // API Route Handler -> Cloudflare Worker fetch bridge
  app.all(["/api", "/api/*all"], async (req, res) => {
    try {
      const protocol = req.protocol || "http";
      const host = req.get("host") || `localhost:${PORT}`;
      const fullUrl = `${protocol}://${host}${req.originalUrl}`;

      let body = undefined;
      if (req.method !== "GET" && req.method !== "HEAD") {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        if (chunks.length > 0) {
          body = Buffer.concat(chunks);
        }
      }

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            for (const v of value) headers.append(key, v);
          } else {
            headers.set(key, value);
          }
        }
      }

      const webRequest = new Request(fullUrl, {
        method: req.method,
        headers,
        body,
        // @ts-ignore
        duplex: "half",
      });

      const webResponse = await worker.fetch(webRequest, env);

      res.status(webResponse.status);

      // Forward headers from web response to Express response
      webResponse.headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") {
          res.append(key, value);
        } else {
          res.set(key, value);
        }
      });

      const responseBuffer = await webResponse.arrayBuffer();
      res.send(Buffer.from(responseBuffer));
    } catch (err) {
      console.error("API error:", err);
      res.status(500).json({ error: err?.message || "Sunucu hatası." });
    }
  });

  // Frontend Serving (Vite middleware in Dev, Static in Prod)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: "0.0.0.0",
        port: PORT,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lojistik yönetim sistemi http://0.0.0.0:${PORT} üzerinde çalışıyor.`);
  });
}

startServer();
