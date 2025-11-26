import { Router } from "express";
import { userController } from "@/controllers/user.controller";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { RegisterUserDto } from "@/dtos/user.dto";
import { LoginDto } from "@/dtos/login.dto";

const router = Router();

router.post("/register", ValidationPipe(RegisterUserDto), userController.registerUser);
router.post("/login", ValidationPipe(LoginDto), userController.login);
router.delete("/logout", userController.logout);

export const authRoute = router;
