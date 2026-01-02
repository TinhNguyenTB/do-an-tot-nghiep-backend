import prisma from "@/prismaClient";

/**
 * Lấy tất cả các quyền (permissions) mà một Role ID có, bao gồm quyền từ role cha (parent).
 * @param roleId ID của vai trò (Role ID).
 * @param checkedRoleIds Set các Role ID đã kiểm tra để ngăn chặn vòng lặp vô hạn.
 * @returns Mảng các chuỗi tên quyền.
 */
async function getEffectivePermissionsForRole(
  roleId: number,
  checkedRoleIds: Set<number> = new Set()
): Promise<string[]> {
  if (checkedRoleIds.has(roleId)) {
    return []; // Ngăn chặn vòng lặp vô hạn
  }
  checkedRoleIds.add(roleId);

  // 1. Lấy quyền trực tiếp (Direct Permissions)
  // Phải JOIN qua RolePermission để lấy tên quyền từ bảng Permission
  const directPermissions = await prisma.rolePermission.findMany({
    where: { roleId: roleId },
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
    // Đệ quy để lấy quyền của role cha
    const parentPerms = await getEffectivePermissionsForRole(
      inheritedRole.parentId,
      checkedRoleIds
    );
    inheritedPerms = inheritedPerms.concat(parentPerms);
  }

  // 3. Kết hợp và loại bỏ trùng lặp
  const allPerms = [...directPerms, ...inheritedPerms];
  return Array.from(new Set(allPerms));
}

/**
 * Lấy tất cả quyền mà một người dùng có.
 * @param userId ID của người dùng.
 * @returns Mảng các chuỗi tên quyền hiệu quả của người dùng.
 */
export async function getUserPermissions(userId: number): Promise<string[]> {
  // 1. Lấy tất cả các Role ID của người dùng
  const userRoles = await prisma.userRole.findMany({
    where: { userId: userId },
    select: { roleId: true }, // Lấy roleId
  });

  let effectivePermissions: string[] = [];
  for (const userRole of userRoles) {
    // 2. Lấy quyền hiệu quả cho từng role (sử dụng roleId)
    const rolePerms = await getEffectivePermissionsForRole(userRole.roleId);
    effectivePermissions = effectivePermissions.concat(rolePerms);
  }

  // 3. Loại bỏ trùng lặp cuối cùng
  return Array.from(new Set(effectivePermissions));
}
