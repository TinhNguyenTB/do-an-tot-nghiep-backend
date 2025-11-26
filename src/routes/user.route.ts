import { Router } from "express";
import { userController } from "@/controllers/user.controller";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { RePaymentDto } from "@/dtos/re-payment.dto";

const router = Router();

router.get("/", userController.getUsers);
router.post("/re-payment", ValidationPipe(RePaymentDto), userController.rePayment);

export const userRoute = router;
