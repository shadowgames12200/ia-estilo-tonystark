export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
// O parser multipart atual acumula o corpo em memória; mantenha o limite operacional conservador.
export const MAX_PROJECT_UPLOAD_BYTES = 128 * 1024 * 1024;
export const MAX_PROJECT_EXTRACTED_BYTES = 1024 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 20_000;
export const MAX_UPLOADS_PER_MESSAGE = 5;

const EXECUTABLE_EXTENSIONS = new Set([
  ".apk",
  ".app",
  ".bat",
  ".bin",
  ".cmd",
  ".com",
  ".dll",
  ".dmg",
  ".elf",
  ".exe",
  ".jar",
  ".msi",
  ".ps1",
  ".run",
  ".scr",
  ".sh",
  ".sys",
  ".vbs",
]);

const EXECUTABLE_MIME_TYPES = new Set([
  "application/java-archive",
  "application/x-7z-compressed",
  "application/x-apple-diskimage",
  "application/x-dosexec",
  "application/x-executable",
  "application/x-msdownload",
  "application/x-sh",
  "application/x-shockwave-flash",
  "application/x-elf",
  "application/vnd.android.package-archive",
]);

const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export type UploadedFileRecord = {
  id: string;
  originalName: string;
  safeName: string;
  mimeType: string;
  size: number;
  extension: string;
  isExecutable: boolean;
  url: string;
  key?: string;
  storage: "object" | "local";
  createdAt: string;
};

export type UploadValidationInput = {
  originalFilename?: string | null;
  mimetype?: string | null;
  size: number;
};

export type UploadValidationResult =
  | {
      ok: true;
      safeName: string;
      extension: string;
      mimeType: string;
      isExecutable: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export function sanitizeFilename(filename: string | null | undefined): string {
  const normalized = String(filename || "arquivo")
    .normalize("NFKC")
    .replace(/\\/g, "/");
  const basename = normalized.split("/").pop() || "arquivo";
  const cleaned = basename
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\p{L}\p{N}._()\- ]/gu, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 180);

  if (!cleaned || WINDOWS_RESERVED_NAME.test(cleaned)) return "arquivo";
  return cleaned;
}

export function getFileExtension(filename: string): string {
  const safeName = sanitizeFilename(filename);
  const dot = safeName.lastIndexOf(".");
  if (dot <= 0 || dot === safeName.length - 1) return "";
  return safeName.slice(dot).toLowerCase();
}

export function isExecutableFile(filename: string, mimeType = ""): boolean {
  const extension = getFileExtension(filename);
  return EXECUTABLE_EXTENSIONS.has(extension) || EXECUTABLE_MIME_TYPES.has(mimeType.toLowerCase());
}

export function validateUpload(input: UploadValidationInput): UploadValidationResult {
  const safeName = sanitizeFilename(input.originalFilename);
  const size = Number(input.size);
  const mimeType = (input.mimetype || "application/octet-stream").trim().toLowerCase();
  const extension = getFileExtension(safeName);
  const isProjectArchive = extension === ".zip" || mimeType === "application/zip" || mimeType === "application/x-zip-compressed";

  if (!Number.isFinite(size) || size < 0) {
    return { ok: false, error: "Tamanho de arquivo inválido." };
  }

  if (size === 0) {
    return { ok: false, error: "Arquivos vazios não podem ser enviados." };
  }

  const maxBytes = isProjectArchive ? MAX_PROJECT_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
  if (size > maxBytes) {
    return {
      ok: false,
      error: isProjectArchive
        ? `O ZIP de projeto excede o limite de ${Math.floor(MAX_PROJECT_UPLOAD_BYTES / 1024 / 1024)} MB.`
        : `O arquivo excede o limite de ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
    };
  }

  return {
    ok: true,
    safeName,
    extension: getFileExtension(safeName),
    mimeType,
    isExecutable: isExecutableFile(safeName, mimeType),
  };
}

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
