import { Router } from "express";
import { userRoute } from "@/routes/user.route";
import { subscriptionRoute } from "@/routes/subscription.route";

const router = Router();

// User APIs
router.use("/users", userRoute);
router.use("/subscriptions", subscriptionRoute);

export default router;
