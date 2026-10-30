import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { IncomingMessage } from "node:http";
import { storagePut } from "../storage.js";
import { scanArchiveSecrets, scanBufferSecrets } from "./project-security.js";
import {
  MAX_UPLOAD_BYTES,
  MAX_PROJECT_UPLOAD_BYTES,
  validateUpload,
  type UploadedFileRecord,
} from "../../shared/file-upload.js";

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: unknown) => unknown;
  setHeader: (name: string, value: string) => void;
  end: (body?: unknown) => unknown;
};

type RequestLike = IncomingMessage & {
  query?: Record<string, unknown>;
  params?: Record<string, string>;
};

type MultipartFile = {
  filename: string;
  mimeType: string;
  data: Buffer;
};

const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;
const UPLOAD_ROOT = path.resolve(process.env.JARVIS_UPLOAD_DIR || "uploads");

function getHeader(req: RequestLike, name: string): string {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || "" : String(value || "");
}

function parseBoundary(contentType: string): string {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = (match?.[1] || match?.[2] || "").trim();
  if (!boundary) throw new Error("Multipart boundary ausente.");
  return boundary;
}

function parseDisposition(value: string): { name: string; filename?: string } {
  const name = value.match(/\bname="([^"]*)"/i)?.[1] || "";
  const filename = value.match(/\bfilename="([^"]*)"/i)?.[1];
  return { name, filename };
}

function parseMultipartBody(body: Buffer, boundary: string): MultipartFile[] {
  const marker = Buffer.from(`--${boundary}`);
  const headerSeparator = Buffer.from("\r\n\r\n");
  const files: MultipartFile[] = [];
  let cursor = body.indexOf(marker);

  while (cursor >= 0) {
    let partStart = cursor + marker.length;
    if (body.subarray(partStart, partStart + 2).toString() === "--") break;
    if (body.subarray(partStart, partStart + 2).toString() === "\r\n") partStart += 2;

    const headerEnd = body.indexOf(headerSeparator, partStart);
    if (headerEnd < 0) break;

    const headers = body.subarray(partStart, headerEnd).toString("utf8");
    const nextBoundary = body.indexOf(marker, headerEnd + headerSeparator.length);
    if (nextBoundary < 0) break;

    const dataEnd = Math.max(headerEnd + headerSeparator.length, nextBoundary - 2);
    const data = body.subarray(headerEnd + headerSeparator.length, dataEnd);
    const disposition = headers.match(/^content-disposition:\s*([^\r\n]*)$/im)?.[1] || "";
    const parsedDisposition = parseDisposition(disposition);

    if (parsedDisposition.filename !== undefined && parsedDisposition.name === "file") {
      const mimeType = headers.match(/^content-type:\s*([^\r\n]*)$/im)?.[1]?.trim() || "application/octet-stream";
      files.push({
        filename: parsedDisposition.filename || "arquivo",
        mimeType,
        data,
      });
    }

    cursor = nextBoundary;
  }

  return files;
}

async function readRequestBody(req: RequestLike): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;

  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > MAX_PROJECT_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
        reject(new Error("O corpo do upload excede o limite permitido."));
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => resolve());
    req.on("error", reject);
    req.on("aborted", () => reject(new Error("Upload abortado pelo cliente.")));
  });

  return Buffer.concat(chunks);
}

function shouldUseObjectStorage(): boolean {
  return Boolean(process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY);
}

async function saveToLocalStorage(file: MultipartFile, safeName: string, id: string) {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  const storedName = `${id}-${safeName}`;
  const target = path.join(UPLOAD_ROOT, storedName);
  await fs.writeFile(target, file.data, { flag: "wx" });
  return {
    key: storedName,
    url: `/api/upload/${encodeURIComponent(storedName)}`,
    storage: "local" as const,
  };
}

async function saveUpload(file: MultipartFile, safeName: string, id: string) {
  if (shouldUseObjectStorage()) {
    const stored = await storagePut(`jarvis-uploads/${id}-${safeName}`, file.data, file.mimeType);
    return { ...stored, storage: "object" as const };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Storage de arquivos não configurado para produção.");
  }

  return saveToLocalStorage(file, safeName, id);
}

function getRequestedKey(req: RequestLike): string {
  const queryKey = req.query?.key;
  const paramKey = req.params?.key;
  return String(paramKey || queryKey || "");
}

async function serveLocalFile(req: RequestLike, res: ResponseLike): Promise<unknown> {
  let requestedKey = "";
  try {
    requestedKey = decodeURIComponent(getRequestedKey(req));
  } catch {
    return res.status(400).json({ error: "Arquivo inválido." });
  }
  if (!requestedKey || requestedKey.includes("/") || requestedKey.includes("\\") || requestedKey.includes("..")) {
    return res.status(400).json({ error: "Arquivo inválido." });
  }

  const target = path.resolve(UPLOAD_ROOT, requestedKey);
  if (!target.startsWith(`${UPLOAD_ROOT}${path.sep}`)) {
    return res.status(403).json({ error: "Acesso ao arquivo bloqueado." });
  }

  try {
    const data = await fs.readFile(target);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${requestedKey.replace(/"/g, "_")}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    return res.end(data);
  } catch {
    return res.status(404).json({ error: "Arquivo não encontrado." });
  }
}

export async function handleUploadRequest(req: RequestLike, res: ResponseLike): Promise<unknown> {
  const method = String(req.method || "").toUpperCase();

  if (method === "GET") return serveLocalFile(req, res);
  if (method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const contentType = getHeader(req, "content-type");
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      return res.status(415).json({ error: "Envie o arquivo usando multipart/form-data." });
    }

    const body = await readRequestBody(req);
    const files = parseMultipartBody(body, parseBoundary(contentType));
    const file = files[0];
    if (!file) return res.status(400).json({ error: "Nenhum arquivo foi enviado no campo file." });

    const validation = validateUpload({
      originalFilename: file.filename,
      mimetype: file.mimeType,
      size: file.data.length,
    });
    if (!validation.ok) return res.status(413).json({ error: validation.error });
    const secretFindings = validation.extension === ".zip" ? await scanArchiveSecrets(file.data, validation.safeName) : scanBufferSecrets(validation.safeName, file.data);
    if (secretFindings.length) return res.status(422).json({ error: `Upload bloqueado: possível segredo detectado em ${secretFindings.map((item) => `${item.file}${item.line ? `:${item.line}` : ""}`).join(", ")}.` });

    const id = randomUUID();
    const saved = await saveUpload(file, validation.safeName, id);
    const result: UploadedFileRecord = {
      id,
      originalName: file.filename,
      safeName: validation.safeName,
      mimeType: validation.mimeType,
      size: file.data.length,
      extension: validation.extension,
      isExecutable: validation.isExecutable,
      url: saved.url,
      key: saved.key,
      storage: saved.storage,
      createdAt: new Date().toISOString(),
    };

    return res.status(201).json({ file: result });
  } catch (error) {
    console.error("[Upload] Falha ao receber arquivo:", error);
    const message = error instanceof Error ? error.message : "Falha interna no upload.";
    return res.status(message.includes("Storage") ? 503 : 500).json({ error: message });
  }
}
