import { Router } from "express";
import { userRoute } from "@/routes/user.route";
import { subscriptionRoute } from "@/routes/subscription.route";
import { authRoute } from "@/routes/auth.route";
import { roleRoute } from "@/routes/role.route";
import { organizationRoute } from "@/routes/organization.route";
import { endpointPermissionRoute } from "@/routes/endpoint-permission.route";
import { permissionRoute } from "@/routes/permission.route";

const router = Router();

router.use(
  "/",
  authRoute,
  userRoute,
  subscriptionRoute,
  roleRoute,
  organizationRoute,
  endpointPermissionRoute,
  permissionRoute
);

export default router;
