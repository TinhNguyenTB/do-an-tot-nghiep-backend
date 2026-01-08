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
  ResetPasswordDto,
  UpdateProfileDto,
} from "@/dtos/auth.dto";
import { authController } from "@/controllers/auth.controller";
import { uploadMiddleware } from "@/middlewares/upload.middleware";

const router = Router();
router.post("/auth/check-email", authController.checkEmailAvailability);

router.post("/auth/register", ValidationPipe(RegisterUserDto), userController.registerUser);
router.post("/auth/login", ValidationPipe(LoginDto), userController.login);
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
  // authMiddleware,
  ValidationPipe(UpdateProfileDto),
  authController.updateProfile
);

router.post(
  "/auth/forgot-password",
  ValidationPipe(ForgotPasswordDto),
  authController.forgotPassword
);

router.post("/auth/reset-password", ValidationPipe(ResetPasswordDto), authController.resetPassword);

router.post("/auth/upload-avatar", authMiddleware, uploadMiddleware, userController.uploadAvatar);

export const authRoute = router;
