// prisma/seed.ts

// Thư viện hashing mật khẩu
import * as bcrypt from "bcrypt";

// Sử dụng instance Singleton
import prisma from "../src/prismaClient";

const MOCK_ROLES_LEVEL_3 = [
  {
    name: "client",
    permissions: ["create_support", "read_support", "update_support", "delete_support"],
    inherits: [],
  },
  {
    name: "moderator",
    permissions: ["create_messages", "read_messages", "update_messages", "delete_messages"],
    inherits: ["client"],
  },
  {
    name: "admin",
    permissions: [
      "create_admin_tools",
      "read_admin_tools",
      "update_admin_tools",
      "delete_admin_tools",
    ],
    inherits: ["client", "moderator"],
  },
];

async function main() {
  console.log(`Bắt đầu Seed...`);

  // --- 1. Lấy danh sách tất cả các Permissions DUY NHẤT ---
  const allPermissions = new Set<string>();
  MOCK_ROLES_LEVEL_3.forEach((role) => {
    role.permissions.forEach((perm) => allPermissions.add(perm));
  });

  const permissionData = Array.from(allPermissions).map((name) => ({
    name,
    description: `Quyền cho phép: ${name.replace(/_/g, " ")}`,
  }));

  // --- 2. Xóa dữ liệu cũ (Tùy chọn: cần thận trọng trong môi trường Production!) ---
  // Thứ tự xóa phải tuân theo quan hệ khóa ngoại ngược:
  await prisma.userSubscription.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.roleInheritance.deleteMany({});
  await prisma.rolePermission.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.permission.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.organization.deleteMany({});
  console.log("Đã xóa dữ liệu cũ.");

  // --- 3. Seed Permissions ---
  await prisma.permission.createMany({
    data: permissionData,
    skipDuplicates: true,
  });
  console.log(`Đã tạo ${permissionData.length} Permissions.`);

  // --- 4. Seed Roles ---
  const roleData = MOCK_ROLES_LEVEL_3.map((role) => ({
    name: role.name,
    description: `Vai trò ${role.name}`,
  }));
  await prisma.role.createMany({
    data: roleData,
    skipDuplicates: true,
  });
  console.log(`Đã tạo ${roleData.length} Roles.`);

  // --- 5. Seed RolePermissions (Gán quyền trực tiếp) ---
  const rolePermissionsData: { roleName: string; permissionName: string }[] = [];
  MOCK_ROLES_LEVEL_3.forEach((role) => {
    role.permissions.forEach((permName) => {
      rolePermissionsData.push({
        roleName: role.name,
        permissionName: permName,
      });
    });
  });
  await prisma.rolePermission.createMany({
    data: rolePermissionsData,
    skipDuplicates: true,
  });
  console.log(`Đã tạo ${rolePermissionsData.length} RolePermissions.`);

  // --- 6. Seed RoleInheritance (Thiết lập kế thừa) ---
  const roleInheritanceData: { parentId: string; childId: string }[] = [];
  MOCK_ROLES_LEVEL_3.forEach((role) => {
    role.inherits.forEach((parentRoleName) => {
      roleInheritanceData.push({
        parentId: parentRoleName, // Role cha (được kế thừa)
        childId: role.name, // Role con (kế thừa)
      });
    });
  });
  await prisma.roleInheritance.createMany({
    data: roleInheritanceData,
    skipDuplicates: true,
  });
  console.log(`Đã tạo ${roleInheritanceData.length} mối quan hệ Kế thừa Vai trò.`);

  // --- 7. Seed User (Tạo một User mẫu) ---

  // 🔑 BƯỚC HASH MẬT KHẨU
  const plainPassword = "adminpassword123";
  // Độ phức tạp (salt rounds) = 10 là mức chuẩn
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const org = await prisma.organization.create({ data: { name: "Demo Org" } });
  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "admin@gmail.com",
      // 👈 SỬ DỤNG MẬT KHẨU ĐÃ HASH
      password: hashedPassword,
      name: "Admin User",
      status: "ACTIVE",
    },
  });
  console.log(`Đã tạo User mẫu: ${user.email} với mật khẩu đã được hash.`);
  console.log(`Mật khẩu gốc (Chỉ để kiểm tra): "${plainPassword}"`);

  // Gán role 'admin' cho user mẫu
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleName: "admin",
    },
  });
  console.log(`Đã gán role 'admin' cho User mẫu.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
