import { Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

export const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "10485760", 10);

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
]);

export interface UploadFieldOption {
  name: string;
  maxCount: number;
}

export interface UploadFieldsMiddlewareOptions {
  fields: UploadFieldOption[];
  subfolder: string;
  allowedTypes?: Set<string>;
  fileSizeLimit?: number;
}

function ensureUploadDir(subfolder: string): string {
  const dir = path.resolve(process.cwd(), UPLOAD_DIR, subfolder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function generateUniqueFileName(originalName: string): string {
  const ext = path.extname(originalName);
  const baseName = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9_\-.]/g, "_")
    .slice(0, 100);
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `${baseName}-${uniqueSuffix}${ext}`;
}

export function createUploadFieldsMiddleware(options: UploadFieldsMiddlewareOptions) {
  const {
    fields,
    subfolder,
    allowedTypes = ALLOWED_IMAGE_TYPES,
    fileSizeLimit = MAX_FILE_SIZE,
  } = options;

  const uploadDir = ensureUploadDir(subfolder);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueFileName = generateUniqueFileName(file.originalname);
      cb(null, uniqueFileName);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: fileSizeLimit },
    fileFilter: (_req, file, cb) => {
      if (allowedTypes.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type '${file.mimetype}' is not allowed`));
      }
    },
  }).fields(fields);

  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        cleanupUploadedFiles(req);
        let errorMessage: string;
        switch (err.code) {
          case "LIMIT_FILE_SIZE":
            errorMessage = `File size exceeds the limit of ${Math.round(fileSizeLimit / 1024 / 1024)}MB`;
            break;
          case "LIMIT_FILE_COUNT":
            errorMessage = "Too many files uploaded";
            break;
          case "LIMIT_UNEXPECTED_FILE":
            errorMessage = `Unexpected file field: ${err.field}`;
            break;
          default:
            errorMessage = `File upload error: ${err.message}`;
        }
        res.status(400).json({ success: false, message: errorMessage });
        return;
      }
      if (err) {
        cleanupUploadedFiles(req);
        res.status(400).json({ success: false, message: err.message });
        return;
      }
      next();
    });
  };
}

export function getUploadedFilePath(
  req: Request,
  fieldName: string,
  subfolder: string
): string | undefined {
  const files = req.files as { [key: string]: Express.Multer.File[] } | undefined;
  if (files && files[fieldName] && files[fieldName].length > 0) {
    const file = files[fieldName][0];
    return `/${UPLOAD_DIR}/${subfolder}/${file.filename}`;
  }
  if (req.file && req.file.fieldname === fieldName) {
    return `/${UPLOAD_DIR}/${subfolder}/${req.file.filename}`;
  }
  return undefined;
}

export function cleanupUploadedFiles(req: Request): void {
  if (req.file) {
    try {
      fs.unlinkSync(req.file.path);
    } catch {}
  }
  const files = req.files as
    | Express.Multer.File[]
    | { [key: string]: Express.Multer.File[] }
    | undefined;
  if (!files) return;

  if (Array.isArray(files)) {
    for (const file of files) {
      try {
        fs.unlinkSync(file.path);
      } catch {}
    }
  } else if (typeof files === "object") {
    for (const key of Object.keys(files)) {
      const fileList = files[key];
      if (Array.isArray(fileList)) {
        for (const file of fileList) {
          try {
            fs.unlinkSync(file.path);
          } catch {}
        }
      }
    }
  }
}

export function deleteFile(relativePath: string): void {
  if (!relativePath) return;
  const normalized = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
  const fullPath = path.resolve(process.cwd(), normalized);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch (e: any) {
      console.warn(`[UploadUtils] Failed to delete file: ${fullPath} - ${e.message}`);
    }
  }
}
