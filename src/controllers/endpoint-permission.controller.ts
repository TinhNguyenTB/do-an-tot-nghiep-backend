import { Request, Response } from "express";
import { logger } from "@/utils/logger";
import { wrapAsync } from "@/utils/wrapAsync";
import { StatusCodes } from "http-status-codes";
import * as endpointPermissionService from "@/services/endpoint-permission.service";

const getEndpointPermissions = wrapAsync(async (req: Request, res: Response) => {
  logger.info("Fetching all route-permissions with query params...");

  const queryParams = req.query;
  const result = await endpointPermissionService.getAllEndpointPermissions(queryParams);

  res.locals.message = "Lấy danh sách route-permissions thành công.";
  res.status(StatusCodes.OK).json(result);
});

export const endpointPermissionController = {
  getEndpointPermissions,
};
