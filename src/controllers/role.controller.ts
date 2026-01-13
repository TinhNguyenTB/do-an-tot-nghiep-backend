import { Request, Response } from "express";
import { logger } from "@/utils/logger";
import { wrapAsync } from "@/utils/wrapAsync";
import { StatusCodes } from "http-status-codes";
import * as roleService from "@/services/role.service";
import { CreateRoleDto, UpdateRoleDto } from "@/dtos/role.dto";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware";

// // --- CREATE ---
const createRole = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Creating new role...");
  const dto = req.body as CreateRoleDto;

  const result = await roleService.handleCreateRole(dto);
  res.locals.message = "Đã tạo vai trò mới.";
  res.status(StatusCodes.CREATED).json(result);
});

// --- READ ALL (Có Pagination, Sort và Filters) ---
const getRoles = wrapAsync(async (req: AuthenticatedRequest, res: Response) => {
  logger.info("Fetching all roles with query params...");

  const queryParams = req.query;
  const organizationId = req.user?.organizationId!;
  const result = await roleService.getAllRoles(queryParams, organizationId);

  res.locals.message = "Lấy danh sách vai trò thành công.";
  res.status(StatusCodes.OK).json(result);
});

// // --- READ ONE ---
const getRoleById = wrapAsync(async (req: Request, res: Response) => {
  const id = req.params.id;
  logger.info(`Fetching role ${id}...`);

  const role = await roleService.getRoleDetail(+id);

  res.locals.message = `Lấy role ${id} thành công.`;
  res.status(StatusCodes.OK).json(role);
});

// // --- UPDATE ---
const updateRole = wrapAsync(async (req: Request, res: Response) => {
  const id = req.params.id;
  logger.info(`Updating role ${id}...`);

  const dto = req.body as UpdateRoleDto;

  const updatedRole = await roleService.handleUpdateRole(+id, dto);
  res.locals.message = `Cập nhật role: ${id} thành công.`;
  res.status(StatusCodes.OK).json(updatedRole);
});

// // --- DELETE ---
const deleteRole = wrapAsync(async (req: Request, res: Response) => {
  const id = req.params.id;
  logger.info(`Deleting role ${id}...`);

  await roleService.handleDeleteRole(+id);
  res.status(StatusCodes.NO_CONTENT).send(); // Phản hồi 204 No Content
});

export const roleController = {
  getRoles,
  createRole,
  getRoleById,
  updateRole,
  deleteRole,
};
