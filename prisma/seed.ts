import * as bcrypt from "bcrypt";
import prisma from "../src/prismaClient";
import { UserStatus } from "@prisma/client";

const SYSTEM_PERMISSIONS = [
  // SUBSCRIPTIONS
  "read_subscriptions",
  "read_subscriptions_details",
  "update_subscriptions",
  "create_subscriptions",
  "delete_subscriptions",
  // USERS
  "read_users",
  "create_users",
  "read_users_details",
  "update_users",
  "delete_users",
  // ROLES
  "read_roles",
  "read_roles_details",
  "create_roles",
  "update_roles",
  "delete_roles",
  // PERMISSIONS (Tự quản lý)
  "read_permissions",
  "read_permissions_details",
  "create_permissions",
  "update_permissions",
  "delete_permissions",
  // ORGANIZATIONS
  "read_organizations",
  "read_organization_details",
  "update_organizations",
  "create_organizations",
  "delete_organizations",
  // ENDPOINT-PERMISSION
  "read_endpoint_permissions",
  "read_endpoint_permissions_details",
  "create_endpoint_permissions",
  "update_endpoint_permissions",
  "delete_endpoint_permissions",
];

const MOCK_ROLES = [
  {
    name: "client",
    permissions: [
      "read_subscriptions",
      "read_self_subscription", // Quyền xem gói dịch vụ hiện tại của bản thân
      "update_self_profile", // Quyền cập nhật thông tin cá nhân
      "read_self_payments", // Xem lịch sử thanh toán
    ],
    inherits: [],
  },
  {
    name: "org_admin",
    permissions: [
      "manage_organization_users", // Quản lý người dùng trong Org

      // Quản lý Tổ chức và Thanh toán
      "read_self_organization", // Xem thông tin chi tiết Tổ chức
      "update_self_organization", // Cập nhật thông tin Tổ chức
    ],
    inherits: ["client"], // Kế thừa các quyền cơ bản của client
  },
  {
    name: "super_admin",
    permissions: [],
    inherits: [],
  },
];

async function main() {
  console.log(`Bắt đầu Seed...`);

  const allPermissions = new Set<string>();

  // ✨ FIX: Đảm bảo các quyền chung (SYSTEM_PERMISSIONS) được thêm vào
  SYSTEM_PERMISSIONS.forEach((perm) => allPermissions.add(perm));

  // --- 1. Lấy danh sách tất cả các Permissions DUY NHẤT ---
  MOCK_ROLES.forEach((role) => {
    role.permissions.forEach((perm) => allPermissions.add(perm));
  });

  const permissionData = Array.from(allPermissions).map((name) => ({
    name,
    description: `Quyền cho phép: ${name.replace(/_/g, " ")}`,
  }));

  // --- 2. Xóa dữ liệu cũ (Tùy chọn: cần thận trọng trong môi trường Production!) ---
  await prisma.userSubscription.deleteMany({});
  await prisma.endpointPermission.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.roleInheritance.deleteMany({});
  await prisma.rolePermission.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.permission.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.stripeCustomer.deleteMany({});
  console.log("Đã xóa dữ liệu cũ.");

  // --- 3. Seed Permissions ---
  await prisma.permission.createMany({
    data: permissionData,
    skipDuplicates: true,
  });
  console.log(`Đã tạo ${permissionData.length} Permissions.`);

  // --- 4. Seed Roles ---
  const roleData = MOCK_ROLES.map((role) => ({
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
  MOCK_ROLES.forEach((role) => {
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
  MOCK_ROLES.forEach((role) => {
    role.inherits.forEach((parentRoleName) => {
      roleInheritanceData.push({
        parentId: parentRoleName,
        childId: role.name,
      });
    });
  });
  await prisma.roleInheritance.createMany({
    data: roleInheritanceData,
    skipDuplicates: true,
  });
  console.log(`Đã tạo ${roleInheritanceData.length} mối quan hệ Kế thừa Vai trò.`);

  // --- 7. Seed Subscriptions (Gói Dịch Vụ) ---
  const subscriptionData = [
    // PERSONAL
    {
      name: "Personal Basic – 30 Days",
      duration: 30,
      price: 30000,
      userLimit: 1,
    },
    {
      name: "Personal Pro – 1 Year",
      duration: 365,
      price: 300000,
      userLimit: 1,
    },

    // ORGANIZATION (short-term)
    {
      name: "Organization Standard – 30 Days",
      duration: 30,
      price: 600000,
      userLimit: 100,
    },
    {
      name: "Organization Standard – 3 Months",
      duration: 90,
      price: 1800000,
      userLimit: 100,
    },
    {
      name: "Organization Standard – 6 Months",
      duration: 180,
      price: 3600000,
      userLimit: 100,
    },

    // ORGANIZATION (year)
    {
      name: "Organization Standard – 1 Year",
      duration: 365,
      price: 6000000,
      userLimit: 100,
    },
  ];

  const subscriptions = await Promise.all(
    subscriptionData.map((data) =>
      prisma.subscription.upsert({
        where: { name: data.name },
        update: data,
        create: data,
      })
    )
  );
  console.log(`Đã tạo ${subscriptions.length} Gói Dịch Vụ (Subscriptions).`);

  // --------------------------------------------------------------------------------
  // --- 8. Seed User & Organization (Tạo 3 User mẫu) ---
  // --------------------------------------------------------------------------------

  // 🔑 BƯỚC HASH MẬT KHẨU CHUNG
  const plainPassword = "password"; // Mật khẩu chung cho cả 3 user
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const superAdmin = await prisma.user.create({
    data: {
      email: "superadmin@gmail.com",
      password: hashedPassword,
      name: "Super Admin",
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: superAdmin.id,
      roleName: "super_admin",
    },
  });

  console.log(`Đã tạo Super Admin: ${superAdmin.email}`);

  const orgAdmin = await prisma.user.create({
    data: {
      email: "orgadmin@gmail.com",
      password: hashedPassword,
      name: "Org Admin",
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: orgAdmin.id,
      roleName: "org_admin",
    },
  });

  console.log(`Đã tạo Org Admin: ${orgAdmin.email}`);

  const org = await prisma.organization.create({
    data: {
      name: "Acme Corporation",
      description: "Tổ chức mẫu",
      ownerId: orgAdmin.id,
    },
  });

  console.log(`Đã tạo Organization: ${org.name} (Owner: ${orgAdmin.email})`);

  await prisma.user.update({
    where: { id: orgAdmin.id },
    data: {
      organizationId: org.id,
    },
  });

  const client = await prisma.user.create({
    data: {
      email: "client@gmail.com",
      password: hashedPassword,
      name: "Client",
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: client.id,
      roleName: "client",
    },
  });

  console.log(`Đã tạo Client: ${client.email}`);

  console.log("Bắt đầu Seed Route Permissions...");

  const endpointPermissionsData = [
    // --- 1. SUBSCRIPTIONS ROUTES (QUẢN LÝ GÓI) ---
    {
      httpMethod: "GET",
      endpoint: "/subscriptions",
      permissionName: "read_subscriptions",
    },
    {
      httpMethod: "GET",
      endpoint: "/subscriptions/:id",
      permissionName: "read_subscriptions_details",
    },
    {
      httpMethod: "PATCH",
      endpoint: "/subscriptions/:id",
      permissionName: "update_subscriptions",
    },
    { httpMethod: "POST", endpoint: "/subscriptions", permissionName: "create_subscriptions" },
    {
      httpMethod: "DELETE",
      endpoint: "/subscriptions/:id",
      permissionName: "delete_subscriptions",
    },

    // --- 2. USERS ROUTES (QUẢN LÝ TẤT CẢ USER) ---
    { httpMethod: "GET", endpoint: "/users", permissionName: "read_users" },
    { httpMethod: "POST", endpoint: "/users", permissionName: "create_users" },
    { httpMethod: "GET", endpoint: "/users/:id", permissionName: "read_users_details" },
    { httpMethod: "PATCH", endpoint: "/users/:id", permissionName: "update_users" },
    { httpMethod: "DELETE", endpoint: "/users/:id", permissionName: "delete_users" },

    // --- 3. ROLES ROUTES (QUẢN LÝ RBAC) ---
    { httpMethod: "GET", endpoint: "/roles", permissionName: "read_roles" },
    { httpMethod: "GET", endpoint: "/roles/:name", permissionName: "read_roles_details" },
    { httpMethod: "POST", endpoint: "/roles", permissionName: "create_roles" },
    { httpMethod: "PATCH", endpoint: "/roles/:name", permissionName: "update_roles" },
    { httpMethod: "DELETE", endpoint: "/roles/:name", permissionName: "delete_roles" },

    { httpMethod: "GET", endpoint: "/permissions", permissionName: "read_permissions" },
    { httpMethod: "POST", endpoint: "/permissions", permissionName: "create_permissions" },
    {
      httpMethod: "GET",
      endpoint: "/permissions/:name",
      permissionName: "read_permissions_details",
    },
    {
      httpMethod: "PATCH",
      endpoint: "/permissions/:name",
      permissionName: "update_permissions",
    },
    {
      httpMethod: "DELETE",
      endpoint: "/permissions/:name",
      permissionName: "delete_permissions",
    },

    // --- 4. ORGANIZATION ROUTES (QUẢN LÝ TỔ CHỨC) ---
    { httpMethod: "GET", endpoint: "/organizations", permissionName: "read_organizations" },
    {
      httpMethod: "GET",
      endpoint: "/organizations/:id",
      permissionName: "read_organization_details",
    },
    {
      httpMethod: "PATCH",
      endpoint: "/organizations/:id",
      permissionName: "update_organizations",
    },
    { httpMethod: "POST", endpoint: "/organizations", permissionName: "create_organizations" },
    {
      httpMethod: "DELETE",
      endpoint: "/organizations/:id",
      permissionName: "delete_organizations",
    },

    // --- 5. ENDPOINT-PERMISSION ROUTES ---
    {
      httpMethod: "GET",
      endpoint: "/endpoint-permissions",
      permissionName: "read_endpoint_permissions",
    },
    {
      httpMethod: "GET",
      endpoint: "/endpoint-permissions/:id",
      permissionName: "read_endpoint_permissions_details",
    },
    {
      httpMethod: "POST",
      endpoint: "/endpoint-permissions",
      permissionName: "create_endpoint_permissions",
    },
    {
      httpMethod: "PATCH",
      endpoint: "/endpoint-permissions/:id",
      permissionName: "update_endpoint_permissions",
    },
    {
      httpMethod: "DELETE",
      endpoint: "/endpoint-permissions/:id",
      permissionName: "delete_endpoint_permissions",
    },
  ];

  await prisma.endpointPermission.createMany({
    data: endpointPermissionsData,
    skipDuplicates: true,
  });
  console.log(`Đã tạo ${endpointPermissionsData.length} Endpoint Permissions.`);

  console.log(`Seed hoàn tất. 🔑 Mật khẩu chung cho tất cả user là: "${plainPassword}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
