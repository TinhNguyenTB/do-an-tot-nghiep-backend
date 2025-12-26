import { Request, Response } from "express";
import { logger } from "@/utils/logger";
import { wrapAsync } from "@/utils/wrapAsync";
import { StatusCodes } from "http-status-codes";
import * as roleService from "@/services/role.service";
import { CreateRoleDto, UpdateRoleDto } from "@/dtos/role.dto";

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
const getRoleByName = wrapAsync(async (req: Request, res: Response) => {
  const name = req.params.name;
  logger.info(`Fetching role ${name}...`);

  const role = await roleService.getRoleDetail(name);

  res.locals.message = `Lấy role ${name} thành công.`;
  res.status(StatusCodes.OK).json(role);
});

// // --- UPDATE ---
const updateRole = wrapAsync(async (req: Request, res: Response) => {
  const name = req.params.name;
  logger.info(`Updating role ${name}...`);

  const dto = req.body as UpdateRoleDto;

  const updatedRole = await roleService.handleUpdateRole(name, dto);
  res.locals.message = `Cập nhật role: ${name} thành công.`;
  res.status(StatusCodes.OK).json(updatedRole);
});

// // --- DELETE ---
const deleteRole = wrapAsync(async (req: Request, res: Response) => {
  const name = req.params.name;
  logger.info(`Deleting role ${name}...`);

  await roleService.handleDeleteRole(name);
  res.status(StatusCodes.NO_CONTENT).send(); // Phản hồi 204 No Content
});

export const roleController = {
  getRoles,
  createRole,
  getRoleByName,
  updateRole,
  deleteRole,
};
