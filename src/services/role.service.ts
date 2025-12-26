import { CreateRoleDto, UpdateRoleDto } from "@/dtos/role.dto";
import { HttpException } from "@/exceptions/http-exception";
import prisma from "@/prismaClient";
import { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

// --- READ ALL ---
export async function getAllRoles(queryParams: { [key: string]: any }) {
  const page = Number(queryParams.page) || 1;
  const size = Number(queryParams.size) || 10;

  const skip = (page - 1) * size;

  const where: Prisma.RoleWhereInput = {};

  if (queryParams["name"]) {
    // Xử lý Lọc theo Tên (name)
    where.name = {
      contains: queryParams["name"],
    };
  }

  const [data, totalCount] = await prisma.$transaction([
    prisma.role.findMany({
      skip,
      take: size,
      orderBy: { createdAt: "desc" },
      where,
      select: {
        name: true,
        description: true,

        // Role này kế thừa từ role nào?
        inheritsFrom: {
          select: {
            parentId: true,
          },
        },

        // Những role nào kế thừa role này?
        inheritedBy: {
          select: {
            childId: true,
          },
        },
      },
    }),

    prisma.role.count({
      where: where,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / size);

  const roles = data.map((role) => ({
    ...role,
    inheritsFrom: role.inheritsFrom.map((i) => i.parentId),
    inheritedBy: role.inheritedBy.map((i) => i.childId),
  }));

  return {
    content: roles,
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

export const getRoleDetail = async (name: string) => {
  const role = await prisma.role.findUnique({
    where: { name },
    select: {
      name: true,
      description: true,
      inheritsFrom: {
        select: { parentId: true },
      },
      inheritedBy: {
        select: { childId: true },
      },
    },
  });

  if (!role) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Role không tồn tại");
  }

  // 1. Lấy toàn bộ permission name (kể cả kế thừa)
  const permissionSet = await getAllPermissionsOfRole(name);
  const permissionNames = Array.from(permissionSet);

  // 2. Query permission detail
  const permissions = permissionNames.length
    ? await prisma.permission.findMany({
        where: { name: { in: permissionNames } },
        select: {
          name: true,
          description: true,
        },
      })
    : [];

  return {
    name: role.name,
    description: role.description,
    inheritsFrom: role.inheritsFrom.map((i) => i.parentId),
    inheritedBy: role.inheritedBy.map((i) => i.childId),
    permissions,
  };
};

async function hasCircularInheritance(
  prismaClient: Prisma.TransactionClient,
  parentRole: string,
  childRole: string,
  visited = new Set<string>()
): Promise<boolean> {
  if (parentRole === childRole) return true;

  if (visited.has(childRole)) return false;
  visited.add(childRole);

  const parents = await prismaClient.roleInheritance.findMany({
    where: { childId: childRole },
    select: { parentId: true },
  });

  for (const { parentId } of parents) {
    if (parentId === parentRole) return true;

    const hasCycle = await hasCircularInheritance(prismaClient, parentRole, parentId, visited);

    if (hasCycle) return true;
  }

  return false;
}

export const handleCreateRole = async (payload: CreateRoleDto) => {
  const { name, description, inheritsFrom, permissions } = payload;

  // 1. Check role tồn tại
  const existedRole = await prisma.role.findUnique({ where: { name } });
  if (existedRole) {
    throw new HttpException(StatusCodes.CONFLICT, "Vai trò đã tồn tại");
  }

  // =========================
  // 2. VALIDATE PARENTS
  // =========================
  if (inheritsFrom?.length) {
    const parentNames = inheritsFrom.map((p) => p);

    const existedParents = await prisma.role.findMany({
      where: { name: { in: parentNames } },
      select: { name: true },
    });

    const existedParentNames = existedParents.map((r) => r.name);
    const notFoundParents = parentNames.filter((p) => !existedParentNames.includes(p));

    if (notFoundParents.length) {
      throw new HttpException(
        StatusCodes.BAD_REQUEST,
        `Role cha không tồn tại: ${notFoundParents.join(", ")}`
      );
    }
  }

  // =========================
  // 3. VALIDATE PERMISSIONS
  // =========================
  if (permissions?.length) {
    const permissionNames = permissions.map((p) => p.name);

    const existedPermissions = await prisma.permission.findMany({
      where: { name: { in: permissionNames } },
      select: { name: true },
    });

    const existedPermissionNames = existedPermissions.map((p) => p.name);
    const notFoundPermissions = permissionNames.filter((p) => !existedPermissionNames.includes(p));

    if (notFoundPermissions.length) {
      throw new HttpException(
        StatusCodes.BAD_REQUEST,
        `Permission không tồn tại: ${notFoundPermissions.join(", ")}`
      );
    }
  }

  // =========================
  // 4. TRANSACTION
  // =========================
  await prisma.$transaction(async (tx) => {
    await tx.role.create({
      data: { name, description },
    });

    if (permissions?.length) {
      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({
          roleName: name,
          permissionName: p.name, // ✅ chỉ dùng name
        })),
        skipDuplicates: true,
      });
    }

    if (inheritsFrom?.length) {
      await tx.roleInheritance.createMany({
        data: inheritsFrom.map((p) => ({
          parentId: p,
          childId: name,
        })),
        skipDuplicates: true,
      });
    }
  });

  return getRoleDetail(name);
};

export async function getAllPermissionsOfRole(
  roleName: string,
  visitedRoles = new Set<string>()
): Promise<Set<string>> {
  // tránh loop
  if (visitedRoles.has(roleName)) return new Set();
  visitedRoles.add(roleName);

  const permissions = new Set<string>();

  // 1. Permission trực tiếp
  const directPermissions = await prisma.rolePermission.findMany({
    where: { roleName },
    select: {
      permissionName: true,
    },
  });

  directPermissions.forEach((p) => permissions.add(p.permissionName));

  // 2. Role cha
  const parents = await prisma.roleInheritance.findMany({
    where: { childId: roleName },
    select: {
      parentId: true,
    },
  });

  // 3. Đệ quy lấy permission role cha
  for (const parent of parents) {
    const parentPermissions = await getAllPermissionsOfRole(parent.parentId, visitedRoles);

    parentPermissions.forEach((p) => permissions.add(p));
  }

  return permissions;
}

export const handleUpdateRole = async (roleName: string, payload: UpdateRoleDto) => {
  const { description, inheritsFrom, permissions } = payload;

  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Role không tồn tại");
  }

  return prisma.$transaction(async (tx) => {
    // =========================
    // 1. UPDATE ROLE INFO
    // =========================
    const updatedRole = await tx.role.update({
      where: { name: roleName },
      data: { description },
    });

    // =========================
    // 2. UPDATE PERMISSIONS
    // =========================
    if (permissions) {
      await tx.rolePermission.deleteMany({
        where: { roleName },
      });

      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({
          roleName,
          permissionName: p.name,
        })),
        skipDuplicates: true,
      });
    }

    // =========================
    // 3. UPDATE INHERITS (FIXED)
    // =========================
    if (inheritsFrom) {
      // ❌ Xoá quan hệ cũ TRƯỚC
      await tx.roleInheritance.deleteMany({
        where: { childId: roleName },
      });

      // ✅ Validate circular trên trạng thái MỚI
      for (const parent of inheritsFrom) {
        if (parent === roleName) {
          throw new HttpException(StatusCodes.CONFLICT, "Role không thể kế thừa chính nó");
        }

        const isCircular = await hasCircularInheritance(tx, parent, roleName);

        if (isCircular) {
          throw new HttpException(
            StatusCodes.CONFLICT,
            `Circular inheritance: "${parent}" → "${roleName}"`
          );
        }
      }

      // ✅ Tạo lại quan hệ mới
      await tx.roleInheritance.createMany({
        data: inheritsFrom.map((p) => ({
          parentId: p,
          childId: roleName,
        })),
      });
    }

    return getRoleDetail(updatedRole.name);
  });
};

export const handleDeleteRole = async (name: string) => {
  // 1. Check role tồn tại
  const role = await prisma.role.findUnique({
    where: { name },
  });

  if (!role) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Role không tồn tại");
  }

  // 2. Check role đang được role khác kế thừa
  const inheritedBy = await prisma.roleInheritance.findMany({
    where: { parentId: name },
    select: { childId: true },
  });

  if (inheritedBy.length > 0) {
    const childRoles = inheritedBy.map((r) => r.childId).join(", ");

    throw new HttpException(
      StatusCodes.CONFLICT,
      `Không thể xoá role "${role.name}" vì đang được các role sau kế thừa: ${childRoles}`
    );
  }

  // 3. Check role đang được gán cho user
  const usedByUser = await prisma.userRole.findFirst({
    where: { roleName: name },
    select: { userId: true },
  });

  if (usedByUser) {
    throw new HttpException(
      StatusCodes.CONFLICT,
      `Không thể xoá role "${name}" vì đang được gán cho user`
    );
  }

  // 4. Transaction xoá
  await prisma.$transaction(async (tx) => {
    // 4.1 Xoá permissions của role
    await tx.rolePermission.deleteMany({
      where: { roleName: name },
    });

    // 4.2 Xoá inheritance (role là con)
    await tx.roleInheritance.deleteMany({
      where: { childId: name },
    });

    // 4.3 Xoá role
    await tx.role.delete({
      where: { name },
    });
  });
};
