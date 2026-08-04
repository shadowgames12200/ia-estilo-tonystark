import React, { useState, useEffect } from "react";
import { BootSequence } from "@/components/BootSequence";

export default function Home() {
  const [booted, setBooted] = useState(false);

  if (!booted) {
    return <BootSequence onComplete={() => setBooted(true)} />;
  }

  return (
    <div style={{ color: "cyan", fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "black", flexDirection: "column" }}>
      <h1>J.A.R.V.I.S. HOME TEST</h1>
      <p>Boot Sequence: SUCCESS</p>
      <p>Interface: ONLINE</p>
    </div>
  );
}
