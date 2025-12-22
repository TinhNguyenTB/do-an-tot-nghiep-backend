import { Request, Response } from "express";
import { logger } from "@/utils/logger";
import { wrapAsync } from "@/utils/wrapAsync";
import { StatusCodes } from "http-status-codes";
import * as roleService from "@/services/role.service";
import { CreateRoleDto } from "@/dtos/role.dto";

// // --- CREATE ---
const createRole = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Creating new role...");
  const dto = req.body as CreateRoleDto;

  const result = await roleService.handleCreateRole(dto);
  res.locals.message = "Đã tạo vai trò mới.";
  res.status(StatusCodes.CREATED).json(result);
});

// --- READ ALL (Có Pagination, Sort và Filters) ---
const getRoles = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Fetching all roles with query params...");

  const queryParams = req.query;
  const result = await roleService.getAllRoles(queryParams);

  res.locals.message = "Lấy danh sách vai trò thành công.";
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

export const roleController = {
  getRoles,
  createRole,
};
