import { Router } from "express";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { rbacMiddleware } from "@/middlewares/rbac.middleware";
import { permissionController } from "@/controllers/permission.controller";
import { CreatePermissionDto, UpdatePermissionDto } from "@/dtos/permission.dto";

const router = Router();

router.get("/permissions", authMiddleware, permissionController.getPermissions);

router.get("/permissions/:id", authMiddleware, permissionController.getPermissionById);

router.post(
  "/permissions",
  authMiddleware,
  //   rbacMiddleware,
  ValidationPipe(CreatePermissionDto),
  permissionController.createNewPermission
);

router.patch(
  "/permissions/:id",
  authMiddleware,
  ValidationPipe(UpdatePermissionDto),
  permissionController.updatePermission
);

router.delete("/permissions/:id", authMiddleware, permissionController.deletePermissionById);

export const permissionRoute = router;
