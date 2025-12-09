import { Router } from "express";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { roleController } from "@/controllers/role.controller";
import { rbacMiddleware } from "@/middlewares/rbac.middleware";

const router = Router();

router.get("/roles", authMiddleware, rbacMiddleware, roleController.getRoles);

router.post("/send-welcome", async (req, res) => {
  try {
    const { to, name } = req.body;

    if (!to) {
      return res.status(400).json({ message: "Missing field: to" });
    }

    await roleController.sendWelcomeMail(to, { name });

    return res.json({ message: "Email sent successfully!" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to send email" });
  }
});

// router.get(
//   "/:id",
//   authMiddleware,
//   rbacMiddleware.isValidPermission(["manage_system_roles"]),
//   roleController.getSubscription
// );

// router.patch(
//   "/:id",
//   authMiddleware,
//   rbacMiddleware.isValidPermission(["manage_system_roles"]),
//   roleController.updateSubscription
// );

// router.post(
//   "/",
//   authMiddleware,
//   rbacMiddleware.isValidPermission(["manage_system_roles"]),
//   ValidationPipe(CreateSubscriptionDto),
//   roleController.createSubscription
// );

// router.delete(
//   "/:id",
//   authMiddleware,
//   rbacMiddleware.isValidPermission(["manage_system_roles"]),
//   roleController.deleteSubscription
// );

export const roleRoute = router;
