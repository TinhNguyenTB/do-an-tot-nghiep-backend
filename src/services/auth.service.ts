import { HttpException } from "@/exceptions/http-exception";
import prisma from "@/prismaClient";
import { generateOtp } from "@/utils/generateOtp";
import { sendMailTemplate } from "@/utils/mail";
import { StatusCodes } from "http-status-codes";
import crypto from "crypto";
import * as bcrypt from "bcrypt";

export async function sendResetOtp(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Email không tồn tại");
  }

  const { otp, otpHash } = generateOtp();
  const expiresIn = 5; // phút
  const expiresAt = new Date(Date.now() + expiresIn * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      otpHash,
      expiresAt,
    },
  });

  await sendMailTemplate({
    to: user.email,
    subject: "Mã OTP đổi mật khẩu",
    template: "reset-password-otp",
    context: {
      email: user.email,
      otp,
      expiresIn,
      year: new Date().getFullYear(),
    },
  });

  return { expiresIn: expiresIn * 60 };
}

export async function resetPassword(email: string, otp: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Email không tồn tại");
  }

  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

  const token = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      otpHash,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!token) {
    throw new HttpException(StatusCodes.BAD_REQUEST, "OTP không hợp lệ hoặc đã hết hạn");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { used: true },
    }),
  ]);
}
