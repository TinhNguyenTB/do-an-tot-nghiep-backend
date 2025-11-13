import { Request, Response } from "express";
import { logger } from "@/utils/logger";
import { CreateUserDto } from "@/dtos/create-user.dto";
import { wrapAsync } from "@/utils/wrapAsync";
import * as userService from "@/services/user.service";

const getUser = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Fetching user...");
  const user = userService.getUser();
  res.locals.message = "Get user";
  res.json(user);
});

const createUser = wrapAsync(async (req: Request, res: Response) => {
  const dto = req.body as CreateUserDto;
  const newUser = userService.createUser(dto);
  res.locals.message = "Create user";
  res.json(newUser);
});

export const userController = {
  getUser,
  createUser,
};
