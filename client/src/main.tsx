import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

console.log("SIMPLE React starting...");

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Root element not found");

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <div style={{ color: 'white', padding: '20px', fontSize: '24px' }}>
        TESTE DE RENDERIZAÇÃO BÁSICA - SE VOCÊ VÊ ISSO, O REACT FUNCIONA.
      </div>
    </React.StrictMode>
  );
  console.log("SIMPLE React render called");
} catch (e) {
  console.error("SIMPLE React mount error:", e);
}
