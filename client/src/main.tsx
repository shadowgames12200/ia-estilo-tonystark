import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("React starting...");

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Root element not found");
  
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <div style={{ color: 'white', padding: '20px' }}>
        <h1>J.A.R.V.I.S. SYSTEM STARTING...</h1>
        <App />
      </div>
    </React.StrictMode>
  );
  console.log("React render called");
} catch (e) {
  console.error("React mount error:", e);
}
