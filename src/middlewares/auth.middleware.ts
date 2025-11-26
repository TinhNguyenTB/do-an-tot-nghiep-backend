import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { HttpException } from "@/exceptions/http-exception";
import { VerifiedPayload, verifyToken } from "@/utils/jwtProvider";

export interface AuthenticatedRequest extends Request {
  user?: VerifiedPayload;
}

const ACCESS_TOKEN_KEY = "accessToken";
const JWT_SECRET = process.env.JWT_SECRET;

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // 1. ✨ Lấy accessToken từ req.cookies
  const accessToken = req.cookies[ACCESS_TOKEN_KEY];

  if (!accessToken) {
    throw new HttpException(StatusCodes.UNAUTHORIZED, "Không tìm thấy accessToken trong Cookie.");
  }

  try {
    // 2. Xác thực accessToken
    const decodedPayload = verifyToken(accessToken, JWT_SECRET!);

    // 3. Gán payload vào request và tiếp tục
    req.user = decodedPayload;
    next();
  } catch (error: any) {
    let statusCode = StatusCodes.UNAUTHORIZED;
    let errorMessage = "Token không hợp lệ.";

    // 4. Bắt lỗi cụ thể (Hết hạn)
    if (error.name === "TokenExpiredError") {
      errorMessage = "Token đã hết hạn. Vui lòng refresh token.";
      // Trả về 410 GONE để frontend gọi API refresh
      statusCode = StatusCodes.GONE;
    } else if (error instanceof HttpException) {
      // Xử lý các HttpException được throw từ verifyToken (ví dụ: chữ ký không hợp lệ)
      statusCode = error.statusCode;
      errorMessage = error.message;
    }
    console.error("Error from authMiddleware:", error);
    // 5. Trả về lỗi
    return res.status(statusCode).json({ message: errorMessage });
  }
};
