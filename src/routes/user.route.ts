import { Router } from "express";
import { userController } from "@/controllers/user.controller";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { RePaymentDto } from "@/dtos/re-payment.dto";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { rbacMiddleware } from "@/middlewares/rbac.middleware";
import { SendOTPDto, UpdateUserDto } from "@/dtos/user.dto";

const router = Router();

router.get(
  "/users",
  authMiddleware,
  // rbacMiddleware,
  userController.getUsers
);

router.post(
  "/users",
  authMiddleware,
  // rbacMiddleware,
  userController.createUser
);

router.get(
  "/users/:id",
  authMiddleware,
  // rbacMiddleware,
  userController.getUserDetails
);

router.patch(
  "/users/:id",
  authMiddleware,
  // rbacMiddleware,
  ValidationPipe(UpdateUserDto),
  userController.updateUser
);

router.delete(
  "/users/:id",
  authMiddleware,
  // rbacMiddleware,
  userController.deleteUser
);

router.post("/users/re-payment", ValidationPipe(RePaymentDto), userController.rePayment);

router.post(
  "/users/sendOTP",
  // rbacMiddleware,
  ValidationPipe(SendOTPDto),
  userController.sendOTP
);

export const userRoute = router;
