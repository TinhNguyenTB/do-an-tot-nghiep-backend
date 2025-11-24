import prisma from "@/prismaClient"; // Giả định import Prisma Client đã cấu hình
import Stripe from "stripe";
import { HttpException } from "@/exceptions/http-exception"; // Sử dụng HttpException custom
import { StatusCodes } from "http-status-codes";
import { UserStatus, PaymentStatus, SubscriptionStatus } from "@prisma/client";
import { stripe } from "@/configs/stripe.config"; // Giả định instance Stripe đã được khởi tạo
import { logger } from "@/utils/logger"; // Giả định logger

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
// const FRONTEND_URL = process.env.FRONTEND_URL; // Không cần thiết trong webhook xử lý logic

/**
 * Hàm tiện ích kiểm tra số nguyên dương an toàn từ chuỗi metadata.
 * Trả về number hợp lệ hoặc undefined.
 */
const safeParseInt = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const num = parseInt(value, 10);
  // Đảm bảo là số, không phải NaN, và là số dương (ID thường là số dương)
  return isNaN(num) || num <= 0 ? undefined : num;
};

/**
 * Xử lý sự kiện Webhook từ Stripe sau khi thanh toán thành công.
 * @param rawBody Dữ liệu thô (Buffer) từ request.
 * @param signature Stripe-Signature từ header.
 */
export async function handleWebhook(rawBody: Buffer, signature: string): Promise<string> {
  if (!STRIPE_WEBHOOK_SECRET) {
    logger.error("STRIPE_WEBHOOK_SECRET is not configured.");
    throw new HttpException(StatusCodes.INTERNAL_SERVER_ERROR, "Webhook secret not configured.");
  }

  let event: Stripe.Event;

  // 1. Xác thực Webhook Signature (Bắt buộc phải dùng rawBody)
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error: any) {
    throw new HttpException(
      StatusCodes.BAD_REQUEST,
      `Webhook signature verification failed: ${error.message}`
    );
  }

  // 2. Trích xuất Session và Metadata
  const session = event.data.object as Stripe.Checkout.Session;

  // Trích xuất metadata an toàn
  const paymentId = safeParseInt(session?.metadata?.paymentId);
  const userId = safeParseInt(session?.metadata?.userId);
  const subscriptionId = safeParseInt(session?.metadata?.subscriptionId);

  // 3. Xử lý sự kiện 'checkout.session.completed'
  if (event.type === "checkout.session.completed") {
    // Chỉ cần transaction ID khi thanh toán đã hoàn tất
    const transactionId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent as Stripe.PaymentIntent)?.id;

    // Kiểm tra dữ liệu BẮT BUỘC
    if (!paymentId || !userId || !subscriptionId) {
      console.error(
        "Missing User/Payment/Subscription metadata in completed session.",
        session.metadata
      );
      throw new HttpException(
        StatusCodes.BAD_REQUEST,
        "Missing User/Payment/Subscription metadata."
      );
    }

    if (!transactionId) {
      console.error("Missing payment intent ID for completed session.", session.id);
      throw new HttpException(StatusCodes.BAD_REQUEST, "Missing payment intent ID.");
    }

    // BỌC TRONG TRANSACTION ĐỂ ĐẢM BẢO TÍNH NGUYÊN TỬ
    try {
      await prisma.$transaction(async (tx) => {
        // Lấy thông tin gói dịch vụ
        const subscription = await tx.subscription.findUnique({
          where: { id: subscriptionId },
        });

        if (!subscription) {
          // Log lỗi nghiêm trọng, nhưng vẫn phải gửi 200 cho Stripe
          logger.error(`Subscription ID ${subscriptionId} not found. Cannot activate user.`);
          throw new HttpException(
            StatusCodes.INTERNAL_SERVER_ERROR,
            "Subscription data not found."
          );
        }

        // A. Cập nhật Payment Status
        // Kiểm tra xem Payment đã được xử lý chưa (tránh webhook gửi lại)
        const existingPayment = await tx.payment.findUnique({ where: { id: paymentId } });
        if (existingPayment?.status === PaymentStatus.SUCCESS) {
          logger.warn(`Payment ID ${paymentId} already processed.`);
          return; // Đã xử lý, thoát transaction
        }

        const updatedPayment = await tx.payment.update({
          where: { id: paymentId, userId: userId, status: PaymentStatus.PENDING },
          data: {
            status: PaymentStatus.SUCCESS,
            transactionId: transactionId,
            paymentDate: new Date(),
          },
        });

        // B. Cập nhật User Status
        await tx.user.update({
          where: { id: userId, status: UserStatus.PENDING },
          data: { status: UserStatus.ACTIVE },
        });

        // C. Tạo UserSubscription
        const durationDays = subscription.duration;
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + durationDays);

        await tx.userSubscription.create({
          data: {
            userId: userId,
            subscriptionId: subscriptionId,
            paymentId: updatedPayment.id,
            startDate: startDate,
            endDate: endDate,
            status: SubscriptionStatus.ACTIVE,
          },
        });
        logger.success(
          `User with ID: ${userId} successfully activated with subscription ${subscriptionId}.`
        );
      });

      return "Success";
    } catch (e) {
      // Log lỗi transaction và throw lại để Controller xử lý response code (4xx, 5xx)
      console.error(`Transaction failed for Payment ID ${paymentId}:`, e);
      // Nếu lỗi không phải HttpException, throw Internal Server Error
      if (!(e instanceof HttpException)) {
        throw new HttpException(StatusCodes.INTERNAL_SERVER_ERROR, "Database transaction failed.");
      }
      throw e; // Throw lỗi HttpException custom
    }
  }

  // 4. Xử lý các sự kiện khác (trả về 200 OK để Stripe không gửi lại)
  logger.info(`Received unhandled event type: ${event.type}`);
  return `Event handled: ${event.type}`;
}
