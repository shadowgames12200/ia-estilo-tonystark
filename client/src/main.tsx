const root = document.getElementById("root");
if (root) {
  root.innerHTML = `
    <div style="color: cyan; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh; background: black; flex-direction: column;">
      <h1>J.A.R.V.I.S. DIAGNOSTIC</h1>
      <p>Vanilla JS Execution: SUCCESS</p>
      <p>Time: ${new Date().toLocaleTimeString()}</p>
    </div>
  `;
}
console.log("J.A.R.V.I.S. Vanilla Diagnostic Loaded");
