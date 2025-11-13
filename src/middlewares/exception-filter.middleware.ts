import { Request, Response, NextFunction } from "express";
import { HttpException } from "@/exceptions/http-exception";
import { getReasonPhrase, StatusCodes } from "http-status-codes";

export const exceptionFilter = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("❌ Error:", err);

  if (err instanceof HttpException) {
    return res.status(err.statusCode).json({
      statusCode: err.statusCode,
      message: err.message,
      errors: err.errors || null,
    });
  }

  // Fallback cho lỗi không xác định
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    message: getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR),
  });
};
