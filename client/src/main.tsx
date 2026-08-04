import React from "react";
import ReactDOM from "react-dom/client";

console.log("React starting - Basic Test");

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("Root element not found");
} else {
  ReactDOM.createRoot(rootElement).render(
    <div style={{ color: "white", padding: "20px", background: "red" }}>
      <h1>J.A.R.V.I.S. REACT TEST</h1>
      <p>If you see this, React is working.</p>
    </div>
  );
  console.log("React render called");
}
