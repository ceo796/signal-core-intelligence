import { randomUUID } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

const LOCAL_STORAGE_PREFIX = "local://";

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

  return `${LOCAL_STORAGE_PREFIX}${relativePath.replace(/\\/g, "/")}`;
}

async function downloadLocalFile(storageKey: string): Promise<Buffer> {
  if (!storageKey.startsWith(LOCAL_STORAGE_PREFIX)) {
    throw new Error(`Invalid local storage key: ${storageKey}`);
  }

  const relativePath = storageKey.slice(LOCAL_STORAGE_PREFIX.length);
  const absolutePath = path.join(getLocalStorageDir(), relativePath);
  return readFile(absolutePath);
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
