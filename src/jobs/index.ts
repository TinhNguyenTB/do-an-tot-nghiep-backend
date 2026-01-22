import { checkSubscriptionExpiration } from "./check-expiration";

export const initCronJobs = () => {
  console.log("--- Initializing Cron Jobs ---");

  // Khởi chạy job kiểm tra hết hạn
  checkSubscriptionExpiration();
};
