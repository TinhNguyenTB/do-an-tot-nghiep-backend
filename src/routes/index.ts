import { Router } from "express";
import { userRoute } from "@/routes/user.route";
import { subscriptionRoute } from "@/routes/subscription.route";
import { authRoute } from "@/routes/auth.route";

const router = Router();

// User APIs
router.use("/users", userRoute);
router.use("/subscriptions", subscriptionRoute);
router.use("/auth", authRoute);

export default router;
