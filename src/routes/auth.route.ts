import { Router } from "express";
import { userController } from "@/controllers/user.controller";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { RegisterUserDto } from "@/dtos/user.dto";

const router = Router();

router.post("/register", ValidationPipe(RegisterUserDto), userController.registerUser);

export const authRoute = router;
