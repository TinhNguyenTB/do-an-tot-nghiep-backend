import { Router } from "express";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { rbacMiddleware } from "@/middlewares/rbac.middleware";
import { permissionController } from "@/controllers/permission.controller";

const router = Router();

router.get("/permissions", authMiddleware, rbacMiddleware, permissionController.getPermissions);

export const permissionRoute = router;
