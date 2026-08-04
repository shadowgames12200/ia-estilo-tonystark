import React, { useState } from "react";
import { BootSequence } from "@/components/BootSequence";

export default function Home() {
  const [booted, setBooted] = useState(false);

  if (!booted) {
    return <BootSequence onComplete={() => setBooted(true)} />;
  }

  return (
    <div style={{ 
      backgroundColor: 'black', 
      color: '#00d4ff', 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontSize: '2rem',
      fontFamily: 'monospace'
    }}>
      J.A.R.V.I.S. SYSTEM ONLINE
    </div>
  );
}
