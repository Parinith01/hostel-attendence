import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pool } from "./db";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    if (pool) {
      // Attendance migrations
      await pool.query(`ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "return_date" text;`);
      await pool.query(`ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "return_meal_type" text;`);
      await pool.query(`ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "sunday_token" text;`);
      
      // Users migrations
      await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;`);
      await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ip_address" text;`);
      await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "device_fingerprint" text;`);
      await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspicious_score" integer DEFAULT 0;`);
      await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_suspicious" boolean DEFAULT false;`);
      await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_banned" boolean DEFAULT false;`);
      await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "otp" text;`);
      await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "otp_expiry" text;`);
      await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_verified" boolean DEFAULT false;`);
      
      // Update existing users to be verified if they don't have an email (legacy)
      // or just ensure they are verified if they were already approved.
      await pool.query(`UPDATE "users" SET "is_verified" = true WHERE "is_approved" = true AND "is_verified" = false;`);
      
      log("Database schema migrated for security & absentee fields.");
    }
  } catch (e: any) {
    console.error("Failed to run schema migrations on startup:", e.message);
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
