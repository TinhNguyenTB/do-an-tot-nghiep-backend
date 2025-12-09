import { Router } from "express";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { organizationController } from "@/controllers/organization.controller";
import { rbacMiddleware } from "@/middlewares/rbac.middleware";

const router = Router();

router.get(
  "/organizations",
  authMiddleware,
  rbacMiddleware,
  organizationController.getOrganizations
);

// router.get(
//   "/:id",
//   authMiddleware,
//   roleController.getSubscription
// );

// router.patch(
//   "/:id",
//   authMiddleware,
//   roleController.updateSubscription
// );

// router.post(
//   "/",
//   authMiddleware,
//   ValidationPipe(CreateSubscriptionDto),
//   roleController.createSubscription
// );

// router.delete(
//   "/:id",
//   authMiddleware,
//   roleController.deleteSubscription
// );

export const organizationRoute = router;
