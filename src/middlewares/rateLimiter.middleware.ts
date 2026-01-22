import rateLimit from "express-rate-limit";
import { StatusCodes } from "http-status-codes";

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // Tối đa 100 requests mỗi IP
  message: {
    message: "Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 5, // Chỉ được sai/thử tối đa 5 lần mỗi giờ
  message: {
    message: "Phát hiện hành vi đăng nhập bất thường. Vui lòng thử lại sau 1 giờ.",
  },
  statusCode: StatusCodes.TOO_MANY_REQUESTS,
});
