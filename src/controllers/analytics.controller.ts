import { Request, Response } from "express";
import { logger } from "@/utils/logger";
import { wrapAsync } from "@/utils/wrapAsync";
import { StatusCodes } from "http-status-codes";
import * as analyticsService from "@/services/analytics.service";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware";

const getMonthlyRevenue = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Fetching monthly revenue statistics...");

  // Lấy năm từ query, nếu không có thì mặc định là năm hiện tại
  const year = Number(req.query.year) || new Date().getFullYear();

  const result = await analyticsService.getMonthlyRevenueStatistics(year);

  res.locals.message = `Lấy thống kê doanh thu theo tháng cho năm ${year} thành công.`;
  res.status(StatusCodes.OK).json(result);
});

const getSystemCounts = wrapAsync(async (req: AuthenticatedRequest, res: Response) => {
  logger.info("Fetching total system counts...");
  let result = null;
  if (req.user?.organizationId !== null) {
    result = await analyticsService.getOrganizationStatistics(req.user!.organizationId!);
  } else {
    result = await analyticsService.getSystemCounts();
  }

  res.locals.message = "Thành công.";
  res.status(StatusCodes.OK).json(result);
});

export const analyticsController = {
  getMonthlyRevenue,
  getSystemCounts,
};
