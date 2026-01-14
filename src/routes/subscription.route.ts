import { Router } from "express";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { subscriptionController } from "@/controllers/subscription.controller";
import { CreateSubscriptionDto } from "@/dtos/subscription.dto";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { rbacMiddleware } from "@/middlewares/rbac.middleware";

const router = Router();

router.get("/subscriptions", subscriptionController.getSubscriptions);

router.get(
  "/subscriptions/my",
  authMiddleware,
  // rbacMiddleware,
  subscriptionController.getMySubscriptionHandler
);

router.get(
  "/subscriptions/:id",
  authMiddleware,
  // rbacMiddleware,
  subscriptionController.getSubscription
);

router.patch(
  "/subscriptions/:id",
  authMiddleware,
  // rbacMiddleware,
  subscriptionController.updateSubscription
);

router.post(
  "/subscriptions",
  authMiddleware,
  // rbacMiddleware,
  ValidationPipe(CreateSubscriptionDto),
  subscriptionController.createSubscription
);

router.delete(
  "/subscriptions/:id",
  authMiddleware,
  // rbacMiddleware,
  subscriptionController.deleteSubscription
);

router.post(
  "/subscriptions/renew",
  authMiddleware,
  // rbacMiddleware,
  subscriptionController.renewSubscription
);

export const subscriptionRoute = router;
