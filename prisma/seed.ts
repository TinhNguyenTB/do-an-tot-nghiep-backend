// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Tạo role + permission mặc định
  await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: { name: "ADMIN", description: "Quản trị viên" },
  });

  await prisma.role.upsert({
    where: { name: "USER" },
    update: {},
    create: { name: "USER", description: "Người dùng thường" },
  });

  // Tạo gói subscription mẫu
  await prisma.subscription.createMany({
    data: [
      { name: "Basic", duration: 30, price: 199000 },
      { name: "Pro", duration: 90, price: 499000 },
      { name: "Enterprise", duration: 365, price: 1999000 },
    ],
    skipDuplicates: true,
  });

  console.log("Seed thành công!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
