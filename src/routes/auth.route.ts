import { Router } from "express";
import { userController } from "@/controllers/user.controller";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { RegisterUserDto } from "@/dtos/user.dto";
import { LoginDto } from "@/dtos/login.dto";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { rbacMiddleware } from "@/middlewares/rbac.middleware";
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  IntroSpectDto,
  ResetPasswordDto,
  UpdateProfileDto,
  VerifyOTPDto,
} from "@/dtos/auth.dto";
import { authController } from "@/controllers/auth.controller";
import { uploadMiddleware } from "@/middlewares/upload.middleware";
import { loginLimiter } from "@/middlewares/rateLimiter.middleware";

const router = Router();
router.post("/auth/check-email", authController.checkEmailAvailability);

router.post("/auth/register", ValidationPipe(RegisterUserDto), userController.registerUser);
router.post("/auth/login", loginLimiter, ValidationPipe(LoginDto), userController.login);
router.delete("/auth/logout", userController.logout);
router.put("/auth/refresh", userController.refreshToken);

router.patch(
  "/auth/change-password",
  authMiddleware,
  // rbacMiddleware,
  ValidationPipe(ChangePasswordDto),
  userController.changePassword
);

router.get("/auth/profile", authMiddleware, userController.getProfile);

router.patch(
  "/auth/profile",
  authMiddleware,
  ValidationPipe(UpdateProfileDto),
  authController.updateProfile
);

router.post(
  "/auth/forgot-password",
  ValidationPipe(ForgotPasswordDto),
  authController.forgotPassword
);

router.post("/auth/reset-password", ValidationPipe(ResetPasswordDto), authController.resetPassword);

router.post("/auth/verifyOTP", ValidationPipe(VerifyOTPDto), authController.verifyOTP);

router.post("/auth/upload-avatar", authMiddleware, uploadMiddleware, userController.uploadAvatar);

router.post(
  "/auth/introspect",
  authMiddleware,
  ValidationPipe(IntroSpectDto),
  authController.handleIntrospect
);

export const authRoute = router;
