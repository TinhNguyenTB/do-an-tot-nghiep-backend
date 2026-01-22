import cron from "node-cron";
import prisma from "@/prismaClient";
import { sendMailTemplate } from "@/utils/mail";

export const checkSubscriptionExpiration = () => {
  // '*/1 * * * *'
  cron.schedule("0 0 * * *", async () => {
    console.log("Đang kiểm tra các gói sắp hết hạn...");

    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const targetDateStart = new Date(threeDaysFromNow.setHours(0, 0, 0, 0));
    const targetDateEnd = new Date(threeDaysFromNow.setHours(23, 59, 59, 999));

    const expiringSubs = await prisma.userSubscription.findMany({
      where: {
        status: "ACTIVE",
        endDate: {
          gte: targetDateStart,
          lte: targetDateEnd,
        },
      },
      include: {
        user: true,
        subscription: true,
      },
    });

    for (const sub of expiringSubs) {
      await sendMailTemplate({
        to: sub.user.email,
        subject: "⚠️ Cảnh báo hết hạn gói dịch vụ",
        template: "expiration-warning",
        context: {
          userName: sub.user.name,
          packageName: sub.subscription.name,
          expiryDate: sub.endDate.toLocaleDateString("vi-VN"),
          year: new Date().getFullYear(),
        },
      });
    }
  });
};
