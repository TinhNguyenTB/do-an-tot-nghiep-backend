import prisma from "@/prismaClient";
import Stripe from "stripe";
import { HttpException } from "@/exceptions/http-exception";
import { StatusCodes } from "http-status-codes";
import { UserStatus, PaymentStatus, SubscriptionStatus } from "@prisma/client";
import { stripe } from "@/configs/stripe.config";
import { logger } from "@/utils/logger";
import dayjs from "dayjs";
import { sendMailTemplate } from "@/utils/mail";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const safeParseInt = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const num = parseInt(value, 10);
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
    const isRenewal = session?.metadata?.isRenewal === "true";
    // (Lấy transactionId như code cũ của bạn)
    const transactionId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent as Stripe.PaymentIntent)?.id;

    const isChangePlan = session?.metadata?.isChangePlan === "true";
    const useBalance = session?.metadata?.useBalance === "true";
    const oldSubId = safeParseInt(session.metadata?.oldSubId);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });
        if (!user) throw new HttpException(StatusCodes.NOT_FOUND, "User not found");

        const subscription = await tx.subscription.findUnique({
          where: { id: subscriptionId },
        });

        if (!subscription) throw new HttpException(StatusCodes.NOT_FOUND, "Subscription not found");

        // 1. Cập nhật Payment SUCCESS
        const updatedPayment = await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: PaymentStatus.SUCCESS,
            transactionId: transactionId,
            paymentDate: new Date(),
          },
        });

        let finalEndDate: Date;

        // --- NHÁNH 1: THAY ĐỔI GÓI (UPGRADE/DOWNGRADE) ---
        if (isChangePlan) {
          // A. Trừ hết balance cũ nếu metadata báo đã dùng để khấu trừ trên Stripe
          if (useBalance) {
            await tx.user.update({
              where: { id: userId },
              data: { balance: 0 },
            });
          }

          // B. Hủy gói cũ ngay lập tức
          if (oldSubId) {
            await tx.userSubscription.update({
              where: { id: oldSubId },
              data: { status: SubscriptionStatus.EXPIRED },
            });
          }

          // C. Kích hoạt gói mới từ thời điểm hiện tại
          const startDate = new Date();
          finalEndDate = dayjs(startDate).add(subscription.duration, "day").toDate();

          await tx.userSubscription.create({
            data: {
              userId: userId!,
              subscriptionId: subscriptionId!,
              startDate,
              endDate: finalEndDate,
              status: SubscriptionStatus.ACTIVE,
              paymentId: updatedPayment.id,
            },
          });
        }
        // --- NHÁNH 2: GIA HẠN ---
        else if (isRenewal) {
          // Tìm gói cũ đang ACTIVE
          const currentActiveSub = await tx.userSubscription.findFirst({
            where: {
              userId: userId,
              status: SubscriptionStatus.ACTIVE,
            },
            orderBy: { endDate: "desc" }, // Lấy gói có hạn xa nhất
          });

          let newStartDate =
            currentActiveSub && currentActiveSub.endDate > new Date()
              ? currentActiveSub.endDate
              : new Date();

          finalEndDate = new Date(newStartDate);
          finalEndDate.setDate(newStartDate.getDate() + subscription.duration);

          if (currentActiveSub && currentActiveSub.endDate > new Date()) {
            // Cập nhật thẳng vào gói cũ nếu muốn nối dài
            await tx.userSubscription.update({
              where: { id: currentActiveSub.id },
              data: {
                endDate: finalEndDate,
                subscriptionId: subscriptionId, // Đề phòng họ đổi gói khi gia hạn
              },
            });
          } else {
            // Tạo bản ghi mới nếu gói cũ đã hết hạn
            await tx.userSubscription.create({
              data: {
                userId: userId!,
                subscriptionId: subscriptionId!,
                startDate: newStartDate,
                endDate: finalEndDate,
                status: SubscriptionStatus.ACTIVE,
                paymentId: updatedPayment.id,
              },
            });
          }
        } else {
          // --- LOGIC ĐĂNG KÝ MỚI  ---
          await tx.user.update({
            where: { id: userId },
            data: { status: UserStatus.ACTIVE },
          });

          const startDate = new Date();
          finalEndDate = new Date();
          finalEndDate.setDate(startDate.getDate() + subscription.duration);

          await tx.userSubscription.create({
            data: {
              userId: userId!,
              subscriptionId: subscriptionId!,
              startDate,
              endDate: finalEndDate,
              status: SubscriptionStatus.ACTIVE,
              paymentId: updatedPayment.id,
            },
          });
        }
        return {
          email: user.email,
          name: user.name,
          subName: subscription,
          price: subscription.price,
          expiryDate: finalEndDate,
          isRenewal: isRenewal,
          isChangePlan,
        };
      });

      // 2. Gửi Email (Xác định subject linh hoạt hơn)
      let subject = "Kích hoạt dịch vụ thành công";
      if (result.isRenewal) subject = "Gia hạn dịch vụ thành công";
      if (result.isChangePlan) subject = "Thay đổi gói dịch vụ thành công";

      await sendMailTemplate({
        to: result.email,
        subject,
        template: "subscription-success",
        context: {
          name: result.name,
          subName: result.subName,
          expiryDate: dayjs(result.expiryDate).format("DD/MM/YYYY"),
          type: result.isChangePlan ? "thay đổi gói" : result.isRenewal ? "gia hạn" : "đăng ký mới",
          year: new Date().getFullYear(),
        },
      });

      logger.success(`User ${userId} processed and email sent to ${result.email}`);
      return "Success";
    } catch (e) {
      console.error(`Webhook Transaction failed:`, e);
      if (!(e instanceof HttpException)) {
        throw new HttpException(StatusCodes.INTERNAL_SERVER_ERROR, "Webhook processing failed.");
      }
      throw e;
    }
  }

  // 4. Xử lý các sự kiện khác (trả về 200 OK để Stripe không gửi lại)
  logger.info(`Received unhandled event type: ${event.type}`);
  return `Event handled: ${event.type}`;
}
