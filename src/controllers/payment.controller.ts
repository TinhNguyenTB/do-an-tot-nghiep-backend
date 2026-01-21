import { Request, Response } from "express";
import { logger } from "@/utils/logger";
import { wrapAsync } from "@/utils/wrapAsync";
import { StatusCodes } from "http-status-codes";
import * as paymentService from "@/services/payment.service";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware";

const getOrgPaymentHistory = wrapAsync(async (req: AuthenticatedRequest, res: Response) => {
  logger.info("Fetching all org payment history...");

  const queryParams = req.query;
  const organizationId = req.user?.organizationId!;
  const result = await paymentService.getOrganizationPaymentHistory(organizationId, queryParams);

  res.locals.message = "Lấy danh sách thanh toán của tổ chức thành công.";
  res.status(StatusCodes.OK).json(result);
});

const getTransactionHistory = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Fetching all transaction history...");

  const queryParams = req.query;
  const result = await paymentService.getAllTransactionHistory(queryParams);

  res.locals.message = "Lấy danh sách thanh toán thành công.";
  res.status(StatusCodes.OK).json(result);
});

export const paymentController = {
  getOrgPaymentHistory,
  getTransactionHistory,
};
