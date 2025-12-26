import { Request, Response } from "express";
import { logger } from "@/utils/logger";
import { wrapAsync } from "@/utils/wrapAsync";
import { StatusCodes } from "http-status-codes";
import * as analyticsService from "@/services/analytics.service";

// ✨ LƯU Ý: Bạn cần kiểm tra quyền (RBAC) ở đây.
// Chỉ Super Admin hoặc Org Admin có quyền xem thống kê.
// Ví dụ: rbacMiddleware cần kiểm tra quyền 'read_analytics'

const getMonthlyRevenue = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Fetching monthly revenue statistics...");

  // Lấy năm từ query, nếu không có thì mặc định là năm hiện tại
  const year = Number(req.query.year) || new Date().getFullYear();

  const result = await analyticsService.getMonthlyRevenueStatistics(year);

  res.locals.message = `Lấy thống kê doanh thu theo tháng cho năm ${year} thành công.`;
  res.status(StatusCodes.OK).json(result);
});

export const analyticsController = {
  getMonthlyRevenue,
};
