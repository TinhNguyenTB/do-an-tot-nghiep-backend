import * as bcrypt from "bcrypt";
import prisma from "../src/prismaClient";
import { UserStatus } from "@prisma/client";

/* =======================
   PERMISSIONS - Toàn cục (Global)
======================= */
const GLOBAL_PERMISSIONS_NAMES = [
  // System Management (SA)
  "system:manage_users",
  "system:manage_roles",
  "system:manage_permissions",
  "system:manage_subscriptions",

  // Org-scoped Actions (có thể áp dụng cho cả SA và Org Admin)
  "org:read_members",
  "org:invite_members",
  "org:remove_members",
  "org:update_member_roles",
  "org:manage_billing",

  // Self-Management
  "change_self_password",
  "update_self_profile",

  // App Usage
  "app:read_content",
  "app:write_content",
];

/* =======================
   MAIN
======================= */
async function main() {
  console.log("Start seeding...");

  /* =======================
     CLEAN DATABASE
  ======================= */
  console.log("Cleaning existing data...");
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany(),
    prisma.userSubscription.deleteMany(),
    prisma.stripeCustomer.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.userRole.deleteMany(),
    prisma.roleInheritance.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.endpointPermission.deleteMany(),
    prisma.user.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.role.deleteMany(),
    prisma.permission.deleteMany(),
  ]);

  /* =======================
     1. TẠO TẤT CẢ GLOBAL PERMISSIONS
  ======================= */
  console.log("1. Creating Global Permissions...");
  await prisma.permission.createMany({
    data: GLOBAL_PERMISSIONS_NAMES.map((name) => ({
      name,
      description: `Global Permission: ${name.replace(/_/g, " ")}`,
      organizationId: null, // GLOBAL
    })),
    skipDuplicates: true,
  });

  const allGlobalPermissions = await prisma.permission.findMany({
    where: { organizationId: null },
  });
  const getPermissionId = (name: string) => allGlobalPermissions.find((p) => p.name === name)?.id;
  const orgActionIds = GLOBAL_PERMISSIONS_NAMES.filter(
    (name) =>
      name.startsWith("org:") ||
      name.startsWith("app:") ||
      name.startsWith("change_self") ||
      name.startsWith("update_self")
  )
    .map((name) => getPermissionId(name)!)
    .filter((id) => id !== undefined) as number[];

  /* =======================
     1.5. TẠO ENDPOINT PERMISSIONS
     (Sử dụng các Global Permission vừa tạo)
  ======================= */
  console.log("1.5. Creating Endpoint Permissions...");

  const endpointPermissionsData = [
    // USER & AUTH
    {
      httpMethod: "POST",
      endpoint: "/api/v1/auth/password",
      permissionName: "change_self_password",
    },
    { httpMethod: "PATCH", endpoint: "/api/v1/users/me", permissionName: "update_self_profile" },
    // ORGANIZATION MEMBERSHIP (Dùng cho cả Org Admin và SA)
    { httpMethod: "GET", endpoint: "/api/v1/orgs/:id/members", permissionName: "org:read_members" },
    {
      httpMethod: "POST",
      endpoint: "/api/v1/orgs/:id/members",
      permissionName: "org:invite_members",
    },
    {
      httpMethod: "DELETE",
      endpoint: "/api/v1/orgs/:id/members/:memberId",
      permissionName: "org:remove_members",
    },
    {
      httpMethod: "PATCH",
      endpoint: "/api/v1/orgs/:id/members/:memberId/role",
      permissionName: "org:update_member_roles",
    },
    // SYSTEM ADMIN ACTIONS (Chỉ SA mới có)
    {
      httpMethod: "PATCH",
      endpoint: "/api/v1/system/users/:id/status",
      permissionName: "system:manage_users",
    },
    { httpMethod: "POST", endpoint: "/api/v1/system/roles", permissionName: "system:manage_roles" },
    // APP USAGE
    { httpMethod: "GET", endpoint: "/api/v1/data", permissionName: "app:read_content" },
  ];

  await prisma.endpointPermission.createMany({
    data: endpointPermissionsData,
    skipDuplicates: true,
  });

  /* =======================
     2. TẠO SYSTEM ROLES (GLOBAL)
  ======================= */
  console.log("2. Creating System Roles...");
  const superAdminRole = await prisma.role.create({
    data: {
      name: "super_admin",
      description: "System Super Admin (Global Role)",
      organizationId: null,
    },
  });

  const clientRole = await prisma.role.create({
    data: {
      name: "client",
      description: "Standalone Client/Base User (Global Role)",
      organizationId: null,
    },
  });

  /* =======================
     3. SYSTEM ROLE PERMISSIONS
  ======================= */
  console.log("3. Assigning Permissions to System Roles...");

  // Super Admin: có tất cả các quyền Global
  await prisma.rolePermission.createMany({
    data: allGlobalPermissions.map((p) => ({
      roleId: superAdminRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  // Client Role: chỉ có quyền tự quản lý và quyền App cơ bản
  const clientPermissionIds = allGlobalPermissions
    .filter(
      (p) =>
        p.name === "change_self_password" ||
        p.name === "update_self_profile" ||
        p.name === "app:read_content" ||
        p.name === "app:write_content"
    )
    .map((p) => p.id);

  await prisma.rolePermission.createMany({
    data: clientPermissionIds.map((pId) => ({
      roleId: clientRole.id,
      permissionId: pId,
    })),
    skipDuplicates: true,
  });

  /* =======================
     4. TẠO ORGANIZATION & ORG ADMIN USER
  ======================= */
  console.log("4. Creating Organization and Org Owner User...");
  const orgAdminPassword = await bcrypt.hash("password", 10);

  const orgOwner = await prisma.user.create({
    data: {
      email: "orgowner@acme.com",
      password: orgAdminPassword,
      name: "Acme Org Owner",
      status: UserStatus.ACTIVE,
    },
  });

  const organization = await prisma.organization.create({
    data: {
      name: "Acme Corporation",
      description: "Demo Organization",
      ownerId: orgOwner.id,
    },
  });

  await prisma.user.update({
    where: { id: orgOwner.id },
    data: { organizationId: organization.id },
  });

  /* =======================
     4.5. TẠO CUSTOM PERMISSION CHO ORG (MỚI)
     (Ví dụ: Acme muốn có quyền riêng cho riêng họ)
  ======================= */
  console.log("4.5. Creating Custom Org-Scoped Permissions...");
  const customOrgPermission = await prisma.permission.create({
    data: {
      name: "org:manage_custom_reports",
      description: "Quản lý các báo cáo tùy chỉnh của Acme",
      organizationId: organization.id,
    },
  });

  /* =======================
     5. ORG ROLES
  ======================= */
  console.log("5. Creating Organization Roles...");

  // Org Owner Role (Gắn với Org này)
  const orgOwnerRole = await prisma.role.create({
    data: {
      name: "org_admin",
      description: "Organization Owner",
      organizationId: organization.id,
    },
  });

  // Org Member Role (Gắn với Org này)
  const orgMemberRole = await prisma.role.create({
    data: {
      name: "org_member",
      description: "Organization Member",
      organizationId: organization.id,
    },
  });

  /* =======================
     6. ORG ROLE PERMISSIONS
     (Owner có quyền Global Org Action + Custom Org Permission)
  ======================= */
  console.log("6. Assigning Permissions to Org Roles...");

  // Org Owner Role Permissions: Gồm các quyền org:xxx toàn cục + quyền tùy chỉnh
  const ownerPermissions = [
    ...orgActionIds, // Các quyền org:read, org:invite, app:read...
    customOrgPermission.id, // Quyền tùy chỉnh
  ];

  await prisma.rolePermission.createMany({
    data: ownerPermissions.map((pId) => ({
      roleId: orgOwnerRole.id,
      permissionId: pId,
    })),
    skipDuplicates: true,
  });

  // Org Member Role Permissions: Chỉ có quyền App cơ bản (đã có trong Client Role)
  // Ta chỉ cần gán Client Role (qua Inheritance) là đủ, nhưng sẽ gán lại quyền App để minh họa
  const memberPermissions = clientPermissionIds;
  await prisma.rolePermission.createMany({
    data: memberPermissions.map((pId) => ({
      roleId: orgMemberRole.id,
      permissionId: pId,
    })),
    skipDuplicates: true,
  });

  /* =======================
     7. ROLE INHERITANCE
     (Owner và Member kế thừa quyền cơ bản của Client)
  ======================= */
  console.log("7. Creating Role Inheritance...");
  // Org Owner kế thừa Client
  await prisma.roleInheritance.create({
    data: {
      parentId: clientRole.id,
      childId: orgOwnerRole.id,
    },
  });
  // Org Member kế thừa Client
  await prisma.roleInheritance.create({
    data: {
      parentId: clientRole.id,
      childId: orgMemberRole.id,
    },
  });

  /* =======================
     8. ASSIGN ROLES TO USERS
  ======================= */
  console.log("8. Assigning Roles to users...");

  // Org Owner User
  await prisma.userRole.create({
    data: {
      userId: orgOwner.id,
      roleId: orgOwnerRole.id,
    },
  });

  /* =======================
     9. SUPER ADMIN USER
  ======================= */
  const superAdmin = await prisma.user.create({
    data: {
      email: "superadmin@gmail.com",
      password: orgAdminPassword,
      name: "System Super Admin",
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: superAdmin.id,
      roleId: superAdminRole.id,
    },
  });

  /* =======================
     10. CLIENT USER (Lẻ)
  ======================= */
  const client = await prisma.user.create({
    data: {
      email: "client@gmail.com",
      password: orgAdminPassword,
      name: "Standalone Client User",
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: client.id,
      roleId: clientRole.id,
    },
  });

  /* =======================
     11. ORG MEMBER USER
  ======================= */
  const orgMember = await prisma.user.create({
    data: {
      email: "orgmember@acme.com",
      password: orgAdminPassword,
      name: "Acme Org Member",
      status: UserStatus.ACTIVE,
      organizationId: organization.id,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: orgMember.id,
      roleId: orgMemberRole.id,
    },
  });

  // TẠO SUBSCRIPTION MẪU

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

  await Promise.all(
    subscriptionData.map((data) =>
      prisma.subscription.upsert({
        where: { name: data.name },
        update: data,
        create: data,
      })
    )
  );

  console.log("✅ Seed completed");
  console.log("🔑 Password for all users: password");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
