import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers.js";
import { createContext } from "./context.js";
import { setupVite, serveStatic } from "./vite.js";
import dotenv from "dotenv";
import type { Server } from "http";

dotenv.config();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));

  // tRPC middleware
  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  const port = parseInt(process.env.PORT || "3000", 10);

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
    app.listen(port, "0.0.0.0", () => {
      console.log(`J.A.R.V.I.S. Server running in production on port ${port}`);
    });
  } else {
    // Em desenvolvimento, o Vite lida com o frontend
    const server: Server = app.listen(port, "0.0.0.0", () => {
      console.log(`J.A.R.V.I.S. Server running in development on port ${port}`);
    });
    await setupVite(app, server);
  }
}

startServer().catch(console.error);
