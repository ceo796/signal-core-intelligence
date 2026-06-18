import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const gcsClient = new Storage({
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

function parseStoragePath(fullPath: string): { bucketName: string; objectName: string } {
  const path = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
  const parts = path.split("/");
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
    throw new Error("PRIVATE_OBJECT_DIR is not set. Object storage is not configured.");
  }
  return dir.endsWith("/") ? dir.slice(0, -1) : dir;
}

export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  contentType: string
): Promise<string> {
  const privateDir = getPrivateDir();
  const objectId = randomUUID();
  const storageKey = `${privateDir}/documents/${objectId}`;

  const { bucketName, objectName } = parseStoragePath(storageKey);
  const bucket = gcsClient.bucket(bucketName);
  const file = bucket.file(objectName);

  await file.save(buffer, {
    contentType,
    metadata: { originalName },
  });

  return storageKey;
}

export async function downloadFile(storageKey: string): Promise<Buffer> {
  const { bucketName, objectName } = parseStoragePath(storageKey);
  const bucket = gcsClient.bucket(bucketName);
  const file = bucket.file(objectName);

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`File not found in object storage: ${storageKey}`);
  }

  const [buffer] = await file.download();
  return buffer;
}

export async function deleteFile(storageKey: string): Promise<void> {
  const { bucketName, objectName } = parseStoragePath(storageKey);
  const bucket = gcsClient.bucket(bucketName);
  await bucket.file(objectName).delete({ ignoreNotFound: true });
}

export function isConfigured(): boolean {
  return Boolean(process.env.PRIVATE_OBJECT_DIR && process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID);
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
