import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const LOCAL_STORAGE_PREFIX = "local://";

type StorageProvider = "local" | "replit-object-storage" | "none";

function getProvider(): StorageProvider {
  const configuredProvider = process.env.STORAGE_PROVIDER?.trim().toLowerCase();

  if (configuredProvider === "local" || configuredProvider === "render-disk") {
    return "local";
  }

  if (configuredProvider === "replit-object-storage") {
    return "replit-object-storage";
  }

  if (process.env.FILE_STORAGE_DIR) {
    return "local";
  }

  if (process.env.PRIVATE_OBJECT_DIR && process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID) {
    return "replit-object-storage";
  }

  return "none";
}

function assertProductionSafe(provider: StorageProvider): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (provider === "replit-object-storage") {
    throw new Error(
      "Production cannot use Replit object storage. Set STORAGE_PROVIDER=local and FILE_STORAGE_DIR=/var/data/uploads on Render, or migrate to an external object store.",
    );
  }

  const replitRuntimeKeys = ["REPL_ID", "REPL_SLUG", "REPL_OWNER", "REPLIT_DEPLOYMENT", "REPLIT_DOMAINS"];
  const detected = replitRuntimeKeys.filter((key) => process.env[key]);
  if (detected.length > 0) {
    throw new Error(`Production runtime still exposes Replit environment variables: ${detected.join(", ")}`);
  }
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

let gcsClient: Storage | null = null;

function getReplitGcsClient(): Storage {
  if (!gcsClient) {
    gcsClient = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: {
            type: "json",
            subject_token_field_name: "access_token",
          },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });
  }

  return gcsClient;
}

function parseStoragePath(fullPath: string): { bucketName: string; objectName: string } {
  const storagePath = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
  const parts = storagePath.split("/");
  if (parts.length < 3) {
    throw new Error(`Invalid storage path: ${fullPath}`);
  }
  return {
    bucketName: parts[1],
    objectName: parts.slice(2).join("/"),
  };
}

function getPrivateDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) {
    throw new Error("PRIVATE_OBJECT_DIR is not set. Replit object storage is not configured.");
  }
  return dir.endsWith("/") ? dir.slice(0, -1) : dir;
}

async function uploadReplitFile(buffer: Buffer, originalName: string, contentType: string): Promise<string> {
  const privateDir = getPrivateDir();
  const objectId = randomUUID();
  const storageKey = `${privateDir}/documents/${objectId}`;

  const { bucketName, objectName } = parseStoragePath(storageKey);
  const bucket = getReplitGcsClient().bucket(bucketName);
  const file = bucket.file(objectName);

  await file.save(buffer, {
    contentType,
    metadata: { originalName },
  });

  return storageKey;
}

async function downloadReplitFile(storageKey: string): Promise<Buffer> {
  const { bucketName, objectName } = parseStoragePath(storageKey);
  const bucket = getReplitGcsClient().bucket(bucketName);
  const file = bucket.file(objectName);

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`File not found in object storage: ${storageKey}`);
  }

  const [buffer] = await file.download();
  return buffer;
}

async function deleteReplitFile(storageKey: string): Promise<void> {
  const { bucketName, objectName } = parseStoragePath(storageKey);
  const bucket = getReplitGcsClient().bucket(bucketName);
  await bucket.file(objectName).delete({ ignoreNotFound: true });
}

export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  contentType: string,
): Promise<string> {
  const provider = getProvider();
  assertProductionSafe(provider);

  switch (provider) {
    case "local":
      return uploadLocalFile(buffer, originalName);
    case "replit-object-storage":
      return uploadReplitFile(buffer, originalName, contentType);
    default:
      throw new Error("Durable file storage is not configured.");
  }
}

export async function downloadFile(storageKey: string): Promise<Buffer> {
  if (storageKey.startsWith(LOCAL_STORAGE_PREFIX)) {
    return downloadLocalFile(storageKey);
  }

  const provider = getProvider();
  assertProductionSafe(provider);

  if (provider === "replit-object-storage") {
    return downloadReplitFile(storageKey);
  }

  throw new Error(`Unsupported or unavailable storage key: ${storageKey}`);
}

export async function deleteFile(storageKey: string): Promise<void> {
  if (storageKey.startsWith(LOCAL_STORAGE_PREFIX)) {
    await deleteLocalFile(storageKey);
    return;
  }

  const provider = getProvider();
  assertProductionSafe(provider);

  if (provider === "replit-object-storage") {
    await deleteReplitFile(storageKey);
  }
}

export function isConfigured(): boolean {
  const provider = getProvider();
  return provider === "local" || provider === "replit-object-storage";
}

export function getStorageProviderName(): StorageProvider {
  return getProvider();
}

export function getRuntimeStorageStatus() {
  const provider = getProvider();
  return {
    provider,
    configured: isConfigured(),
    fileStorageDir: process.env.FILE_STORAGE_DIR ? "set" : "missing",
    privateObjectDir: process.env.PRIVATE_OBJECT_DIR ? "set" : "missing",
    defaultObjectStorageBucketId: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ? "set" : "missing",
    productionSafe: process.env.NODE_ENV === "production" ? provider !== "replit-object-storage" : true,
  };
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
