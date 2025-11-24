import express, { Router, Request, Response, NextFunction } from "express";
import { handleWebhook } from "@/services/webhook.service";
import { StatusCodes } from "http-status-codes";

const router = Router();

router.post(
  "/",
  express.raw({ type: "application/json" }),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawBody: Buffer = req.body;
      const signature = req.headers["stripe-signature"] as string;

      if (!rawBody || !signature) {
        // ✨ Dùng RETURN để đảm bảo hàm kết thúc ngay lập tức
        return res.status(StatusCodes.BAD_REQUEST).send("Missing payload or signature");
      }

      await handleWebhook(rawBody, signature);

      // ✨ Dùng RETURN để đảm bảo hàm kết thúc ngay lập tức sau khi thành công
      return res.status(StatusCodes.OK).send("Success");
    } catch (error: any) {
      console.error("Webhook error:", error);

      let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
      let message = "Internal Server Error";

      // Nếu đó là HttpException
      if (error.status) {
        statusCode = error.status;
        message = error.message;
      } else if (error.statusCode) {
        // Xử lý các lỗi khác có status code (ví dụ: lỗi Stripe)
        statusCode = error.statusCode;
        message = error.message;
      }

      // ✨ Dùng RETURN ở đây.
      // Tuyệt đối không gọi next(error) nữa vì bạn đã gửi phản hồi.
      return res.status(statusCode).send(message);
    }
  }
);

export const webhookRoute = router;
