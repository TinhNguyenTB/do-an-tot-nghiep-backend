import crypto from "crypto";

export function generateOtp() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 số
  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

  return { otp, otpHash };
}
