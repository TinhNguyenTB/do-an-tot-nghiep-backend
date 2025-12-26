import { Router } from "express";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { roleController } from "@/controllers/role.controller";
import { rbacMiddleware } from "@/middlewares/rbac.middleware";
import { CreateRoleDto } from "@/dtos/role.dto";

const router = Router();

router.get("/roles", authMiddleware, rbacMiddleware, roleController.getRoles);

router.get("/roles/:name", authMiddleware, rbacMiddleware, roleController.getRoleByName);

router.post(
  "/roles",
  authMiddleware,
  rbacMiddleware,
  ValidationPipe(CreateRoleDto),
  roleController.createRole
);

router.patch("/roles/:name", authMiddleware, rbacMiddleware, roleController.updateRole);

router.delete("/roles/:name", authMiddleware, rbacMiddleware, roleController.deleteRole);

export const roleRoute = router;
