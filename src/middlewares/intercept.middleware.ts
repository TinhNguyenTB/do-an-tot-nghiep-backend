import { Request, Response, NextFunction } from "express";
import { responseInterceptor } from "@/interceptors/response.interceptor";

export const responseTransformInterceptor = (req: Request, res: Response, next: NextFunction) => {
  // Giữ lại hàm gốc
  const originalJson = res.json.bind(res);

  // Ghi đè lại res.json
  res.json = (result: any) => {
    // Nếu đã có statusCode (do ExceptionFilter gửi), không format lại
    if (result && typeof result === "object" && "statusCode" in result) {
      return originalJson(result);
    }

    const formatted = responseInterceptor(result, res.locals.message || "Success");

    return originalJson(formatted);
  };

  next();
};
