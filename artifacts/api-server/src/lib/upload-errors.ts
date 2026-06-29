import type { Request, Response } from "express";

export type UploadStage =
  | "received"
  | "auth"
  | "validation"
  | "storage"
  | "extraction"
  | "database"
  | "indexing"
  | "subscription"
  | "complete";

export interface UploadErrorBody {
  error: string;
  message: string;
  stage: UploadStage | string;
  fileName: string | null;
  requestId: string;
  code?: string;
  upgradeUrl?: string;
}

export function getRequestId(req: Request): string {
  const id = (req as Request & { id?: string | number }).id;
  return id != null ? String(id) : "unknown";
}

export function uploadErrorResponse(
  req: Request,
  res: Response,
  status: number,
  stage: UploadStage | string,
  message: string,
  fileName?: string | null,
  extra?: Partial<Pick<UploadErrorBody, "code" | "upgradeUrl">>,
): void {
  const body: UploadErrorBody = {
    error: message,
    message,
    stage,
    fileName: fileName ?? null,
    requestId: getRequestId(req),
    ...extra,
  };
  res.status(status).json(body);
}

export function uploadLogContext(
  req: Request,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    requestId: getRequestId(req),
    ...extra,
  };
}