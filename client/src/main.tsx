console.log("J.A.R.V.I.S. PRE-IMPORT CHECK");
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("J.A.R.V.I.S. Manual Override: Starting minimal boot...");

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("Critical Error: Root element #root not found in DOM");
  } else {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("J.A.R.V.I.S. Minimal Render Success");
  }
} catch (e) {
  console.error("J.A.R.V.I.S. Initialization Failure:", e);
}
