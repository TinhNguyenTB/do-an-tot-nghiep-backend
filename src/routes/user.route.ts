import { Router } from "express";
import { userController } from "@/controllers/user.controller";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { RePaymentDto } from "@/dtos/re-payment.dto";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { dynamicRbacMiddleware } from "@/middlewares/rbac.middleware";

const router = Router();

router.get("/users", authMiddleware, dynamicRbacMiddleware, userController.getUsers);

router.post("/users", authMiddleware, dynamicRbacMiddleware, userController.createUser);

router.get("/users/:id", authMiddleware, dynamicRbacMiddleware, userController.getUserDetails);

router.patch("/users/:id", authMiddleware, dynamicRbacMiddleware, userController.updateUser);

router.post("/users/re-payment", ValidationPipe(RePaymentDto), userController.rePayment);

export const userRoute = router;
