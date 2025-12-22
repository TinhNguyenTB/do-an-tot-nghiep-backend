import { CreateRoleDto } from "@/dtos/role.dto";
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
  const validFilterFields = ["name"];

  for (const key of validFilterFields) {
    if (queryParams[key]) {
      // Xử lý Lọc theo Tên (name)
      if (key === "name") {
        where.name = {
          contains: queryParams[key], // Tìm kiếm gần đúng
        };
      }
    }
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
            parent: {
              select: {
                name: true,
              },
            },
          },
        },

        // Những role nào kế thừa role này?
        inheritedBy: {
          select: {
            child: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),

    prisma.role.count({
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

async function hasCircularInheritance(
  parentRole: string,
  childRole: string,
  visited = new Set<string>()
): Promise<boolean> {
  if (parentRole === childRole) return true;

  if (visited.has(childRole)) return false;
  visited.add(childRole);

  // Lấy tất cả role cha của childRole
  const parents = await prisma.roleInheritance.findMany({
    where: { childId: childRole },
    select: { parentId: true },
  });

  for (const { parentId } of parents) {
    if (parentId === parentRole) return true;

    const hasCycle = await hasCircularInheritance(parentRole, parentId, visited);
    if (hasCycle) return true;
  }

  return false;
}

export const handleCreateRole = async (payload: CreateRoleDto) => {
  const { name, description, inheritsFrom, permissions } = payload;

  // 1. Check role tồn tại
  const existedRole = await prisma.role.findUnique({
    where: { name },
  });

  if (existedRole) {
    throw new HttpException(StatusCodes.CONFLICT, "Vai trò đã tồn tại");
  }

  // =========================
  // 2. VALIDATE PARENTS
  // =========================
  if (inheritsFrom?.length) {
    const parentNames = inheritsFrom.map((p) => p.name);

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

    // Check circular inheritance
    // for (const parent of parentNames) {
    //   const isCircular = await hasCircularInheritance(parent, name);
    //   if (isCircular) {
    //     throw new HttpException(
    //       StatusCodes.CONFLICT,
    //       `Role "${parent}" không thể kế thừa từ "${name}" (circular dependency)`
    //     );
    //   }
    // }
  }

  // =========================
  // 3. VALIDATE PERMISSIONS
  // =========================
  if (permissions?.length) {
    const existedPermissions = await prisma.permission.findMany({
      where: { name: { in: permissions } },
      select: { name: true },
    });

    const existedPermissionNames = existedPermissions.map((p) => p.name);

    const notFoundPermissions = permissions.filter((p) => !existedPermissionNames.includes(p));

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
  return prisma.$transaction(async (tx) => {
    // 4.1 Create role
    const role = await tx.role.create({
      data: {
        name,
        description,
      },
    });

    // 4.2 Assign permissions
    if (permissions?.length) {
      await tx.rolePermission.createMany({
        data: permissions.map((permissionName) => ({
          roleName: name,
          permissionName,
        })),
        skipDuplicates: true,
      });
    }

    // 4.3 Role inheritance
    if (inheritsFrom?.length) {
      await tx.roleInheritance.createMany({
        data: inheritsFrom.map((parent) => ({
          parentId: parent.name,
          childId: name,
        })),
        skipDuplicates: true,
      });
    }

    return role;
  });
};
