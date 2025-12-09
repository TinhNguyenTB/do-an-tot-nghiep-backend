import { Router } from "express";
import { userController } from "@/controllers/user.controller";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { RegisterUserDto } from "@/dtos/user.dto";
import { LoginDto } from "@/dtos/login.dto";

const router = Router();

router.post("/auth/register", ValidationPipe(RegisterUserDto), userController.registerUser);
router.post("/auth/login", ValidationPipe(LoginDto), userController.login);
router.delete("/auth/logout", userController.logout);
router.put("/auth/refresh", userController.refreshToken);

export const authRoute = router;
