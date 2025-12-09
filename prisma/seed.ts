import * as bcrypt from "bcrypt";
import prisma from "../src/prismaClient";
import { UserStatus } from "@prisma/client";

const MOCK_ROLES = [
  {
    name: "client",
    permissions: [
      "read_all_subscriptions",
      "read_self_subscription", // Quyền xem gói dịch vụ hiện tại của bản thân
      "update_self_profile", // Quyền cập nhật thông tin cá nhân
      "manage_subscription", // Quyền đăng ký, gia hạn gói dịch vụ (Tạo Payment)
      "read_payments", // Xem lịch sử thanh toán
    ],
    inherits: [],
  },
  {
    name: "org_admin",
    permissions: [
      "manage_organization_users", // Quản lý người dùng trong Org

      // Quản lý Tổ chức và Thanh toán
      "read_organization_details", // Xem thông tin chi tiết Tổ chức
      "update_organization_details", // Cập nhật thông tin Tổ chức
    ],
    inherits: ["client"], // Kế thừa các quyền cơ bản của client
  },
  {
    name: "super_admin",
    permissions: [
      "manage_all_permissions",
      "manage_all_endpoint_permissions",
      "read_subscriptions_details",
      "manage_all_roles",
      "manage_all_organizations", // Quản lý tất cả các tổ chức (CRUD)
      "manage_all_subscriptions", // Quản lý tất cả gói Subscription cơ bản
      "manage_all_users", // Quản lý/Khóa/Kích hoạt tất cả người dùng
    ],
    inherits: ["client", "org_admin"], // Kế thừa tất cả quyền tổ chức và quyền cơ bản
  },
];

async function main() {
  console.log(`Bắt đầu Seed...`);

  // --- 1. Lấy danh sách tất cả các Permissions DUY NHẤT ---
  const allPermissions = new Set<string>();
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

  // Tạo Tổ chức mẫu
  const org = await prisma.organization.create({
    data: {
      name: "Acme Corporation",
      description: "Tổ chức mẫu",
    },
  });
  console.log(`Đã tạo Tổ chức mẫu: ${org.name}.`);

  // --- TẠO 3 USERS MẪU ---
  const usersToCreate = [
    { email: "superadmin@gmail.com", role: "super_admin", name: "System Admin" },
    { email: "orgadmin@gmail.com", role: "org_admin", name: "Org Admin" },
    { email: "client@gmail.com", role: "client", name: "Client" },
  ];

  for (const userData of usersToCreate) {
    // ✨ LOGIC ĐIỀU CHỈNH: Chỉ gán organizationId nếu role là 'org_admin'
    const organizationId = userData.role === "org_admin" ? org.id : null;

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        status: UserStatus.ACTIVE,
        // ✨ Gán organizationId (null cho super_admin và client)
        organizationId: organizationId,
      },
    });

    // Gán role tương ứng
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleName: userData.role,
      },
    });

    const orgStatus = organizationId ? `(Org ID: ${organizationId})` : `(Không có Org)`;
    console.log(`Đã tạo User: ${user.email} với role '${userData.role}' ${orgStatus}.`);
  }

  console.log("Bắt đầu Seed Route Permissions...");

  const endpointPermissionsData = [
    // --- 1. SUBSCRIPTIONS ROUTES (QUẢN LÝ GÓI) ---
    {
      httpMethod: "GET",
      endpoint: "/subscriptions",
      permissionName: "read_all_subscriptions",
    },
    {
      httpMethod: "GET",
      endpoint: "/subscriptions/:id",
      permissionName: "read_subscriptions_details",
    },
    {
      httpMethod: "PATCH",
      endpoint: "/subscriptions/:id",
      permissionName: "manage_all_subscriptions",
    },
    { httpMethod: "POST", endpoint: "/subscriptions", permissionName: "manage_all_subscriptions" },
    {
      httpMethod: "DELETE",
      endpoint: "/subscriptions/:id",
      permissionName: "manage_all_subscriptions",
    },

    // --- 2. USERS ROUTES (QUẢN LÝ TẤT CẢ USER) ---
    { httpMethod: "GET", endpoint: "/users", permissionName: "manage_all_users" },
    { httpMethod: "GET", endpoint: "/users/:id", permissionName: "manage_all_users" },
    { httpMethod: "PATCH", endpoint: "/users/:id", permissionName: "manage_all_users" },
    { httpMethod: "DELETE", endpoint: "/users/:id", permissionName: "manage_all_users" },

    // --- 3. ROLES ROUTES (QUẢN LÝ RBAC) ---
    { httpMethod: "GET", endpoint: "/roles", permissionName: "manage_all_roles" },
    { httpMethod: "POST", endpoint: "/roles", permissionName: "manage_all_roles" },
    { httpMethod: "PATCH", endpoint: "/roles/:name", permissionName: "manage_all_roles" },
    { httpMethod: "DELETE", endpoint: "/roles/:name", permissionName: "manage_all_roles" },

    { httpMethod: "GET", endpoint: "/permissions", permissionName: "manage_all_permissions" },
    { httpMethod: "POST", endpoint: "/permissions", permissionName: "manage_all_permissions" },
    {
      httpMethod: "PATCH",
      endpoint: "/permissions/:name",
      permissionName: "manage_all_permissions",
    },
    {
      httpMethod: "DELETE",
      endpoint: "/permissions/:name",
      permissionName: "manage_all_permissions",
    },

    // --- 4. ORGANIZATION ROUTES (QUẢN LÝ TỔ CHỨC) ---
    { httpMethod: "GET", endpoint: "/organizations", permissionName: "manage_all_organizations" },
    {
      httpMethod: "GET",
      endpoint: "/organizations/:id",
      permissionName: "read_organization_details",
    },
    {
      httpMethod: "PATCH",
      endpoint: "/organizations/:id",
      permissionName: "update_organization_details",
    },
    { httpMethod: "POST", endpoint: "/organizations", permissionName: "manage_all_organizations" },

    // --- 5. ROUTE-PERMISSION ROUTES ---
    {
      httpMethod: "GET",
      endpoint: "/endpoint-permissions",
      permissionName: "manage_all_endpoint_permissions",
    },
    {
      httpMethod: "GET",
      endpoint: "/endpoint-permissions/:id",
      permissionName: "manage_all_endpoint_permissions",
    },
    {
      httpMethod: "POST",
      endpoint: "/endpoint-permissions",
      permissionName: "manage_all_endpoint_permissions",
    },
    {
      httpMethod: "PATCH",
      endpoint: "/endpoint-permissions/:id",
      permissionName: "manage_all_endpoint_permissions",
    },
    {
      httpMethod: "DELETE",
      endpoint: "/endpoint-permissions/:id",
      permissionName: "manage_all_endpoint_permissions",
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
