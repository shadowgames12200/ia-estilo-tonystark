export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#000814" }}>
      <div className="text-center font-mono">
        <div className="text-6xl font-bold text-cyan-400 mb-4" style={{ textShadow: "0 0 20px rgba(0,212,255,0.8)" }}>
          404
        </div>
        <div className="text-cyan-400/60 text-lg tracking-widest mb-2">SECTOR NOT FOUND</div>
        <div className="text-cyan-400/30 text-sm">J.A.R.V.I.S. cannot locate the requested resource.</div>
        <a
          href="/"
          className="inline-block mt-6 px-6 py-2 border border-cyan-400/50 text-cyan-300 rounded hover:bg-cyan-400/10 transition-colors tracking-widest text-sm"
        >
          RETURN TO BASE
        </a>
      </div>
    </div>
  );
}
