import { Router } from "express";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { subscriptionController } from "@/controllers/subscription.controller";
import { CreateSubscriptionDto } from "@/dtos/subscription.dto";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { rbacMiddleware } from "@/middlewares/rbac.middleware";

const router = Router();

router.get("/", subscriptionController.getSubscriptions);

router.get(
  "/:id",
  authMiddleware,
  rbacMiddleware.isValidPermission(["manage_all_subscriptions"]),
  subscriptionController.getSubscription
);

router.patch(
  "/:id",
  authMiddleware,
  rbacMiddleware.isValidPermission(["manage_all_subscriptions"]),
  subscriptionController.updateSubscription
);

router.post(
  "/",
  authMiddleware,
  rbacMiddleware.isValidPermission(["manage_all_subscriptions"]),
  ValidationPipe(CreateSubscriptionDto),
  subscriptionController.createSubscription
);

router.delete(
  "/:id",
  authMiddleware,
  rbacMiddleware.isValidPermission(["manage_all_subscriptions"]),
  subscriptionController.deleteSubscription
);

export const subscriptionRoute = router;
