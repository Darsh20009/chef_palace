import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { type Server } from "http";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STAFF_PATHS = ['/employee', '/manager', '/kitchen', '/pos', '/cashier', '/admin', '/owner', '/executive', '/0'];

function isStaffPath(url: string): boolean {
  const pathname = url.split('?')[0];
  return STAFF_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}

function injectStaffManifest(html: string): string {
  return html
    .replace(
      /href="\/manifest\.json[^"]*" id="main-manifest"/,
      'href="/employee-manifest.json" id="main-manifest"'
    )
    .replace(
      /<meta name="apple-mobile-web-app-title" content="[^"]*">/,
      '<meta name="apple-mobile-web-app-title" content="مكان الشيف البخاري">'
    )
    .replace(
      /<meta name="application-name" content="[^"]*">/,
      '<meta name="application-name" content="مكان الشيف — الإدارة">'
    )
    .replace(
      /href="\/apple-touch-icon\.png[^"]*"/g,
      'href="/employee-logo-512.png"'
    )
    .replace(
      /href="\/logo\.png"(?= media=")/g,
      'href="/employee-logo-512.png"'
    );
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Dynamic import — vite is only loaded in development, never bundled into production
  const { createServer: createViteServer, createLogger } = await import("vite");

  const viteLogger = createLogger();
  const hmrHost = process.env.REPLIT_DEV_DOMAIN;
  const serverOptions = {
    middlewareMode: true,
    hmr: process.env.REPL_ID
      ? { server, host: hmrHost, clientPort: 443, protocol: "wss" as const }
      : { server },
    allowedHosts: true as const,
  };

  // Let Vite auto-discover vite.config.ts — do NOT import it here
  // (importing vite.config would cause esbuild to bundle vite plugins as static imports)
  const vite = await createViteServer({
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      if (isStaffPath(url)) {
        template = injectStaffManifest(template);
      }
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 
        "Content-Type": "text/html",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        const normalized = filePath.replace(/\\/g, "/");

        if (normalized.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
          return;
        }

        if (normalized.includes("/assets/")) {
          res.setHeader(
            "Cache-Control",
            `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
          );
          return;
        }

        res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      },
    }),
  );

  app.use("*", (req, res) => {
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "Surrogate-Control": "no-store"
    });
    const indexPath = path.resolve(distPath, "index.html");
    if (isStaffPath(req.originalUrl)) {
      try {
        let html = fs.readFileSync(indexPath, "utf-8");
        html = injectStaffManifest(html);
        res.set("Content-Type", "text/html").end(html);
      } catch {
        res.sendFile(indexPath);
      }
    } else {
      res.sendFile(indexPath);
    }
  });
}
