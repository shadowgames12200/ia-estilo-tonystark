import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";
import { trpc } from "./lib/trpc";

console.log("J.A.R.V.I.S. Starting...");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
    }),
  ],
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("Root element not found");
} else {
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </trpc.Provider>
      </React.StrictMode>
    );
    console.log("J.A.R.V.I.S. Rendered");
  } catch (err) {
    console.error("J.A.R.V.I.S. Render Error:", err);
    rootElement.innerHTML = `<div style="color:red;padding:20px;"><h1>Render Error</h1><pre>${err instanceof Error ? err.stack : String(err)}</pre></div>`;
  }
}

window.onerror = function(msg, url, line, col, error) {
  console.error("Global Error:", msg, url, line, col, error);
  if (rootElement) {
    const errorDetail = error ? (error.stack || JSON.stringify(error)) : "No error object";
    rootElement.innerHTML = `<div style="color:orange;padding:20px;background:#1a1a1a;border:1px solid orange;">
      <h1>Global Error</h1>
      <p><strong>Message:</strong> ${msg}</p>
      <p><strong>URL:</strong> ${url}</p>
      <p><strong>Line:</strong> ${line}, <strong>Col:</strong> ${col}</p>
      <pre style="white-space:pre-wrap;word-break:break-all;">${errorDetail}</pre>
    </div>`;
  }
  return false;
};

window.onunhandledrejection = function(event) {
  console.error("Unhandled Rejection:", event.reason);
  if (rootElement) {
    rootElement.innerHTML = `<div style="color:red;padding:20px;background:#1a1a1a;border:1px solid red;">
      <h1>Unhandled Rejection</h1>
      <pre style="white-space:pre-wrap;word-break:break-all;">${event.reason?.stack || event.reason}</pre>
    </div>`;
  }
};
