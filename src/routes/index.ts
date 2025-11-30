import { Router } from "express";
import { userRoute } from "@/routes/user.route";
import { subscriptionRoute } from "@/routes/subscription.route";
import { authRoute } from "@/routes/auth.route";
import { roleRoute } from "@/routes/role.route";

const router = Router();

router.use("/auth", authRoute);
router.use("/users", userRoute);
router.use("/subscriptions", subscriptionRoute);
router.use("/roles", roleRoute);

export default router;
