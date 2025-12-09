import { Router } from "express";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { dynamicRbacMiddleware } from "@/middlewares/rbac.middleware";
import { endpointPermissionController } from "@/controllers/endpoint-permission.controller";

const router = Router();

router.get(
  "/endpoint-permissions",
  authMiddleware,
  dynamicRbacMiddleware,
  endpointPermissionController.getEndpointPermissions
);

export const endpointPermissionRoute = router;
