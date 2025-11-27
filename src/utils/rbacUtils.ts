import prisma from "@/prismaClient";

/**
 * Lấy tất cả permissions của một role, bao gồm cả quyền được kế thừa (Sử dụng đệ quy).
 *
 * @param roleName Tên của role cần kiểm tra.
 * @param processedRoles Set các role đã xử lý để tránh đệ quy vô hạn (Vòng lặp thừa kế).
 * @returns Mảng các permission.
 */
export async function getPermissionsFromRole(
  roleName: string,
  processedRoles: Set<string> = new Set()
): Promise<string[]> {
  // Tránh vòng lặp thừa kế
  if (processedRoles.has(roleName)) {
    return [];
  }
  processedRoles.add(roleName);

  // 1. Lấy Role, Permissions trực tiếp và Role Cha (Parent) được kế thừa
  const role = await prisma.role.findUnique({
    where: { name: roleName },
    include: {
      permissions: {
        select: { permission: { select: { name: true } } },
      },
      // Quan hệ: inheritedBy (role con) -> inheritsFrom (role cha)
      // Tìm các Role mà Role hiện tại (childId) kế thừa từ (parentId)
      inheritsFrom: {
        select: { parentId: true },
      },
    },
  });

  if (!role) {
    return [];
  }

  let permissions = new Set<string>();

  // 2. Thêm Permissions trực tiếp
  role.permissions.forEach((rp) => permissions.add(rp.permission.name));

  // 3. Xử lý quyền kế thừa (Đệ quy)
  const inheritedRoles = role.inheritsFrom.map((inheritance) => inheritance.parentId);

  for (const inheritedRoleName of inheritedRoles) {
    // Đệ quy để lấy tất cả quyền từ role cha
    const inheritedPermissions = await getPermissionsFromRole(inheritedRoleName, processedRoles);
    inheritedPermissions.forEach((p) => permissions.add(p));
  }

  return Array.from(permissions);
}
