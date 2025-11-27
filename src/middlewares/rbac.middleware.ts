import { NextFunction, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { getPermissionsFromRole } from "@/utils/rbacUtils";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware";

const isValidPermission =
  (requiredPermissions: string[]) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Lấy role của user trong payload decoded của jwt
      const userRoles = req.user && req.user.roles;

      // Kiểm tra role, user bắt buộc phải có ít nhất 1 role
      if (!Array.isArray(userRoles) || userRoles.length === 0) {
        return res.status(StatusCodes.FORBIDDEN).json({
          message: "Forbidden: You're not allowed to access this API!",
        });
      }

      // 1. Thu thập tất cả Permissions từ tất cả các Role của User (bao gồm kế thừa)
      let userPermissions = new Set<string>();

      // Sử dụng Map để theo dõi các Role đã được xử lý trên toàn bộ session để tránh đệ quy lặp
      const globalProcessedRoles = new Set<string>();

      for (const roleName of userRoles) {
        // Truyền processedRoles để tránh lỗi đệ quy vô hạn trong getPermissionsFromRole
        const rolePermissions = await getPermissionsFromRole(roleName, globalProcessedRoles);
        rolePermissions.forEach((p) => userPermissions.add(p));
      }

      // console.log("userPermissions", userPermissions);

      // 2. Kiểm tra quyền yêu cầu (requiredPermissions)

      const hasPermission = requiredPermissions?.every((item) => userPermissions.has(item));

      if (!hasPermission) {
        res.locals.message = "You're not allowed to access this API!";
        return res.status(StatusCodes.FORBIDDEN).json();
      }

      // Nếu role và permissions hợp lệ thì cho phép đi tiếp sang controller
      next();
    } catch (error) {
      console.error("Error from rbac middleware:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: "Something went wrong",
      });
    }
  };

export const rbacMiddleware = {
  isValidPermission,
};
