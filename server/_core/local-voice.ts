import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile, execFileSync, spawn } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";

const execFileAsync = promisify(execFile);
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

type BinaryStatus = { configured: boolean; available: boolean; command: string; model: string; error?: string };

function commandAvailable(command: string): boolean {
  if (!command.trim()) return false;
  try {
    const locator = process.platform === "win32" ? "where" : "which";
    execFileSync(locator, [command], { stdio: "ignore", timeout: 2_000 });
    return true;
  } catch {
    return false;
  }
}

function binaryStatus(command: string | undefined, model: string | undefined): BinaryStatus {
  const configuredCommand = (command || "").trim();
  const configuredModel = (model || "").trim();
  if (!configuredCommand || !configuredModel) {
    return { configured: false, available: false, command: configuredCommand, model: configuredModel, error: "Configure o binário e o caminho do modelo." };
  }
  const available = commandAvailable(configuredCommand);
  return { configured: true, available, command: configuredCommand, model: configuredModel, ...(available ? {} : { error: "Binário não encontrado no PATH." }) };
}

export function getLocalVoiceStatus() {
  const piper = binaryStatus(process.env.PIPER_BIN || "piper", process.env.PIPER_MODEL);
  const whisper = binaryStatus(process.env.WHISPER_BIN || "whisper-cli", process.env.WHISPER_MODEL);
  return {
    mode: piper.available || whisper.available ? "local-ready" : "browser-fallback",
    piper,
    whisper,
    ffmpeg: commandAvailable(process.env.FFMPEG_BIN || "ffmpeg"),
    limits: { maxAudioBytes: MAX_AUDIO_BYTES },
  };
}

async function synthesizeWithVoiceDaemon(text: string): Promise<Buffer> {
  const port = Number.parseInt(process.env.JARVIS_VOICE_PORT || "8765", 10);
  const url = process.env.JARVIS_VOICE_WS_URL || `ws://127.0.0.1:${Number.isFinite(port) ? port : 8765}`;
  const requestId = `tts_${randomUUID()}`;

  return new Promise<Buffer>((resolve, reject) => {
    const socket = new WebSocket(url, { handshakeTimeout: 700 });
    let settled = false;
    let receivedAudio: Buffer | null = null;
    const timer = setTimeout(() => finish(new Error("Daemon Piper local excedeu o tempo limite.")), 15_000);

    const finish = (error?: Error, audio?: Buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.removeAllListeners();
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
      if (error) reject(error);
      else if (audio?.length) resolve(audio);
      else reject(new Error("Daemon Piper não retornou áudio."));
    };

    socket.once("open", () => {
      socket.send(JSON.stringify({ type: "speak", text, requestId }));
    });
    socket.on("message", (payload) => {
      try {
        const message = JSON.parse(payload.toString()) as { type?: string; requestId?: string; data?: string; error?: string };
        if (message.requestId !== requestId) return;
        if (message.type === "tts_error") return finish(new Error(message.error || "Falha na síntese do daemon Piper."));
        if (message.type === "audio" && typeof message.data === "string") receivedAudio = Buffer.from(message.data, "base64");
        if (message.type === "audio_end") finish(undefined, receivedAudio || undefined);
      } catch {
        finish(new Error("Resposta inválida do daemon Piper local."));
      }
    });
    socket.once("error", (error) => finish(error instanceof Error ? error : new Error("Daemon Piper local indisponível.")));
    socket.once("close", () => {
      if (!settled) finish(new Error("Conexão com o daemon Piper foi encerrada antes do áudio."));
    });
  });
}

export async function synthesizeWithPiper(text: string): Promise<Buffer> {
  if (!String(process.env.PIPER_MODEL || "").trim()) throw new Error("Configure PIPER_MODEL para habilitar a voz local.");
  // O daemon carrega Piper uma vez na inicialização. A conexão é curta, mas o
  // modelo permanece residente, removendo o custo de cold-start a cada trecho.
  try {
    return await synthesizeWithVoiceDaemon(text);
  } catch {
    // Compatibilidade com instalações sem daemon: manter o caminho antigo.
  }
  const status = binaryStatus(process.env.PIPER_BIN || "piper", process.env.PIPER_MODEL);
  if (!status.available) throw new Error(status.error || "Piper não está disponível.");
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(status.command, ["--model", status.model, "--output_file", "-"], { windowsHide: true });
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => child.kill(), Number(process.env.PIPER_TIMEOUT_MS || 20_000));
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", () => undefined);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`Piper encerrou com código ${code}.`));
      else resolve(Buffer.concat(chunks));
    });
    child.stdin.end(text);
  });
}

export async function transcribeWithWhisper(audio: Buffer, extension = ".wav"): Promise<string> {
  if (audio.length > MAX_AUDIO_BYTES) throw new Error("O áudio excede o limite de 25 MB.");
  const status = binaryStatus(process.env.WHISPER_BIN || "whisper-cli", process.env.WHISPER_MODEL);
  if (!status.available) throw new Error(status.error || "Whisper não está disponível.");
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "jarvis-whisper-"));
  const safeExtension = /^\.[a-z0-9]{1,5}$/i.test(extension) ? extension : ".wav";
  const inputPath = path.join(work, `input${safeExtension}`);
  const outputPrefix = path.join(work, "transcript");
  try {
    await fs.writeFile(inputPath, audio, { mode: 0o600 });
    await execFileAsync(status.command, ["-m", status.model, "-f", inputPath, "-l", process.env.WHISPER_LANGUAGE || "pt", "-nt", "-otxt", "-of", outputPrefix], {
      timeout: Number(process.env.WHISPER_TIMEOUT_MS || 60_000),
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    });
    return (await fs.readFile(`${outputPrefix}.txt`, "utf8")).trim();
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}

export function createLocalVoiceRequestId(): string {
  return `voice_${Date.now()}_${randomUUID().slice(0, 8)}`;
}
