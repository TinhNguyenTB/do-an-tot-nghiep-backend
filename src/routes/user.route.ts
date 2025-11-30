import { Router } from "express";
import { userController } from "@/controllers/user.controller";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { RePaymentDto } from "@/dtos/re-payment.dto";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { rbacMiddleware } from "@/middlewares/rbac.middleware";

const router = Router();

router.get(
  "/",
  authMiddleware,
  rbacMiddleware.isValidPermission(["manage_all_users"]),
  userController.getUsers
);

router.get(
  "/:id",
  authMiddleware,
  rbacMiddleware.isValidPermission(["manage_all_users"]),
  userController.getUserDetails
);

router.patch(
  "/:id",
  authMiddleware,
  rbacMiddleware.isValidPermission(["manage_all_users"]),
  userController.updateUser
);

router.post("/re-payment", ValidationPipe(RePaymentDto), userController.rePayment);

export const userRoute = router;
