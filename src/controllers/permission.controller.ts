import { Request, Response } from "express";
import { logger } from "@/utils/logger";
import { wrapAsync } from "@/utils/wrapAsync";
import { StatusCodes } from "http-status-codes";
import * as permissionService from "@/services/permission.service";
import { CreatePermissionDto, UpdatePermissionDto } from "@/dtos/permission.dto";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware";

const getPermissions = wrapAsync(async (req: AuthenticatedRequest, res: Response) => {
  logger.info("Fetching all permissions with query params...");

  const queryParams = req.query;
  const organizationId = req.user?.organizationId!;
  const result = await permissionService.getAllPermissions(queryParams, +organizationId);

  res.locals.message = "Lấy danh sách quyền thành công.";
  res.status(StatusCodes.OK).json(result);
});

const createNewPermission = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Creating new permission...");

  const dto = req.body as CreatePermissionDto;
  const result = await permissionService.createPermission(dto);

  res.locals.message = "Thêm quyền thành công.";
  res.status(StatusCodes.OK).json(result);
});

const getPermissionById = wrapAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const sub = await permissionService.getPermissionDetail(id);
  res.locals.message = `Lấy gói quyền ID: ${id} thành công.`;
  res.status(StatusCodes.OK).json(sub);
});

const updatePermission = wrapAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const dto = req.body as UpdatePermissionDto;

  const updatedSub = await permissionService.handleUpdatePermission(id, dto);
  res.locals.message = `Cập nhật quyền ID: ${id} thành công.`;
  res.status(StatusCodes.OK).json(updatedSub);
});

const deletePermissionById = wrapAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await permissionService.deletePermission(id);
  res.status(StatusCodes.NO_CONTENT).send(); // Phản hồi 204 No Content
});

export const permissionController = {
  getPermissions,
  createNewPermission,
  updatePermission,
  getPermissionById,
  deletePermissionById,
};
