import { Request, Response } from "express";
import { logger } from "@/utils/logger";
import { wrapAsync } from "@/utils/wrapAsync";
import * as subService from "@/services/subscription.service";
import { CreateSubscriptionDto, RenewSubscriptionDto } from "@/dtos/subscription.dto";
import { StatusCodes } from "http-status-codes";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware";

// --- CREATE ---
const createSubscription = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Creating new subscription...");
  const dto = req.body as CreateSubscriptionDto;

  const newSub = await subService.createSubscription(dto);
  res.locals.message = "Đã tạo gói dịch vụ mới.";
  res.status(StatusCodes.CREATED).json(newSub);
});

// --- READ ALL (Có Pagination, Sort và Filters) ---
const getSubscriptions = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Fetching all subscriptions with query params...");

  const queryParams = req.query;

  const result = await subService.getAllSubscriptions(queryParams);

  res.locals.message = "Lấy danh sách gói dịch vụ thành công.";
  res.status(StatusCodes.OK).json(result);
});

// --- READ ONE ---
const getSubscription = wrapAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const sub = await subService.getSubscriptionById(id);
  res.locals.message = `Lấy gói dịch vụ ID: ${id} thành công.`;
  res.status(StatusCodes.OK).json(sub);
});

// --- UPDATE ---
const updateSubscription = wrapAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const dto = req.body as Partial<CreateSubscriptionDto>;

  const updatedSub = await subService.updateSubscription(id, dto);
  res.locals.message = `Cập nhật gói dịch vụ ID: ${id} thành công.`;
  res.status(StatusCodes.OK).json(updatedSub);
});

// --- DELETE ---
const deleteSubscription = wrapAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await subService.deleteSubscription(id);
  res.status(StatusCodes.NO_CONTENT).send(); // Phản hồi 204 No Content
});

const renewSubscription = wrapAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { subscriptionId } = req.body as RenewSubscriptionDto;

  const result = await subService.handleRenewSubscription(userId!, subscriptionId);
  res.locals.message = `Gia hạn gói dịch vụ ID: ${subscriptionId}`;
  res.status(StatusCodes.OK).json(result);
});

const getMySubscriptionHandler = wrapAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;

  const result = await subService.getMySubscription(userId!);
  res.locals.message = `Lấy gói dịch vụ hiện tại của user ID: ${userId}`;
  res.status(StatusCodes.OK).json(result);
});

export const subscriptionController = {
  createSubscription,
  getSubscriptions,
  getSubscription,
  updateSubscription,
  deleteSubscription,
  renewSubscription,
  getMySubscriptionHandler,
};
