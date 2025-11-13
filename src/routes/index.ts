import { Router } from "express";
import { userRoute } from "@/routes/user.route";

const router = Router();

// User APIs
router.use("/users", userRoute);

export default router;
