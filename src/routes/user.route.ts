import { Router } from "express";
import { userController } from "@/controllers/user.controller";
import { ValidationPipe } from "@/pipes/validation.pipe";
import { CreateUserDto } from "@/dtos/create-user.dto";

const router = Router();

router.get("/", userController.getUser);
router.post("/", ValidationPipe(CreateUserDto), userController.createUser);

export const userRoute = router;
