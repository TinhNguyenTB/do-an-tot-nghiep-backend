import { Router } from "express";
import { userController } from "@/controllers/user.controller";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { RegisterUserDto } from "@/dtos/user.dto";
import { LoginDto } from "@/dtos/login.dto";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { rbacMiddleware } from "@/middlewares/rbac.middleware";
import { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from "@/dtos/auth.dto";
import { authController } from "@/controllers/auth.controller";

const router = Router();

router.post("/auth/register", ValidationPipe(RegisterUserDto), userController.registerUser);
router.post("/auth/login", ValidationPipe(LoginDto), userController.login);
router.delete("/auth/logout", userController.logout);
router.put("/auth/refresh", userController.refreshToken);

router.patch(
  "/auth/change-password",
  authMiddleware,
  rbacMiddleware,
  ValidationPipe(ChangePasswordDto),
  userController.changePassword
);

router.get("/auth/profile", authMiddleware, userController.getProfile);

router.post(
  "/auth/forgot-password",
  ValidationPipe(ForgotPasswordDto),
  authController.forgotPassword
);

router.post("/auth/reset-password", ValidationPipe(ResetPasswordDto), authController.resetPassword);

export const authRoute = router;
