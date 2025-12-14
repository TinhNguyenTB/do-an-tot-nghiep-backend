import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Một dòng duy nhất tạo hoặc tái sử dụng instance
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Lưu lại vào global để hot-reload không tạo thêm connection
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
