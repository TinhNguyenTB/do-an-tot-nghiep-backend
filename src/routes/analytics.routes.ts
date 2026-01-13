import { Router } from "express";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { rbacMiddleware } from "@/middlewares/rbac.middleware";
import { analyticsController } from "@/controllers/analytics.controller";

const router = Router();

router.get("/analytics/revenue", authMiddleware, analyticsController.getMonthlyRevenue);

router.get("/analytics/counts", authMiddleware, analyticsController.getSystemCounts);

export const analyticsRoute = router;
