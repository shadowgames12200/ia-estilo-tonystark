import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";
import { trpc } from "./lib/trpc";

console.log("J.A.R.V.I.S. Debug Starting...");

const queryClient = new QueryClient();

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
    }),
  ],
});

const rootElement = document.getElementById("root");

window.onerror = function(msg, url, line, col, error) {
  const errStr = `Error: ${msg}\nURL: ${url}\nLine: ${line}, Col: ${col}\nStack: ${error?.stack || "N/A"}`;
  console.error(errStr);
  if (rootElement) {
    rootElement.innerHTML = `<div style="color:white;background:red;padding:20px;font-family:monospace;white-space:pre-wrap;">${errStr}</div>`;
  }
  return false;
};

if (!rootElement) {
  console.error("Root element not found");
} else {
  console.log("Rendering App...");
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </trpc.Provider>
    </React.StrictMode>
  );
  console.log("Render call finished");
}
