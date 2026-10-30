import { AlertTriangle, FileUp, Loader2, Mic, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import {
  formatFileSize,
  MAX_UPLOADS_PER_MESSAGE,
  type UploadedFileRecord,
} from "@shared/file-upload";

interface VoiceCommandPanelProps {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  onSend: (text: string, image?: string, files?: UploadedFileRecord[]) => void;
  onMicClick: () => void;
  input: string;
  onInputChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  attachedFiles: UploadedFileRecord[];
  onFilesChange: (files: UploadedFileRecord[]) => void;
}

export function VoiceCommandPanel({
  transcript,
  interimTranscript,
  isListening,
  onSend,
  onMicClick,
  input,
  onInputChange,
  onKeyDown,
  attachedFiles,
  onFilesChange,
}: VoiceCommandPanelProps) {
  const displayText = transcript || interimTranscript;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const remainingSlots = MAX_UPLOADS_PER_MESSAGE - attachedFiles.length;
    if (remainingSlots <= 0) {
      setUploadError(`Limite de ${MAX_UPLOADS_PER_MESSAGE} arquivos por mensagem atingido.`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    const filesToUpload = Array.from(fileList).slice(0, remainingSlots);
    const uploaded = [...attachedFiles];

    try {
      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append("file", file, file.name);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const payload = (await response.json().catch(() => ({}))) as {
          file?: UploadedFileRecord;
          error?: string;
        };

        if (!response.ok || !payload.file) {
          throw new Error(payload.error || `Falha ao enviar ${file.name}.`);
        }

        uploaded.push(payload.file);
        onFilesChange([...uploaded]);
      }

      if (fileList.length > filesToUpload.length) {
        setUploadError(`Apenas ${remainingSlots} arquivo(s) foram aceitos nesta mensagem.`);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Falha ao enviar arquivo.");
      onFilesChange(uploaded);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = (id: string) => {
    onFilesChange(attachedFiles.filter((file) => file.id !== id));
    setUploadError(null);
  };

  const submitMessage = () => {
    const text = input.trim() || (attachedFiles.length > 0 ? "Analise os arquivos anexados." : "");
    if (text && !isUploading) onSend(text, undefined, attachedFiles);
  };

  return (
    <div className="border border-cyan-400/30 rounded-lg p-4 bg-black/40 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-cyan-400/20">
        <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
        <h3 className="text-xs font-bold tracking-widest text-cyan-300 uppercase">COMANDO DE VOZ</h3>
      </div>

      <div className="mb-4 p-3 bg-cyan-400/5 border border-cyan-400/20 rounded min-h-12 max-h-24 overflow-y-auto">
        {displayText ? (
          <p className="text-cyan-300 text-[11px] leading-relaxed">
            {transcript}
            {interimTranscript && <span className="text-cyan-400/60 italic">{interimTranscript}</span>}
          </p>
        ) : (
          <p className="text-cyan-400/40 text-[11px] italic">
            {isListening ? "Ouvindo..." : "Clique no microfone para falar"}
          </p>
        )}
      </div>

      <div className="mb-4 flex items-center justify-center gap-1 h-8">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-full transition-all duration-75 ${
              isListening ? "bg-red-400 animate-pulse" : displayText ? "bg-cyan-400" : "bg-cyan-400/20"
            }`}
            style={{
              height: isListening
                ? `${20 + Math.sin(i * 0.5) * 15 + Math.random() * 20}px`
                : displayText
                  ? `${15 + Math.sin(i * 0.3) * 10}px`
                  : "4px",
            }}
          />
        ))}
      </div>

      <div className="space-y-2">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Digite ou fale seu comando..."
          className="w-full bg-cyan-400/5 border border-cyan-400/20 rounded px-3 py-2 text-cyan-300 text-[11px] placeholder-cyan-400/30 focus:outline-none focus:border-cyan-400/50 focus:bg-cyan-400/10 resize-none"
          rows={2}
        />

        {attachedFiles.length > 0 && (
          <div className="space-y-1.5" aria-label="Arquivos anexados">
            {attachedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 rounded border border-cyan-400/20 bg-cyan-400/5 px-2 py-1.5 text-[10px]"
              >
                {file.isExecutable ? <AlertTriangle size={12} className="shrink-0 text-amber-300" /> : <FileUp size={12} className="shrink-0 text-cyan-300" />}
                <span className="min-w-0 flex-1 truncate text-cyan-200" title={file.originalName}>{file.originalName}</span>
                <span className="shrink-0 text-cyan-400/50">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="shrink-0 rounded p-0.5 text-cyan-400/50 hover:bg-rose-400/10 hover:text-rose-300"
                  aria-label={`Remover ${file.originalName}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {attachedFiles.some((file) => file.isExecutable) && (
              <p className="flex items-center gap-1 text-[9px] text-amber-200/80">
                <AlertTriangle size={10} /> Executáveis são armazenados como arquivos inertes e nunca são executados automaticamente.
              </p>
            )}
          </div>
        )}

        {uploadError && <p className="text-[10px] text-rose-300" role="alert">{uploadError}</p>}

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => void uploadFiles(event.target.files)}
            aria-label="Selecionar arquivos para anexar"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || attachedFiles.length >= MAX_UPLOADS_PER_MESSAGE}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded border border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-bold uppercase transition-all"
            title="Anexar fotos, documentos, programas e outros arquivos"
          >
            {isUploading ? <Loader2 size={12} className="animate-spin" /> : <FileUp size={12} />}
            {isUploading ? "ENVIANDO" : "ANEXAR"}
          </button>

          <button
            type="button"
            onClick={onMicClick}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded border text-[10px] font-bold uppercase transition-all ${
              isListening
                ? "border-red-400/80 text-red-300 bg-red-400/20 animate-pulse"
                : "border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20"
            }`}
          >
            <Mic size={12} />
            {isListening ? "OUVINDO" : "MIC"}
          </button>

          <button
            type="button"
            onClick={submitMessage}
            disabled={(!input.trim() && attachedFiles.length === 0) || isUploading}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded border border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-bold uppercase transition-all"
          >
            <Send size={12} />
            ENVIAR
          </button>
        </div>
      </div>
    </div>
  );
}
