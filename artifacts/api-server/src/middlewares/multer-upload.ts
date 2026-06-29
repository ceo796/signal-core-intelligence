import type { Request, Response, NextFunction, RequestHandler } from "express";
import multer from "multer";
import { uploadErrorResponse } from "../lib/upload-errors";

export const UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
export const UPLOAD_MAX_MB = UPLOAD_MAX_BYTES / (1024 * 1024);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_BYTES },
});

export function singleFileUpload(fieldName: string): RequestHandler {
  const middleware = upload.single(fieldName);

  return (req: Request, res: Response, next: NextFunction): void => {
    middleware(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }

      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          uploadErrorResponse(
            req,
            res,
            413,
            "validation",
            `File exceeds the ${UPLOAD_MAX_MB} MB upload limit.`,
            null,
            { code: "file_too_large" },
          );
          return;
        }

        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          uploadErrorResponse(
            req,
            res,
            400,
            "validation",
            `Unexpected form field "${err.field}". Use the "file" field for uploads.`,
            null,
            { code: "invalid_form_field" },
          );
          return;
        }

        uploadErrorResponse(
          req,
          res,
          400,
          "validation",
          err.message || "Invalid upload request.",
          null,
          { code: err.code },
        );
        return;
      }

      const message = err instanceof Error ? err.message : "Invalid upload request.";
      uploadErrorResponse(req, res, 400, "validation", message, null, { code: "upload_rejected" });
    });
  };
}