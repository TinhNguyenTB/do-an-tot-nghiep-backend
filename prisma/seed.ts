import { PrismaClient, UserStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Start seeding with Organization Scoped Roles & Permissions...");

  // 1. CLEANUP
  await prisma.$transaction([
    prisma.userRole.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.endpointPermission.deleteMany(),
    prisma.userSubscription.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.role.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.user.deleteMany(),
    prisma.subscription.deleteMany(),
  ]);

  const hashedPassword = await bcrypt.hash("password", 10);

  // 2. TẠO SUPER ADMIN (GLOBAL - organizationId: null)
  console.log("👑 Creating Global Super Admin...");
  const superAdminRole = await prisma.role.create({
    data: {
      name: "super_admin",
      description: "Quản trị viên hệ thống",
      organizationId: null,
    },
  });

  await prisma.user.create({
    data: {
      email: "superadmin@gmail.com",
      password: hashedPassword,
      name: "System Super Admin",
      status: UserStatus.ACTIVE,
      roles: { create: { roleId: superAdminRole.id } },
    },
  });

  // 3. TẠO TỔ CHỨC VÀ CHỦ SỞ HỮU (ORG OWNER)
  console.log("🏢 Creating Organization...");
  const orgOwner = await prisma.user.create({
    data: {
      email: "orgowner@acme.com",
      password: hashedPassword,
      name: "Acme Owner",
      status: UserStatus.ACTIVE,
    },
  });

  const organization = await prisma.organization.create({
    data: {
      name: "Acme Corporation",
      ownerId: orgOwner.id,
    },
  });

  // Cập nhật organizationId cho Owner ngay lập tức
  await prisma.user.update({
    where: { id: orgOwner.id },
    data: { organizationId: organization.id },
  });

  // 4. TẠO PERMISSIONS GẮN VỚI ORGANIZATION
  console.log("🔑 Creating Org-Scoped Permissions...");
  const permissionNames = ["read_users", "read_roles", "read_permissions", "read_payment_history"];

  const orgPermissions = await Promise.all(
    permissionNames.map((name) =>
      prisma.permission.create({
        data: {
          name,
          organizationId: organization.id, // Gán trực tiếp vào Org
          description: `Quyền ${name} cho ${organization.name}`,
        },
      })
    )
  );

  // 5. TẠO ROLES GẮN VỚI ORGANIZATION
  console.log("🎭 Creating Org-Scoped Roles...");
  const orgAdminRole = await prisma.role.create({
    data: {
      name: "org_admin",
      organizationId: organization.id, // Gán trực tiếp vào Org
      description: "Quản trị viên nội bộ tổ chức",
    },
  });

  // 6. GÁN QUYỀN VÀO ROLE (Role & Permission cùng Org)
  console.log("🛡️ Linking Org Permissions to Org Role...");
  await prisma.rolePermission.createMany({
    data: orgPermissions.map((p) => ({
      roleId: orgAdminRole.id,
      permissionId: p.id,
    })),
  });

  // 7. GÁN ROLE CHO OWNER VÀ MEMBER
  console.log("👤 Assigning Org Roles to Users...");
  // Gán role cho Owner
  await prisma.userRole.create({
    data: { userId: orgOwner.id, roleId: orgAdminRole.id },
  });

  // Tạo Member và gán role
  await prisma.user.create({
    data: {
      email: "orgmember@acme.com",
      password: hashedPassword,
      name: "Acme Staff",
      status: UserStatus.ACTIVE,
      organizationId: organization.id,
      roles: { create: { roleId: orgAdminRole.id } }, // Có thể dùng role org_member nếu muốn
    },
  });

  // 8. TẠO CÁC GÓI DỊCH VỤ MẪU (SUBSCRIPTIONS)
  console.log("💳 Creating Sample Subscriptions...");

  const subscriptionData = [
    // // GÓI CÁ NHÂN (User Limit = 1)
    // {
    //   name: "Gói Cá Nhân - 1 Tháng",
    //   duration: 30, // 30 ngày
    //   price: 50000, // 50,000 VND
    //   userLimit: 1,
    // },
    // {
    //   name: "Gói Cá Nhân - 1 Năm",
    //   duration: 365,
    //   price: 500000, // Tiết kiệm hơn khi mua năm
    //   userLimit: 1,
    // },

    // GÓI TỔ CHỨC (User Limit > 1)
    {
      name: "Gói Tổ Chức Standard - 1 Tháng",
      duration: 30,
      price: 50000,
      userLimit: 80,
    },
    {
      name: "Gói Tổ Chức Standard - 1 Năm",
      duration: 365,
      price: 500000,
      userLimit: 100,
    },

    // GÓI DOANH NGHIỆP (User Limit lớn hoặc không giới hạn)
    {
      name: "Gói Enterprise - Vô tận",
      duration: 365,
      price: 15000000,
      userLimit: 1000, // Gần như không giới hạn
    },
  ];

  // Sử dụng createMany để tối ưu tốc độ vì chúng ta đã xóa sạch data ở đầu file seed
  await prisma.subscription.createMany({
    data: subscriptionData,
  });

  console.log("✅ Subscriptions seeded successfully!");

  console.log("✅ Seed completed: Organization isolation established.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
