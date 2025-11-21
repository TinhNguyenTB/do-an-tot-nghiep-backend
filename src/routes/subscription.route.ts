import { Router } from "express";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { subscriptionController } from "@/controllers/subscription.controller";
import { CreateSubscriptionDto } from "@/dtos/subscription.dto";

const router = Router();

router.get("/", subscriptionController.getSubscriptions);
router.get("/:id", subscriptionController.getSubscription);
router.patch("/:id", subscriptionController.updateSubscription);
router.post("/", ValidationPipe(CreateSubscriptionDto), subscriptionController.createSubscription);
router.delete("/:id", subscriptionController.deleteSubscription);

export const subscriptionRoute = router;
