import { Request, Response } from "express";
import { logger } from "@/utils/logger";
import { wrapAsync } from "@/utils/wrapAsync";
import { StatusCodes } from "http-status-codes";
import * as organizationService from "@/services/organization.service";
import { UpdateOrgStatus } from "@/dtos/organization.dto";

const getOrganizations = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Fetching all organizations with query params...");

  const queryParams = req.query;
  const result = await organizationService.getAllOrganizations(queryParams);

  res.locals.message = "Lấy danh sách tổ chức thành công.";
  res.status(StatusCodes.OK).json(result);
});

const updateOrgStatus = wrapAsync(async (req: Request, res: Response) => {
  const { id, isActive } = req.body as UpdateOrgStatus;

  const result = await organizationService.updateOrgStatus(id, isActive);
  res.locals.message = `Cập nhật trạng thái tổ chức thành công.`;
  res.status(StatusCodes.OK).json(result);
});

// // --- READ ONE ---
// const getSubscription = wrapAsync(async (req: Request, res: Response) => {
//   const id = Number(req.params.id);
//   const sub = await subService.getSubscriptionById(id);
//   res.locals.message = `Lấy gói dịch vụ ID: ${id} thành công.`;
//   res.status(StatusCodes.OK).json(sub);
// });

// // --- UPDATE ---
// const updateSubscription = wrapAsync(async (req: Request, res: Response) => {
//   const id = Number(req.params.id);
//   const dto = req.body as Partial<CreateSubscriptionDto>;

//   const updatedSub = await subService.updateSubscription(id, dto);
//   res.locals.message = `Cập nhật gói dịch vụ ID: ${id} thành công.`;
//   res.status(StatusCodes.OK).json(updatedSub);
// });

// // --- DELETE ---
// const deleteSubscription = wrapAsync(async (req: Request, res: Response) => {
//   const id = Number(req.params.id);
//   await subService.deleteSubscription(id);
//   res.status(StatusCodes.NO_CONTENT).send(); // Phản hồi 204 No Content
// });

export const organizationController = {
  getOrganizations,
  updateOrgStatus,
};
