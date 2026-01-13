import { wrapAsync } from "@/utils/wrapAsync";
import { Request, Response } from "express";
import * as authService from "@/services/auth.service";
import { StatusCodes } from "http-status-codes";
import { ForgotPasswordDto, UpdateProfileDto } from "@/dtos/auth.dto";
import { logger } from "@/utils/logger";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware";

const forgotPassword = wrapAsync(async (req: Request, res: Response) => {
  logger.info(`Send OTP to ${req.body.email}...`);
  const { email } = req.body as ForgotPasswordDto;

  const result = await authService.sendResetOtp(email);

  res.locals.message = "OTP đã được gửi về email";
  res.status(StatusCodes.OK).json({
    expiresIn: result.expiresIn,
  });
});

const resetPassword = wrapAsync(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  await authService.resetPassword(email, otp, newPassword);

  res.locals.message = "Đổi mật khẩu thành công";
  res.status(StatusCodes.OK).json();
});

const updateProfile = wrapAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const body = req.body as UpdateProfileDto;

  const result = await authService.updateUserProfile(userId!, body);

  res.locals.message = "Cập nhật hồ sơ thành công";
  res.status(StatusCodes.OK).json(result);
});

const checkEmailAvailability = wrapAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: "Vui lòng cung cấp email hợp lệ." });
  }

  logger.info(`Checking email availability for: ${email}`);

  const emailExists = await authService.checkEmailExists(email);

  if (emailExists) {
    res.locals.message = "Email này đã được sử dụng. Vui lòng chọn email khác.";
    res.status(StatusCodes.CONFLICT).json({
      isAvailable: false,
    });
  } else {
    res.locals.message = "Email sẵn sàng để đăng ký.";
    res.status(StatusCodes.OK).json({
      isAvailable: true,
    });
  }
});

export const authController = {
  forgotPassword,
  resetPassword,
  updateProfile,
  checkEmailAvailability,
};
