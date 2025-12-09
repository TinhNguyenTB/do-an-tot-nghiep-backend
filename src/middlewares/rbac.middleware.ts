import { NextFunction, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { getUserPermissions } from "@/utils/rbacUtils";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware";
import prisma from "@/prismaClient";
import { logger } from "@/utils/logger";

/**
 * Middleware kiểm tra quyền truy cập động dựa trên Route Path và HTTP Method
 */
export const dynamicRbacMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // 1. Kiểm tra xác thực
  if (!req.user || !req.user.id) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Người dùng chưa được xác thực." });
  }

  // 2. Lấy Route Path: Đây là path trong file router (ví dụ: '/:id', '/')
  // Cần đảm bảo rằng routePath này khớp với routePath trong DB (RoutePermission)
  const routePath = req.route?.path;
  const httpMethod = req.method;

  if (!routePath) {
    // Nếu không thể lấy routePath (thường không xảy ra), bỏ qua hoặc báo lỗi
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Không xác định được đường dẫn API." });
  }

  // 3. Truy vấn DB để lấy Permission BẮT BUỘC cho endpoint này
  const routePermission = await prisma.routePermission.findUnique({
    where: {
      httpMethod_routePath: {
        httpMethod: httpMethod,
        routePath: routePath,
      },
    },
    select: { permissionName: true },
  });

  // 4. Nếu endpoint KHÔNG được cấu hình trong DB
  if (!routePermission) {
    logger.warn(`[RBAC] Route ${httpMethod} ${routePath} không có cấu hình quyền`);
    return res.status(StatusCodes.FORBIDDEN).json({
      message: "Bạn không có quyền truy cập chức năng này.",
    });
  }

  const requiredPermission = routePermission.permissionName;

  // 5. Lấy tất cả quyền hiệu quả của người dùng
  const userPermissions = await getUserPermissions(req.user.id);

  // 6. Kiểm tra ủy quyền
  const hasRequiredPermission = userPermissions.includes(requiredPermission);

  if (hasRequiredPermission) {
    next(); // Cho phép tiếp tục
  } else {
    return res.status(StatusCodes.FORBIDDEN).json({
      message: "Bạn không có quyền truy cập chức năng này.",
      required: requiredPermission,
    });
  }
};
