import { CreatePermissionDto, UpdatePermissionDto } from "@/dtos/permission.dto";
import { HttpException } from "@/exceptions/http-exception";
import prisma from "@/prismaClient";
import { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

export async function getAllPermissions(
  queryParams: { [key: string]: any },
  organizationId: number | null
) {
  const page = Number(queryParams.page) || 1;
  const size = Number(queryParams.size) || 10;
  const search = queryParams.search?.trim();
  const skip = (page - 1) * size;

  const where: Prisma.PermissionWhereInput = {};

  if (queryParams["name"]) {
    where.name = {
      contains: queryParams["name"],
    };
  }
  where.organizationId = organizationId;

  console.log(organizationId);

  if (search) {
    where.OR = [
      {
        name: {
          contains: search,
        },
      },
      {
        description: {
          contains: search,
        },
      },
    ];
  }

  const [data, totalCount] = await prisma.$transaction([
    prisma.permission.findMany({
      skip,
      take: size,
      orderBy: { createdAt: "desc" },
      where,
      select: {
        id: true,
        name: true,
        description: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),

    prisma.permission.count({
      where: where,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / size);

  return {
    content: data,
    meta: {
      totalItems: totalCount,
      totalPages: totalPages,
      currentPage: page,
      itemsPerPage: size,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export async function createPermission(dto: CreatePermissionDto) {
  const { name, description, organizationId } = dto;
  const orgId = organizationId ?? null; // Chuẩn hóa undefined sang null cho Prisma

  // 1. Kiểm tra Permission tồn tại (theo cặp [organizationId, name])
  // Đây là bước quan trọng do bạn có @@unique([organizationId, name])
  const existingPermission = await prisma.permission.findFirst({
    where: {
      name: name,
      organizationId: orgId,
    },
  });

  if (existingPermission) {
    throw new HttpException(
      StatusCodes.CONFLICT,
      `Quyền '${name}' đã tồn tại trong phạm vi tổ chức này.`
    );
  }

  // 2. Nếu có organizationId, kiểm tra organization có tồn tại không
  if (orgId !== null) {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!organization) {
      throw new HttpException(StatusCodes.NOT_FOUND, `Tổ chức với ID ${orgId} không tìm thấy.`);
    }
  }

  // 3. Tạo Permission mới
  const newPermission = await prisma.permission.create({
    data: {
      name: name,
      description: description,
      organizationId: orgId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      organizationId: true,
    },
  });

  return newPermission;
}

export async function handleUpdatePermission(permissionId: number, dto: UpdatePermissionDto) {
  const { name, description } = dto;

  // 1. Kiểm tra Permission tồn tại
  const existingPermission = await prisma.permission.findUnique({
    where: { id: permissionId },
    select: { id: true, organizationId: true, name: true },
  });

  if (!existingPermission) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Permission không tìm thấy.");
  }

  // 2. Chuẩn bị dữ liệu cập nhật
  const updateData: Prisma.PermissionUpdateInput = {};

  if (name !== undefined) {
    updateData.name = name;
  }
  if (description !== undefined) {
    updateData.description = description;
  }

  // Nếu không có dữ liệu để cập nhật, dừng lại
  if (Object.keys(updateData).length === 0) {
    return existingPermission;
  }

  // 3. Kiểm tra trùng lặp Tên (nếu Tên bị thay đổi)
  // Phải đảm bảo tên mới không trùng với các Permission khác trong cùng organizationId
  if (name && name !== existingPermission.name) {
    const conflictPermission = await prisma.permission.findFirst({
      where: {
        name: name,
        organizationId: existingPermission.organizationId, // Kiểm tra trong cùng phạm vi (Global hoặc Org)
        NOT: { id: permissionId }, // Loại trừ chính bản thân Permission đang cập nhật
      },
    });

    if (conflictPermission) {
      throw new HttpException(
        StatusCodes.CONFLICT,
        `Tên quyền '${name}' đã tồn tại trong tổ chức này.`
      );
    }
  }

  // 4. Thực hiện cập nhật
  const updatedPermission = await prisma.permission.update({
    where: { id: permissionId },
    data: updateData,
    select: {
      id: true,
      name: true,
      description: true,
      organizationId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedPermission;
}

export async function getPermissionDetail(permissionId: number) {
  const permission = await prisma.permission.findUnique({
    where: { id: permissionId },
    select: {
      id: true,
      name: true,
      description: true,
      organizationId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!permission) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Permission không tồn tại.");
  }

  return permission;
}

export async function deletePermission(permissionId: number) {
  // 1. Kiểm tra Permission tồn tại
  const permission = await prisma.permission.findUnique({
    where: { id: permissionId },
    select: { id: true, name: true },
  });

  if (!permission) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Permission không tồn tại.");
  }

  // 2. Kiểm tra xem Permission có đang được gán cho bất kỳ Role nào không
  const assignedRoles = await prisma.rolePermission.findMany({
    where: { permissionId: permissionId }, // Sử dụng ID
    select: {
      role: {
        select: { id: true, name: true }, // Lấy ID và tên của Role
      },
    },
    take: 10, // Chỉ cần lấy một số lượng nhỏ để kiểm tra
  });

  if (assignedRoles.length > 0) {
    const roleNames = assignedRoles.map((rp) => rp.role.name).join(", ");

    throw new HttpException(
      StatusCodes.CONFLICT,
      `Không thể xoá Permission "${permission.name}" vì đang được các Role sau gán: ${roleNames} (và nhiều hơn nữa nếu có).`
    );
  }

  // 3. Thực hiện xóa Permission
  await prisma.permission.delete({
    where: { id: permissionId },
  });
}
