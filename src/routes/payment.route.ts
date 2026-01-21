import { Router } from "express";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { paymentController } from "@/controllers/payment.controller";

const router = Router();

router.get("/payments/history", authMiddleware, paymentController.getOrgPaymentHistory);

router.get("/payments/transaction", authMiddleware, paymentController.getTransactionHistory);

export const paymentRoute = router;
