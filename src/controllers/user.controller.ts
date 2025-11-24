import { Request, Response } from "express";
import { logger } from "@/utils/logger";
import { wrapAsync } from "@/utils/wrapAsync";
import * as userService from "@/services/user.service";
import { RegisterUserDto } from "@/dtos/user.dto";
import { StatusCodes } from "http-status-codes";

const registerUser = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Starting user registration (PENDING payment)...");
  const dto = req.body as RegisterUserDto;
  const result = await userService.register(dto);

  // 3. Phản hồi thành công (202 Accepted vì cần chờ thanh toán)
  res.locals.message = "Tài khoản đã được tạo. Chuyển hướng thanh toán để kích hoạt.";
  res.status(StatusCodes.ACCEPTED).json(result);
});

const getUsers = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Fetching all users with query params...");

  const queryParams = req.query;

  const result = await userService.getAllUsers(queryParams);

  res.locals.message = "Lấy danh người dùng thành công.";
  res.status(StatusCodes.OK).json(result);
});

export const userController = {
  registerUser,
  getUsers,
};
