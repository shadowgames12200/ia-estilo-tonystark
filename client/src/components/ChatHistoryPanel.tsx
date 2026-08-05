import React from "react";
import { MessageSquare } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatHistoryPanelProps {
  messages: Message[];
  streamingContent?: string;
  isStreaming?: boolean;
  isThinking?: boolean;
}

export function ChatHistoryPanel({
  messages,
  streamingContent,
  isStreaming,
  isThinking,
}: ChatHistoryPanelProps) {
  return (
    <div className="border border-cyan-400/30 rounded-lg p-4 bg-black/40 backdrop-blur-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-cyan-400/20">
        <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
        <h3 className="text-xs font-bold tracking-widest text-cyan-300 uppercase">HISTÓRICO</h3>
        {messages.length > 0 && (
          <span className="ml-auto text-cyan-400/60 text-[9px]">{messages.length} mensagens</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare size={20} className="text-cyan-400/30 mb-2" />
            <p className="text-cyan-400/50 text-[10px]">Nenhuma mensagem ainda</p>
            <p className="text-cyan-400/30 text-[9px] mt-1">Fale ou digite para começar</p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      msg.role === "user" ? "bg-red-400" : "bg-cyan-400"
                    }`}
                  />
                  <span className="text-[9px] font-mono text-cyan-400/60">
                    {msg.role === "user" ? "USER" : "J.A.R.V.I.S"}
                  </span>
                  <span className="text-[8px] text-cyan-400/40 ml-auto">
                    {msg.timestamp.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div
                  className={`text-[10px] leading-relaxed px-2 py-1.5 rounded border ${
                    msg.role === "user"
                      ? "border-red-400/20 bg-red-400/5 text-red-300"
                      : "border-cyan-400/20 bg-cyan-400/5 text-cyan-300"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="space-y-1 animate-pulse">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-[9px] font-mono text-amber-400/60">PENSANDO</span>
                </div>
                <div className="text-[10px] leading-relaxed px-2 py-1.5 rounded border border-amber-400/20 bg-amber-400/5 text-amber-300">
                  Processando...
                </div>
              </div>
            )}

            {isStreaming && streamingContent && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-[9px] font-mono text-cyan-400/60">J.A.R.V.I.S</span>
                </div>
                <div className="text-[10px] leading-relaxed px-2 py-1.5 rounded border border-cyan-400/20 bg-cyan-400/5 text-cyan-300">
                  {streamingContent}
                  <span className="animate-pulse">▌</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
