import { Router } from "express";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { subscriptionController } from "@/controllers/subscription.controller";
import { CreateSubscriptionDto } from "@/dtos/subscription.dto";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { dynamicRbacMiddleware } from "@/middlewares/rbac.middleware";

const router = Router();

router.get("/subscriptions", subscriptionController.getSubscriptions);

router.get(
  "/subscriptions/:id",
  authMiddleware,
  dynamicRbacMiddleware,
  subscriptionController.getSubscription
);

router.patch(
  "/subscriptions/:id",
  authMiddleware,
  dynamicRbacMiddleware,
  subscriptionController.updateSubscription
);

router.post(
  "/subscriptions",
  authMiddleware,
  dynamicRbacMiddleware,
  ValidationPipe(CreateSubscriptionDto),
  subscriptionController.createSubscription
);

router.delete(
  "/subscriptions/:id",
  authMiddleware,
  dynamicRbacMiddleware,
  subscriptionController.deleteSubscription
);

export const subscriptionRoute = router;
