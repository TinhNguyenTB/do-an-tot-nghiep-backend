import { Router } from "express";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { rbacMiddleware } from "@/middlewares/rbac.middleware";
import { endpointPermissionController } from "@/controllers/endpoint-permission.controller";
import { paymentController } from "@/controllers/payment.controller";

const router = Router();

router.get(
  "/payments/history",
  authMiddleware,
  // rbacMiddleware,
  paymentController.getOrgPaymentHistory
);

export const paymentRoute = router;
