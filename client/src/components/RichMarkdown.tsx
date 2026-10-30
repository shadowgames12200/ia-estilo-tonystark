import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Streamdown } from "streamdown";

type RichMarkdownProps = { content: string };

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { setCopied(false); }
  };
  return <div className="jarvis-code-block my-3 overflow-hidden rounded-xl border border-cyan-400/20 bg-[#0b1117] shadow-[0_4px_18px_rgba(0,0,0,.25)]">
    <div className="flex items-center justify-between border-b border-white/5 bg-white/[.035] px-3 py-2 font-mono text-[9px] text-cyan-300/70"><span>{language || "text"}</span><button type="button" onClick={copy} className="flex items-center gap-1 rounded px-1.5 py-1 text-cyan-300/60 transition hover:bg-cyan-300/10 hover:text-cyan-100" title="Copiar código">{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "copiado" : "copiar"}</button></div>
    <pre className="overflow-x-auto px-3 py-3 font-mono text-[11px] leading-relaxed text-slate-200"><code>{code}</code></pre>
  </div>;
}

export function RichMarkdown({ content }: RichMarkdownProps) {
  const parts = content.split(/```([\w.+-]*)\n([\s\S]*?)```/g);
  return <div className="jarvis-markdown">
    {parts.map((part, index) => {
      if (index % 3 === 0) return part ? <Streamdown key={`md-${index}`}>{part}</Streamdown> : null;
      if (index % 3 === 1) return null;
      return <CodeBlock key={`code-${index}`} language={parts[index - 1] || "text"} code={part.replace(/\n$/, "")} />;
    })}
  </div>;
}
