import prisma from "@/prismaClient";

/**
 * Lấy tất cả các quyền (permissions) mà một role có, bao gồm quyền từ role cha (parent).
 * @param roleName Tên vai trò (role name).
 * @returns Mảng các chuỗi tên quyền.
 */
async function getEffectivePermissionsForRole(
  roleName: string,
  checkedRoles: Set<string> = new Set()
): Promise<string[]> {
  if (checkedRoles.has(roleName)) {
    return []; // Ngăn chặn vòng lặp vô hạn
  }
  checkedRoles.add(roleName);

  // 1. Lấy quyền trực tiếp
  const directPermissions = await prisma.rolePermission.findMany({
    where: { roleName: roleName },
    select: { permissionName: true },
  });
  const directPerms = directPermissions.map((p) => p.permissionName);

  // 2. Lấy role cha (kế thừa)
  const inheritedRoles = await prisma.roleInheritance.findMany({
    where: { childId: roleName },
    select: { parentId: true },
  });

  let inheritedPerms: string[] = [];
  for (const inheritedRole of inheritedRoles) {
    // Đệ quy để lấy quyền của role cha
    const parentPerms = await getEffectivePermissionsForRole(inheritedRole.parentId, checkedRoles);
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
  // 1. Lấy tất cả các Role của người dùng
  const userRoles = await prisma.userRole.findMany({
    where: { userId: userId },
    select: { roleName: true },
  });

  let effectivePermissions: string[] = [];
  for (const userRole of userRoles) {
    // 2. Lấy quyền hiệu quả cho từng role
    const rolePerms = await getEffectivePermissionsForRole(userRole.roleName);
    effectivePermissions = effectivePermissions.concat(rolePerms);
  }

  // 3. Loại bỏ trùng lặp cuối cùng
  return Array.from(new Set(effectivePermissions));
}
