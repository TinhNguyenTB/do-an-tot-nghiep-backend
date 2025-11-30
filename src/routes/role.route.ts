import { Router } from "express";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { rbacMiddleware } from "@/middlewares/rbac.middleware";
import { roleController } from "@/controllers/role.controller";

const router = Router();

router.get(
  "/",
  authMiddleware,
  rbacMiddleware.isValidPermission(["manage_system_roles"]),
  roleController.getRoles
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

export const roleRoute = router;
