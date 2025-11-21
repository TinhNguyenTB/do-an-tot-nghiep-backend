import { Request, Response } from "express";
import { logger } from "@/utils/logger";
import { wrapAsync } from "@/utils/wrapAsync";
import * as subService from "@/services/subscription.service";
import { CreateSubscriptionDto } from "@/dtos/subscription.dto";
import { StatusCodes } from "http-status-codes";

// --- CREATE ---
const createSubscription = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Creating new subscription...");
  const dto = req.body as CreateSubscriptionDto;

  const newSub = await subService.createSubscription(dto);
  res.locals.message = "Đã tạo gói dịch vụ mới.";
  res.status(StatusCodes.CREATED).json(newSub);
});

// --- READ ALL ---
const getSubscriptions = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Fetching all subscriptions...");
  const subs = await subService.getAllSubscriptions();
  res.locals.message = "Lấy danh sách gói dịch vụ thành công.";
  res.status(StatusCodes.OK).json(subs);
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

export const subscriptionController = {
  createSubscription,
  getSubscriptions,
  getSubscription,
  updateSubscription,
  deleteSubscription,
};
