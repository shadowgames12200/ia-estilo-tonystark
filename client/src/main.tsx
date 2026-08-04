import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "./lib/trpc";

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
    }),
  ],
});

function Home() {
  return (
    <div style={{ color: "cyan", fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "black", flexDirection: "column" }}>
      <h1>J.A.R.V.I.S. TRPC TEST</h1>
      <p>tRPC & QueryClient: SUCCESS</p>
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <Home />
        </QueryClientProvider>
      </trpc.Provider>
    </React.StrictMode>
  );
}
