import { CreateRoleDto, UpdateRoleDto } from "@/dtos/role.dto";
import { HttpException } from "@/exceptions/http-exception";
import prisma from "@/prismaClient";
import { Permission, Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

// --- READ ALL ---
export async function getAllRoles(
  queryParams: { [key: string]: any },
  organizationId: number | null
) {
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

  where.organizationId = organizationId;

  const [data, totalCount] = await prisma.$transaction([
    prisma.role.findMany({
      skip,
      take: size,
      orderBy: { createdAt: "desc" },
      where,
      select: {
        id: true,
        name: true,
        description: true,

        // Role này kế thừa từ role nào?
        inheritsFrom: {
          select: {
            parent: true,
          },
        },

        // Những role nào kế thừa role này?
        inheritedBy: {
          select: {
            child: true,
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
    inheritsFrom: role.inheritsFrom.map((i) => ({
      id: i.parent.id,
      name: i.parent.name,
    })),
    inheritedBy: role.inheritedBy.map((i) => ({
      id: i.child.id,
      name: i.child.name,
    })),
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

export const getRoleDetail = async (roleId: number) => {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      name: true,
      description: true,
      organizationId: true,

      // Lấy các vai trò cha (Parent Roles)
      inheritsFrom: {
        select: {
          parent: {
            select: { id: true, name: true }, // Lấy ID và Tên của vai trò cha
          },
        },
      },
      // Lấy các vai trò con (Child Roles)
      inheritedBy: {
        select: {
          child: {
            select: { id: true, name: true }, // Lấy ID và Tên của vai trò con
          },
        },
      },
    },
  });

  if (!role) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Role không tồn tại");
  }

  // 2. (Tùy chọn) Lấy toàn bộ permission name (kể cả kế thừa)
  // Nếu bạn muốn hiển thị TẤT CẢ quyền hiệu quả (bao gồm kế thừa), hãy sử dụng hàm đã sửa:
  const effectivePermissions = await getAllPermissionsOfRole(roleId);

  // 3. Chuẩn hóa dữ liệu trả về

  // Lấy danh sách Role cha/con
  const inheritsFrom = role.inheritsFrom.map((i) => i.parent.id);
  const inheritedBy = role.inheritedBy.map((i) => i.child.id);

  return {
    id: role.id,
    name: role.name,
    description: role.description,
    organizationId: role.organizationId,
    inheritsFrom: inheritsFrom, // Mảng { id, name }
    inheritedBy: inheritedBy, // Mảng { id, name }
    permissions: Array.from(effectivePermissions),
  };
};

/**
 * Kiểm tra xem việc gán parentId làm cha của childId có tạo ra vòng lặp kế thừa (cyclic inheritance) hay không.
 * @param prismaClient Client giao dịch Prisma (sử dụng tx).
 * @param potentialParentId ID của vai trò cha tiềm năng (vai trò đang được gán).
 * @param currentChildId ID của vai trò con hiện tại trong quá trình đệ quy.
 * @param visited Set các Role ID đã ghé thăm để ngăn chặn vòng lặp vô hạn.
 * @returns true nếu phát hiện vòng lặp, ngược lại false.
 */
async function hasCircularInheritance(
  prismaClient: Prisma.TransactionClient,
  potentialParentId: number,
  currentChildId: number,
  visited = new Set<number>()
): Promise<boolean> {
  // 1. Điều kiện dừng: Nếu vai trò cha tiềm năng chính là vai trò con hiện tại, đó là vòng lặp trực tiếp
  if (potentialParentId === currentChildId) return true;

  // 2. Điều kiện dừng: Nếu đã ghé thăm vai trò con này, không cần kiểm tra lại
  if (visited.has(currentChildId)) return false;
  visited.add(currentChildId);

  // 3. Tìm tất cả các vai trò cha trực tiếp của currentChildId
  const parents = await prismaClient.roleInheritance.findMany({
    where: { childId: currentChildId }, // SỬ DỤNG ID
    select: { parentId: true }, // Lấy ID của vai trò cha
  });

  // 4. Đệ quy kiểm tra vòng lặp
  for (const { parentId } of parents) {
    // Nếu ParentId của vai trò con hiện tại chính là vai trò cha tiềm năng (vòng lặp gián tiếp)
    if (parentId === potentialParentId) return true;

    // Kiểm tra đệ quy: Kiểm tra xem vai trò cha tiềm năng có nằm trong cây kế thừa của parentId không
    // Lưu ý: Đệ quy ở đây là kiểm tra ngược lên cây kế thừa (từ con lên cha)
    const hasCycle = await hasCircularInheritance(
      prismaClient,
      potentialParentId,
      parentId, // Truyền Parent ID làm Child ID tiếp theo
      visited
    );

    if (hasCycle) return true;
  }

  return false;
}

export const handleCreateRole = async (payload: CreateRoleDto) => {
  const { name, description, inheritsFrom, permissions, organizationId } = payload;
  const orgId = organizationId || null;

  // 1. Kiểm tra Role tồn tại (theo cặp [organizationId, name])
  const existedRole = await prisma.role.findFirst({
    where: {
      name,
      organizationId: orgId,
    },
  });
  if (existedRole) {
    throw new HttpException(
      StatusCodes.CONFLICT,
      `Vai trò '${name}' đã tồn tại trong phạm vi tổ chức này.`
    );
  }

  // Khai báo ngoài transaction để sử dụng sau
  let parentRoleRecords: Prisma.RoleGetPayload<{
    select: { id: true; name: true; organizationId: true };
  }>[] = [];
  let permissionRecords: Prisma.PermissionGetPayload<{ select: { id: true; name: true } }>[] = [];

  // =========================
  // 2. VALIDATE PARENTS (Sử dụng Role ID)
  // =========================
  if (inheritsFrom?.length) {
    parentRoleRecords = await prisma.role.findMany({
      where: { id: { in: inheritsFrom } }, // Tìm theo ID
      select: { id: true, name: true, organizationId: true },
    });

    // Kiểm tra tất cả ID có tồn tại
    if (parentRoleRecords.length !== inheritsFrom.length) {
      const existedIds = parentRoleRecords.map((r) => r.id);
      const notFoundIds = inheritsFrom.filter((id) => !existedIds.includes(id));

      throw new HttpException(
        StatusCodes.BAD_REQUEST,
        `Role cha không tồn tại: ID ${notFoundIds.join(", ")}`
      );
    }

    // Kiểm tra Role cha có thuộc Org khác không (Tùy chọn: Tăng cường bảo mật)
    const externalParent = parentRoleRecords.find(
      (p) => p.organizationId !== null && p.organizationId !== orgId
    );
    if (externalParent) {
      throw new HttpException(
        StatusCodes.BAD_REQUEST,
        `Không thể kế thừa vai trò '${externalParent.name}' thuộc tổ chức khác (ID: ${externalParent.organizationId}).`
      );
    }
  }

  // =========================
  // 3. VALIDATE PERMISSIONS (Sử dụng Permission ID)
  // =========================
  if (permissions?.length) {
    const permissionIds = permissions.map((p) => p.id);

    permissionRecords = await prisma.permission.findMany({
      where: {
        id: { in: permissionIds }, // Tìm theo ID
        // Tùy chọn: Đảm bảo Permission là Global HOẶC thuộc Org hiện tại
      },
      select: { id: true, name: true },
    });

    // Kiểm tra tất cả ID có tồn tại và hợp lệ
    if (permissionRecords.length !== permissionIds.length) {
      const existedIds = permissionRecords.map((p) => p.id);
      const notFoundIds = permissionIds.filter((id) => !existedIds.includes(id));

      throw new HttpException(
        StatusCodes.BAD_REQUEST,
        `Permission không tồn tại hoặc không hợp lệ: ID ${notFoundIds.join(", ")}`
      );
    }
  }

  // =========================
  // 4. TRANSACTION: CREATE ROLE, PERMISSIONS, INHERITANCE
  // =========================
  let newRole; // Khai báo biến để lưu Role mới tạo
  await prisma.$transaction(async (tx) => {
    // 4.1. TẠO ROLE
    newRole = await tx.role.create({
      data: {
        name,
        description,
        organizationId: orgId, // Gán Organization ID
      },
    });
    const newRoleId = newRole.id;

    // 4.2. KIỂM TRA VÒNG LẶP (sau khi có ID của Role mới)
    if (inheritsFrom?.length) {
      for (const parentId of inheritsFrom) {
        // Kiểm tra xem parentId có nằm trong cây kế thừa của newRole.id không
        const isCircular = await hasCircularInheritance(
          tx,
          newRoleId, // Vai trò cha tiềm năng (tên cũ của hàm đã gây nhầm lẫn)
          parentId // Bắt đầu kiểm tra từ cha mới (xem cha mới có phải là con của nó không)
        );

        // HÀM hasCircularInheritance PHẢI ĐƯỢC CHẠY NGƯỢC:
        // Kiểm tra xem BẤT KỲ cha nào (parentId) có kế thừa ngược lại newRoleId không.
        // Logic đúng: Kiểm tra newRoleId có nằm trong cây con của parentId không.

        // Ta cần kiểm tra ngược: newRoleId có kế thừa parentId, vậy parentId có đang kế thừa newRoleId không.
        // Hay: Liệu newRoleId có phải là ancestor (tổ tiên) của parentId không.
        const parentIsAncestor = await hasCircularInheritance(
          tx,
          newRoleId, // Start checking from the new role's ID
          parentId // Check if parentId is a descendant of newRoleId (THIS IS WRONG)
        );

        // Logic kiểm tra vòng lặp chuẩn:
        // Nếu A kế thừa B, thì B không được phép kế thừa A (trực tiếp hoặc gián tiếp).
        // Ta tạo A -> B. Cần kiểm tra B có thể dẫn đến A không.
        const B_leads_to_A = await hasCircularInheritance(
          tx,
          newRoleId, // Vai trò MỚI (child)
          parentId // Vai trò cha MỚI (start node)
        );

        if (B_leads_to_A) {
          throw new HttpException(
            StatusCodes.BAD_REQUEST,
            `Việc kế thừa từ Role ID ${parentId} sẽ tạo ra vòng lặp kế thừa (circular inheritance).`
          );
        }
      }
    }

    // 4.3. TẠO ROLE PERMISSIONS (Sử dụng ID)
    if (permissionRecords.length) {
      await tx.rolePermission.createMany({
        data: permissionRecords.map((p) => ({
          roleId: newRoleId,
          permissionId: p.id, // ✅ SỬ DỤNG ID
        })),
        skipDuplicates: true,
      });
    }

    // 4.4. TẠO ROLE INHERITANCE (Sử dụng ID)
    if (parentRoleRecords.length) {
      await tx.roleInheritance.createMany({
        data: parentRoleRecords.map((p) => ({
          parentId: p.id, // ✅ SỬ DỤNG ID
          childId: newRoleId, // ✅ SỬ DỤNG ID
        })),
        skipDuplicates: true,
      });
    }
  });

  // 5. Trả về chi tiết (Sử dụng ID của Role vừa tạo)
  // Giả định: getRoleDetail nhận ID
  return getRoleDetail(newRole!.id);
};

export async function getAllPermissionsOfRole(
  roleId: number,
  visitedRoleIds = new Set<number>()
): Promise<Set<Permission>> {
  // 1. Tránh vòng lặp
  if (visitedRoleIds.has(roleId)) return new Set();
  visitedRoleIds.add(roleId);

  const permissions = new Set<Permission>();

  // 2. Permission trực tiếp (Direct Permissions)
  // Phải JOIN qua RolePermission để lấy tên quyền từ bảng Permission
  const directPermissions = await prisma.rolePermission.findMany({
    where: { roleId: roleId },
    select: {
      permission: true,
    },
  });

  directPermissions.forEach((rp) => permissions.add(rp.permission));

  // 3. Role cha (Parent Roles)
  const parents = await prisma.roleInheritance.findMany({
    where: { childId: roleId },
    select: {
      parentId: true, // Lấy ID của vai trò cha
    },
  });

  // 4. Đệ quy lấy permission role cha
  for (const parent of parents) {
    const parentPermissions = await getAllPermissionsOfRole(
      parent.parentId, // Truyền Parent ID
      visitedRoleIds
    );

    parentPermissions.forEach((p) => permissions.add(p));
  }

  return permissions;
}

export const handleUpdateRole = async (roleId: number, payload: UpdateRoleDto) => {
  const { description, inheritsFrom, permissions, name } = payload;

  // 1. Kiểm tra Role tồn tại
  const role = await prisma.role.findUnique({
    where: { id: roleId }, // SỬ DỤNG ID
    select: { id: true, organizationId: true, name: true },
  });

  if (!role) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Role không tồn tại");
  }

  // Khai báo ngoài transaction
  let permissionIdsToAssign: number[] | undefined;

  // 2. VALIDATE PERMISSIONS (chỉ cần kiểm tra ID tồn tại)
  if (permissions) {
    const permissionIds = permissions.map((p) => p.id);

    const existedPermissions = await prisma.permission.findMany({
      where: {
        id: { in: permissionIds },
      },
      select: { id: true },
    });

    if (existedPermissions.length !== permissionIds.length) {
      // Chỉ kiểm tra số lượng ID hợp lệ
      throw new HttpException(
        StatusCodes.BAD_REQUEST,
        "Một hoặc nhiều Permission ID không tồn tại hoặc không hợp lệ cho Tổ chức này."
      );
    }
    permissionIdsToAssign = existedPermissions.map((p) => p.id);
  }

  // 3. TRANSACTION: Thực hiện cập nhật
  return prisma.$transaction(async (tx) => {
    // =========================
    // 1. UPDATE ROLE INFO
    // =========================
    const updatedRole = await tx.role.update({
      where: { id: roleId }, // SỬ DỤNG ID
      data: { description, name },
      select: { id: true }, // Chỉ cần ID để gọi getRoleDetail
    });

    // =========================
    // 2. UPDATE PERMISSIONS
    // =========================
    if (permissionIdsToAssign) {
      // Xoá quan hệ cũ
      await tx.rolePermission.deleteMany({
        where: { roleId }, // SỬ DỤNG ID
      });

      // Tạo lại quan hệ mới
      await tx.rolePermission.createMany({
        data: permissionIdsToAssign.map((permissionId) => ({
          roleId: roleId, // SỬ DỤNG ID
          permissionId: permissionId, // SỬ DỤNG ID
        })),
        skipDuplicates: true,
      });
    }

    // =========================
    // 3. UPDATE INHERITS
    // =========================
    if (inheritsFrom) {
      // 3a. Xoá quan hệ cũ TRƯỚC
      await tx.roleInheritance.deleteMany({
        where: { childId: roleId }, // SỬ DỤNG ID
      });

      // 3b. Validate circular trên trạng thái MỚI và tạo mới
      for (const parentId of inheritsFrom) {
        // Kiểm tra Role cha tồn tại (không cần thiết vì DTO nên xử lý, nhưng nên có)
        const parentRole = await tx.role.findUnique({ where: { id: parentId } });
        if (!parentRole) {
          throw new HttpException(
            StatusCodes.BAD_REQUEST,
            `Role cha ID ${parentId} không tồn tại.`
          );
        }

        // Ngăn Role kế thừa chính nó
        if (parentId === roleId) {
          throw new HttpException(StatusCodes.CONFLICT, "Role không thể kế thừa chính nó");
        }

        // Kiểm tra vòng lặp:
        // Nếu Role A (childId: roleId) kế thừa Role B (parentId: parentId),
        // ta cần kiểm tra xem B có dẫn đến A không (B có phải là con của A không).
        const isCircular = await hasCircularInheritance(tx, roleId, parentId);

        if (isCircular) {
          throw new HttpException(
            StatusCodes.CONFLICT,
            `Việc kế thừa từ Role ID ${parentId} sẽ tạo ra vòng lặp kế thừa (circular inheritance).`
          );
        }

        // Tạo quan hệ mới (sau khi pass check circular)
        await tx.roleInheritance.create({
          data: {
            parentId: parentId, // SỬ DỤNG ID
            childId: roleId, // SỬ DỤNG ID
          },
        });
      }

      // Không cần createMany nữa vì đã tạo từng cái sau khi check circular
    }

    // 4. Trả về chi tiết (Sử dụng ID)
    return getRoleDetail(updatedRole.id);
  });
};

export const handleDeleteRole = async (roleId: number) => {
  // 1. Kiểm tra role tồn tại
  const role = await prisma.role.findUnique({
    where: { id: roleId }, // SỬ DỤNG ID
    select: { id: true, name: true },
  });

  if (!role) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Role không tồn tại");
  }

  // 2. Check role đang được role khác kế thừa (Role đang là cha)
  const inheritedBy = await prisma.roleInheritance.findMany({
    where: { parentId: roleId }, // SỬ DỤNG ID
    select: {
      child: {
        // JOIN để lấy Tên Role con
        select: { id: true, name: true },
      },
    },
  });

  if (inheritedBy.length > 0) {
    const childRoles = inheritedBy.map((r) => r.child.name).join(", ");

    throw new HttpException(
      StatusCodes.CONFLICT,
      `Không thể xoá role "${role.name}" vì đang được các role sau kế thừa: ${childRoles}`
    );
  }

  // 3. Check role đang được gán cho user
  const usedByUser = await prisma.userRole.findFirst({
    where: { roleId: roleId }, // SỬ DỤNG ID
    select: { userId: true },
  });

  if (usedByUser) {
    throw new HttpException(
      StatusCodes.CONFLICT,
      `Không thể xoá role "${role.name}" vì đang được gán cho user (User ID: ${usedByUser.userId})`
    );
  }

  // 4. Transaction xoá
  await prisma.$transaction(async (tx) => {
    // 4.1 Xoá permissions của role (RolePermission)
    await tx.rolePermission.deleteMany({
      where: { roleId: roleId }, // SỬ DỤNG ID
    });

    // 4.2 Xoá inheritance (Role đang là con của các Role khác)
    await tx.roleInheritance.deleteMany({
      where: { childId: roleId }, // SỬ DỤNG ID
    });

    // 4.3 Xoá role
    await tx.role.delete({
      where: { id: roleId }, // SỬ DỤNG ID
    });
  });
};
