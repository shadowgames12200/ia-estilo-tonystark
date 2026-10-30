import express from "express";
import "dotenv/config";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers.js";
import { createContext } from "./context.js";
import { setupVite, serveStatic } from "./vite.js";
import type { Server } from "http";

// Importando os handlers serverless para suporte local
import chatStreamHandler from "../../api/chat-stream.js";
import ttsStreamHandler from "../../api/tts-stream.js";
import autoImproveHandler from "../../api/auto-improve.js";
import uploadHandler from "../../api/upload.js";
import diagnosticsHandler from "../../api/diagnostics.js";
import metricsHandler from "../../api/metrics.js";
import localVoiceHandler from "../../api/local-voice.js";
import autonomousTaskHandler from "../../api/autonomous-task.js";
import { registerLocalAuthRoutes } from "../routes/localAuth.js";
import { ENV } from "./env.js";
import { recoverAutonomousTasks } from "./autonomous-runtime.js";


async function startServer() {
  const recoveredAutonomous = await recoverAutonomousTasks();
  if (recoveredAutonomous) console.log(`[Autonomy] ${recoveredAutonomous} tarefa(s) pausada(s) para retomada supervisionada.`);
  const app = express();
  app.use(express.json({ limit: ENV.maxJsonBody }));
  registerLocalAuthRoutes(app);

  // Registrar rotas de API local (compatibilidade total)
  app.all("/api/chat-stream", (req, res) => chatStreamHandler(req as any, res as any));
  app.all("/api/tts-stream", (req, res) => ttsStreamHandler(req as any, res as any));
  app.all("/api/auto-improve", (req, res) => autoImproveHandler(req as any, res as any));
  app.all("/api/upload", (req, res) => uploadHandler(req as any, res as any));
  app.all("/api/upload/:key", (req, res) => uploadHandler(req as any, res as any));
  app.all("/api/diagnostics", (req, res) => diagnosticsHandler(req as any, res as any));
  app.all("/api/metrics", (req, res) => metricsHandler(req as any, res as any));
  app.all("/api/local-voice", (req, res) => localVoiceHandler(req as any, res as any));
  app.all("/api/autonomous-task", (req, res) => autonomousTaskHandler(req as any, res as any));

  // tRPC middleware
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  const port = parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "127.0.0.1";

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
    app.listen(port, host, () => {
      console.log(`J.A.R.V.I.S. Server running in production on ${host}:${port}`);
    });
  } else {
    const server: Server = app.listen(port, host, () => {
      console.log(`J.A.R.V.I.S. Server running in development on ${host}:${port}`);
    });
    await setupVite(app, server);
  }
}

startServer().catch(console.error);
