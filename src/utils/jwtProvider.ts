import { HttpException } from "@/exceptions/http-exception";
import { StatusCodes } from "http-status-codes";
import * as jwt from "jsonwebtoken";
import ms from "ms";

interface JwtPayload {
  id: number;
  email: string;
  roles: string[];
  organizationId?: number | null;
}

export interface VerifiedPayload {
  id: number;
  email: string;
  name: string;
  roles: string[]; // Lưu ý: roles đã được ánh xạ thành mảng string
  organizationId?: number | null;
  iat: number; // Issued at
  exp: number; // Expiration time
}

export function generateToken(
  payload: JwtPayload,
  jwtSecret: string,
  expiresIn: ms.StringValue
): string {
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured in environment variables.");
  }

  try {
    return jwt.sign(payload, jwtSecret, {
      expiresIn: expiresIn,
      algorithm: "HS512",
    });
  } catch (error: any) {
    console.error("JWT signing failed:", error);
    throw new Error(`Failed to generate token: ${error.message}`);
  }
}

export function verifyToken(token: string, jwtSecret: string): VerifiedPayload {
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured in environment variables.");
  }

  try {
    // Nếu token hết hạn hoặc chữ ký sai, jwt.verify sẽ tự động throw lỗi.
    const decoded = jwt.verify(token, jwtSecret) as VerifiedPayload;
    return decoded;
  } catch (error: any) {
    // Nếu là lỗi Hết hạn
    if (error.name === "TokenExpiredError") {
      // ⚠️ Throw lỗi gốc để middleware bắt tên lỗi
      throw error;
    }

    // Xử lý lỗi JWT khác (ví dụ: JsonWebTokenError - Chữ ký không hợp lệ)
    let errorMessage = "Token không hợp lệ";
    throw new HttpException(StatusCodes.UNAUTHORIZED, errorMessage);
  }
}
