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
      name: "Gói 1 Tháng",
      duration: 30,
      price: 40000,
      userLimit: 80,
    },
    {
      name: "Gói 1 Năm",
      duration: 365,
      price: 450000,
      userLimit: 100,
    },

    // GÓI DOANH NGHIỆP (User Limit lớn hoặc không giới hạn)
    {
      name: "Gói Enterprise",
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
