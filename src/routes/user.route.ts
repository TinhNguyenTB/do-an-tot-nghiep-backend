import { Router } from "express";
import { userController } from "@/controllers/user.controller";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { RePaymentDto } from "@/dtos/re-payment.dto";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { rbacMiddleware } from "@/middlewares/rbac.middleware";
import { ChangePasswordDto } from "@/dtos/user.dto";
import { uploadMiddleware } from "@/middlewares/upload.middlewate";

const router = Router();

router.get("/users", authMiddleware, rbacMiddleware, userController.getUsers);

router.post("/users", authMiddleware, rbacMiddleware, userController.createUser);

router.get("/users/:id", authMiddleware, rbacMiddleware, userController.getUserDetails);

router.patch("/users/:id", authMiddleware, rbacMiddleware, userController.updateUser);

router.post("/users/re-payment", ValidationPipe(RePaymentDto), userController.rePayment);

router.patch(
  "/users/change-password",
  authMiddleware,
  rbacMiddleware,
  ValidationPipe(ChangePasswordDto),
  userController.changePassword
);

router.post("/users/upload-avatar", authMiddleware, uploadMiddleware, userController.uploadAvatar);

export const userRoute = router;
