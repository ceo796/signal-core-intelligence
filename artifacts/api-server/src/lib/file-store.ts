import { randomUUID } from "crypto";
import { access, mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";

const LOCAL_STORAGE_PREFIX = "local://";

export class StorageFileNotFoundError extends Error {
  readonly code = "STORAGE_FILE_NOT_FOUND";
  readonly storageKey: string;

  constructor(storageKey: string, options?: { cause?: unknown }) {
    super(`Stored file not found: ${storageKey}`);
    this.name = "StorageFileNotFoundError";
    this.storageKey = storageKey;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function isStorageFileNotFoundError(err: unknown): err is StorageFileNotFoundError {
  return err instanceof StorageFileNotFoundError;
}

function isErrnoCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as NodeJS.ErrnoException).code === code
  );
}

type StorageProvider = "local" | "none";

function getProvider(): StorageProvider {
  const configuredProvider = process.env.STORAGE_PROVIDER?.trim().toLowerCase();

  if (configuredProvider === "local" || configuredProvider === "render-disk") {
    return process.env.FILE_STORAGE_DIR ? "local" : "none";
  }

  if (process.env.FILE_STORAGE_DIR) {
    return "local";
  }

  return "none";
}

function getLocalStorageDir(): string {
  const dir = process.env.FILE_STORAGE_DIR;
  if (!dir) {
    throw new Error("FILE_STORAGE_DIR is not set. Local durable file storage is not configured.");
  }
  return dir;
}

function safeObjectName(originalName: string): string {
  const extension = path.extname(originalName).toLowerCase();
  return extension ? `${randomUUID()}${extension}` : randomUUID();
}

async function uploadLocalFile(buffer: Buffer, originalName: string): Promise<string> {
  const rootDir = getLocalStorageDir();
  const objectName = safeObjectName(originalName);
  const relativePath = path.join("documents", objectName);
  const absolutePath = path.join(rootDir, relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  try {
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile() || fileStat.size !== buffer.length) {
      throw new Error(
        `Upload verification failed: expected ${buffer.length} bytes at ${relativePath}, got ${fileStat.size}`,
      );
    }
    await access(absolutePath);
  } catch (err) {
    throw new Error(`Upload verification failed for ${relativePath}`, { cause: err });
  }

  return `${LOCAL_STORAGE_PREFIX}${relativePath.replace(/\\/g, "/")}`;
}

async function downloadLocalFile(storageKey: string): Promise<Buffer> {
  if (!storageKey.startsWith(LOCAL_STORAGE_PREFIX)) {
    throw new Error(`Invalid local storage key: ${storageKey}`);
  }

  const relativePath = storageKey.slice(LOCAL_STORAGE_PREFIX.length);
  const absolutePath = path.join(getLocalStorageDir(), relativePath);
  try {
    return await readFile(absolutePath);
  } catch (err) {
    if (isErrnoCode(err, "ENOENT")) {
      throw new StorageFileNotFoundError(storageKey, { cause: err });
    }
    throw err;
  }
}

async function deleteLocalFile(storageKey: string): Promise<void> {
  if (!storageKey.startsWith(LOCAL_STORAGE_PREFIX)) {
    return;
  }

  const relativePath = storageKey.slice(LOCAL_STORAGE_PREFIX.length);
  const absolutePath = path.join(getLocalStorageDir(), relativePath);
  await rm(absolutePath, { force: true });
}

export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  _contentType: string,
): Promise<string> {
  const provider = getProvider();

  switch (provider) {
    case "local":
      return uploadLocalFile(buffer, originalName);
    default:
      throw new Error("Durable file storage is not configured.");
  }
}

export async function downloadFile(storageKey: string): Promise<Buffer> {
  if (storageKey.startsWith(LOCAL_STORAGE_PREFIX)) {
    return downloadLocalFile(storageKey);
  }

  throw new Error(`Unsupported or unavailable storage key: ${storageKey}`);
}

export async function deleteFile(storageKey: string): Promise<void> {
  if (storageKey.startsWith(LOCAL_STORAGE_PREFIX)) {
    await deleteLocalFile(storageKey);
    return;
  }

  throw new Error(`Unsupported or unavailable storage key: ${storageKey}`);
}

export function isConfigured(): boolean {
  const provider = getProvider();
  return provider === "local";
}

export function getStorageProviderName(): StorageProvider {
  return getProvider();
}

export function getRuntimeStorageStatus() {
  const provider = getProvider();
  const configured = isConfigured();
  return {
    provider,
    configured,
    uploadsEnabled: configured,
    storageProviderEnv: process.env.STORAGE_PROVIDER?.trim() || "unset",
    fileStorageDir: process.env.FILE_STORAGE_DIR ? "set" : "missing",
    productionSafe: provider === "local",
  };
}

/** Log durable storage readiness at process startup (no secret paths). */
export function logStorageStartupStatus(): void {
  const status = getRuntimeStorageStatus();
  const payload = {
    storageProvider: status.provider,
    storageProviderEnv: status.storageProviderEnv,
    fileStorageDir: status.fileStorageDir,
    uploadsEnabled: status.uploadsEnabled,
    productionSafe: status.productionSafe,
  };

  if (status.uploadsEnabled) {
    console.info("signal87_storage_ready", payload);
  } else {
    console.warn(
      "signal87_storage_not_ready",
      {
        ...payload,
        message:
          "FILE_STORAGE_DIR is missing or STORAGE_PROVIDER is invalid — uploads will be rejected until durable storage is configured.",
      },
    );
  }
}

export function getMimeType(fileType: string): string {
  switch (fileType.toLowerCase()) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "xls":
      return "application/vnd.ms-excel";
    case "csv":
      return "text/csv";
    case "txt":
    default:
      return "text/plain";
  }
}
