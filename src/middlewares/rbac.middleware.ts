import { NextFunction, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware";
import prisma from "@/prismaClient";
import { logger } from "@/utils/logger";
import { ROLES } from "@/constants/role.constants";

/**
 * Middleware kiểm tra quyền truy cập động dựa trên Route Path và HTTP Method
 */
export const rbacMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // 1. Kiểm tra xác thực
  if (!req.user || !req.user.id) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Người dùng chưa được xác thực." });
  }

  // 2. Lấy Route Path: Đây là path trong file router (ví dụ: '/:id', '/')
  const routePath = req.route?.path;
  const httpMethod = req.method.toUpperCase();

  if (!routePath) {
    // Nếu không thể lấy routePath (thường không xảy ra), bỏ qua hoặc báo lỗi
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Không xác định được đường dẫn API." });
  }

  // Cho phép tiếp tục nếu là Super Admin
  if (req.user.roles.includes(ROLES.SUPER_ADMIN)) {
    return next();
  }

  // 3. Truy vấn DB để lấy Permission BẮT BUỘC cho endpoint này
  const endpointConfig = await prisma.endpointPermission.findUnique({
    where: {
      httpMethod_endpoint: {
        httpMethod: httpMethod,
        endpoint: routePath,
      },
    },
    include: {
      permission: {
        select: { name: true },
      },
    },
  });

  // 4. Nếu endpoint KHÔNG được cấu hình trong DB
  if (!endpointConfig) {
    logger.warn(`[RBAC] Truy cập trái phép: ${httpMethod} ${routePath} chưa được cấu hình.`);
    return res
      .status(StatusCodes.FORBIDDEN)
      .json({ message: "Chức năng này chưa được phân quyền." });
  }

  const requiredPermissionName = endpointConfig.permission.name;

  const hasPermission = req.user.permissions.includes(requiredPermissionName);

  if (!hasPermission) {
    return res.status(StatusCodes.FORBIDDEN).json({
      message: "Bạn không có quyền thực hiện hành động này.",
      required: requiredPermissionName,
    });
  }

  next();
};
