import React from "react";
import ReactDOM from "react-dom/client";
import { Switch, Route } from "wouter";

function Home() {
  return (
    <div style={{ color: "cyan", fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "black", flexDirection: "column" }}>
      <h1>J.A.R.V.I.S. WOUTER TEST</h1>
      <p>Routing: SUCCESS</p>
    </div>
  );
}

function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
    </Switch>
  );
}

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
