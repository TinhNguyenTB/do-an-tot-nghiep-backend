import { Request, Response } from "express";
import { logger } from "@/utils/logger";
import { wrapAsync } from "@/utils/wrapAsync";
import * as userService from "@/services/user.service";
import { CreateUserDto, RegisterUserDto, UpdateUserDto } from "@/dtos/user.dto";
import { StatusCodes } from "http-status-codes";
import { LoginDto } from "@/dtos/login.dto";
import ms from "ms";
import { RePaymentDto } from "@/dtos/re-payment.dto";
import { generateToken, verifyToken } from "@/utils/jwtProvider";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware";
import { ChangePasswordDto } from "@/dtos/auth.dto";

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

const login = wrapAsync(async (req: Request, res: Response) => {
  logger.info("User login...");
  const dto = req.body as LoginDto;
  const result = await userService.handleLogin(dto);

  res.cookie("accessToken", result.accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: ms("14 days"),
  });

  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: ms("14 days"),
  });

  res.locals.message = "Đăng nhập thành công";
  res.status(StatusCodes.OK).json(result);
});

const logout = wrapAsync(async (req: Request, res: Response) => {
  logger.info("User logout...");

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  res.locals.message = "Đăng xuất thành công.";
  res.status(StatusCodes.OK).json();
});

const rePayment = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Starting user rePayment)...");
  const dto = req.body as RePaymentDto;
  const result = await userService.recreatePaymentSession(dto);

  // 3. Phản hồi thành công (202 Accepted vì cần chờ thanh toán)
  res.locals.message = "Chuyển hướng thanh toán để kích hoạt.";
  res.status(StatusCodes.ACCEPTED).json(result);
});

const refreshToken = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Refresh token...");
  const refreshToken = req.cookies.refreshToken;
  const decoded = verifyToken(refreshToken, process.env.REFRESH_TOKEN_SECRET!);

  const userInfo = {
    id: decoded.id,
    email: decoded.email,
    name: decoded.name,
    roles: decoded.roles,
    permissions: decoded.permissions,
    organizationId: decoded.organizationId,
  };

  const accessToken = generateToken(userInfo, process.env.JWT_SECRET!, "1d");
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: ms("14 days"),
  });

  res.locals.message = "Refresh token thành công";
  res.status(StatusCodes.OK).json({ accessToken });
});

const getUserDetails = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Fetching user details...");
  const id = Number(req.params.id);
  const result = await userService.getUserById(id);

  res.locals.message = "Lấy chi tiết người dùng thành công.";
  res.status(StatusCodes.OK).json(result);
});

const updateUser = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Fetching user details...");
  const id = Number(req.params.id);
  const body = req.body as UpdateUserDto;
  const result = await userService.updateUser(id, body);

  res.locals.message = "Cập nhật người dùng thành công.";
  res.status(StatusCodes.OK).json(result);
});

const createUser = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Creating user...");
  const body = req.body as CreateUserDto;
  const defaultPassword = "password";

  const result = await userService.createUser(body, defaultPassword);

  res.locals.message = `Thêm người dùng thành công. Mật khẩu mặc định: ${defaultPassword}`;
  res.status(StatusCodes.OK).json(result);
});

const changePassword = wrapAsync(async (req: AuthenticatedRequest, res: Response) => {
  logger.info("User change password...");
  const body = req.body as ChangePasswordDto;
  const userId = req.user?.id!;
  const result = await userService.handleChangePassword(userId, body);

  res.locals.message = "Đổi mật khẩu thành công";
  res.status(StatusCodes.OK).json(result);
});

export const uploadAvatar = wrapAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req?.user?.id;

  const result = await userService.uploadUserAvatar(userId!, req.file!);

  res.locals.message = "Upload avatar thành công";
  res.status(StatusCodes.OK).json(result);
});

const getProfile = wrapAsync(async (req: AuthenticatedRequest, res: Response) => {
  logger.info("Fetching user profile...");

  const userId = req?.user?.id; // từ auth middleware
  const profile = await userService.getUserProfile(userId!);

  res.locals.message = "Lấy thông tin profile thành công.";
  res.status(StatusCodes.OK).json(profile);
});

export const userController = {
  registerUser,
  getUsers,
  login,
  logout,
  rePayment,
  refreshToken,
  getUserDetails,
  updateUser,
  createUser,
  changePassword,
  uploadAvatar,
  getProfile,
};
