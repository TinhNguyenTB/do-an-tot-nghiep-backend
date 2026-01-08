import prisma from "@/prismaClient";
import { Prisma } from "@prisma/client"; // Import Prisma để sử dụng kiểu dữ liệu

/**
 * Lấy tất cả các quyền (permissions) mà một Role ID có, bao gồm quyền từ role cha (parent).
 * Chỉ lấy các Permission hợp lệ: Global (null) hoặc thuộc tổ chức đã cho.
 * @param roleId ID của vai trò (Role ID).
 * @param orgId ID của Tổ chức người dùng (có thể là null nếu không thuộc tổ chức nào).
 * @param checkedRoleIds Set các Role ID đã kiểm tra để ngăn chặn vòng lặp vô hạn.
 * @returns Mảng các chuỗi tên quyền.
 */
async function getEffectivePermissionsForRole(
  roleId: number,
  orgId: number | null,
  checkedRoleIds: Set<number> = new Set()
): Promise<string[]> {
  if (checkedRoleIds.has(roleId)) {
    return []; // Ngăn chặn vòng lặp vô hạn
  }
  checkedRoleIds.add(roleId);

  const finalPermissionWhereCondition: Prisma.PermissionWhereInput = {};

  if (orgId === null) {
    // Nếu người dùng KHÔNG thuộc tổ chức, chỉ cho phép Global Permission
    finalPermissionWhereCondition.organizationId = null;
  } else {
    // Nếu người dùng THUỘC tổ chức, cho phép Global HOẶC Permission của Org đó
    finalPermissionWhereCondition.organizationId = orgId;
  }

  const directPermissions = await prisma.rolePermission.findMany({
    where: {
      roleId: roleId,
      permission: finalPermissionWhereCondition,
    },
    include: {
      permission: {
        select: { name: true }, // Chỉ lấy tên quyền
      },
    },
  });
  const directPerms = directPermissions.map((rp) => rp.permission.name);

  // 2. Lấy role cha (Inherited Roles)
  const inheritedRoles = await prisma.roleInheritance.findMany({
    where: { childId: roleId },
    select: { parentId: true },
  });

  let inheritedPerms: string[] = [];
  for (const inheritedRole of inheritedRoles) {
    // 3. Đệ quy để lấy quyền của role cha, truyền orgId xuống
    const parentPerms = await getEffectivePermissionsForRole(
      inheritedRole.parentId,
      orgId, // TRUYỀN orgId XUỐNG
      checkedRoleIds
    );
    inheritedPerms = inheritedPerms.concat(parentPerms);
  }

  // 4. Kết hợp và loại bỏ trùng lặp
  const allPerms = [...directPerms, ...inheritedPerms];
  return Array.from(new Set(allPerms));
}

/**
 * Lấy tất cả quyền mà một người dùng có, lọc theo tổ chức (nếu có).
 * @param userId ID của người dùng.
 * @returns Mảng các chuỗi tên quyền hiệu quả của người dùng.
 */
export async function getUserPermissions(userId: number): Promise<string[]> {
  // 1. Lấy User và Organization ID
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, roles: { select: { roleId: true } } },
  });

  if (!user) {
    // Trường hợp này không nên xảy ra nếu đã đăng nhập, nhưng để an toàn.
    return [];
  }

  const orgId = user.organizationId ?? null; // ID Tổ chức (hoặc null)
  const userRoles = user.roles;

  let effectivePermissions: string[] = [];
  for (const userRole of userRoles) {
    // 2. Lấy quyền hiệu quả cho từng role (sử dụng roleId và orgId)
    const rolePerms = await getEffectivePermissionsForRole(
      userRole.roleId,
      orgId // TRUYỀN orgId VÀO HÀM ĐỆ QUY
    );
    effectivePermissions = effectivePermissions.concat(rolePerms);
  }

  // 3. Loại bỏ trùng lặp cuối cùng
  return Array.from(new Set(effectivePermissions));
}
