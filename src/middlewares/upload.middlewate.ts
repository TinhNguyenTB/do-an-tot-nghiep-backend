import { HttpException } from "@/exceptions/http-exception";
import { StatusCodes } from "http-status-codes";
import multer from "multer";

const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

    if (!allowedTypes.includes(file.mimetype)) {
      cb(new HttpException(StatusCodes.BAD_REQUEST, "Chỉ hỗ trợ PNG, JPG, WEBP"));
      return;
    }

    cb(null, true);
  },
}).single("file"); // field name = file
