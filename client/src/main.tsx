import React from "react";
import ReactDOM from "react-dom/client";

function SimpleApp() {
  return (
    <div style={{ color: "cyan", fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "black", flexDirection: "column" }}>
      <h1>J.A.R.V.I.S. REACT 19</h1>
      <p>React Rendering: SUCCESS</p>
      <p>Status: OPERATIONAL</p>
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <SimpleApp />
    </React.StrictMode>
  );
}
