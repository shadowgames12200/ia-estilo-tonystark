import React, { useEffect, useRef } from "react";
import { AlertTriangle, FileUp, MessageSquare, Trash2 } from "lucide-react";
import { RichMarkdown } from "@/components/RichMarkdown";
import { formatFileSize, type UploadedFileRecord } from "@shared/file-upload";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachments?: UploadedFileRecord[];
}

interface ChatHistoryPanelProps {
  messages: Message[];
  streamingContent?: string;
  isStreaming?: boolean;
  isThinking?: boolean;
  onDeleteConversation?: (messageIndex: number) => void;
  onClearHistory?: () => void;
}

function formatMessageTime(timestamp: Date) {
  return timestamp.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatHistoryPanel({
  messages,
  streamingContent,
  isStreaming,
  isThinking,
  onDeleteConversation,
  onClearHistory,
}: ChatHistoryPanelProps) {
  const historyEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages.length, streamingContent, isThinking]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-cyan-400/25 bg-[#020912]/90" aria-label="Conversa principal">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-cyan-400/15 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="h-2 w-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.85)]" />
          <div className="min-w-0">
            <h3 className="truncate font-mono text-[11px] font-bold tracking-[0.24em] text-cyan-200">CONVERSA</h3>
            <p className="mt-0.5 truncate text-[9px] text-cyan-400/45">J.A.R.V.I.S. · chat principal</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-[9px] text-cyan-400/55">
            {messages.length > 0 ? `${messages.length} mensagens` : "nova conversa"}
          </span>
          {messages.length > 0 && onClearHistory && (
            <button
              type="button"
              onClick={onClearHistory}
              title="Apagar toda a conversa"
              aria-label="Apagar toda a conversa"
              className="rounded border border-red-400/25 p-1.5 text-red-300/65 transition hover:border-red-300/70 hover:bg-red-400/10 hover:text-red-200"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 pr-2" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-400/5 text-cyan-300 shadow-[0_0_28px_rgba(34,211,238,0.08)]">
              <MessageSquare size={19} />
            </div>
            <p className="font-mono text-[11px] tracking-[0.16em] text-cyan-200">COMO POSSO AJUDAR?</p>
            <p className="mt-2 max-w-xs text-[10px] leading-relaxed text-cyan-400/45">
              Digite uma mensagem, envie um arquivo ou use o microfone para começar uma conversa.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              return (
                <div key={`${msg.timestamp.getTime()}-${idx}`} className={`group flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`flex max-w-[92%] flex-col gap-1 md:max-w-[78%] ${isUser ? "items-end" : "items-start"}`}>
                    <div className={`flex items-center gap-2 px-1 font-mono text-[9px] ${isUser ? "flex-row-reverse text-red-300/65" : "text-cyan-300/65"}`}>
                      <span>{isUser ? "VOCÊ" : "J.A.R.V.I.S."}</span>
                      <span className="text-cyan-400/35">{formatMessageTime(msg.timestamp)}</span>
                      {onDeleteConversation && (
                        <button
                          type="button"
                          onClick={() => onDeleteConversation(idx)}
                          title="Apagar esta mensagem"
                          aria-label={`Apagar mensagem ${idx + 1}`}
                          className="rounded p-0.5 text-red-300/35 opacity-0 transition group-hover:opacity-100 hover:bg-red-400/10 hover:text-red-200 focus:opacity-100"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                    <div className={`rounded-2xl border px-3 py-2 text-[11px] leading-relaxed shadow-[0_4px_18px_rgba(0,0,0,0.12)] ${
                      isUser
                        ? "rounded-tr-sm border-red-400/25 bg-red-400/8 text-red-100/90"
                        : "rounded-tl-sm border-cyan-400/20 bg-cyan-400/6 text-cyan-100/90"
                    }`}>
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="prose prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:my-2 prose-pre:overflow-x-auto prose-pre:bg-black/40 prose-code:text-cyan-200">
                          <RichMarkdown content={msg.content} />
                        </div>
                      )}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 space-y-1 border-t border-current/10 pt-2">
                          {msg.attachments.map((file) => {
                            const fileLabel = (
                              <>
                                {file.isExecutable ? <AlertTriangle size={10} className="text-amber-300" /> : <FileUp size={10} />}
                                <span className="min-w-0 flex-1 truncate" title={file.originalName}>{file.originalName}</span>
                                <span className="opacity-60">{formatFileSize(file.size)}</span>
                              </>
                            );
                            return isUser ? (
                              <div key={file.id} className="flex items-center gap-1.5 rounded-lg border border-current/10 px-2 py-1.5 text-[9px] opacity-80">
                                {fileLabel}
                                <span className="shrink-0 text-cyan-300/60">recebido</span>
                              </div>
                            ) : (
                              <a
                                key={file.id}
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                download={file.originalName}
                                className="flex items-center gap-1.5 rounded-lg border border-current/10 px-2 py-1.5 text-[9px] transition hover:bg-white/5"
                              >
                                {fileLabel}
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isThinking && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-amber-400/20 bg-amber-400/5 px-3 py-2 font-mono text-[10px] text-amber-200/75">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
                  J.A.R.V.I.S. está pensando...
                </div>
              </div>
            )}

            {isStreaming && streamingContent && (
              <div className="flex justify-start">
                <div className="flex max-w-[92%] flex-col items-start gap-1 md:max-w-[78%]">
                  <div className="px-1 font-mono text-[9px] text-cyan-300/65">J.A.R.V.I.S.</div>
                  <div className="rounded-2xl rounded-tl-sm border border-cyan-400/20 bg-cyan-400/6 px-3 py-2 text-[11px] leading-relaxed text-cyan-100/90">
                    <div className="whitespace-pre-wrap">{streamingContent}<span className="animate-pulse text-cyan-300">▌</span></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={historyEndRef} aria-hidden="true" className="h-px" />
          </>
        )}
      </div>
    </section>
  );
}
