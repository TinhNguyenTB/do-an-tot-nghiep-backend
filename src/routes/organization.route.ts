import { Router } from "express";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { rbacMiddleware } from "@/middlewares/rbac.middleware";
import { organizationController } from "@/controllers/organization.controller";

const router = Router();

router.get(
  "/",
  authMiddleware,
  rbacMiddleware.isValidPermission(["manage_all_organizations"]),
  organizationController.getOrganizations
);

// router.get(
//   "/:id",
//   authMiddleware,
//   rbacMiddleware.isValidPermission(["manage_system_roles"]),
//   roleController.getSubscription
// );

// router.patch(
//   "/:id",
//   authMiddleware,
//   rbacMiddleware.isValidPermission(["manage_system_roles"]),
//   roleController.updateSubscription
// );

// router.post(
//   "/",
//   authMiddleware,
//   rbacMiddleware.isValidPermission(["manage_system_roles"]),
//   ValidationPipe(CreateSubscriptionDto),
//   roleController.createSubscription
// );

// router.delete(
//   "/:id",
//   authMiddleware,
//   rbacMiddleware.isValidPermission(["manage_system_roles"]),
//   roleController.deleteSubscription
// );

export const organizationRoute = router;
