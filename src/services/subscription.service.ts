import { CreateSubscriptionDto } from "@/dtos/subscription.dto";
import prisma from "@/prismaClient";

// --- CREATE ---
export async function createSubscription(dto: CreateSubscriptionDto) {
  return prisma.subscription.create({
    data: {
      name: dto.name,
      duration: dto.duration,
      price: dto.price,
      userLimit: dto.userLimit,
    },
  });
}

// --- READ ALL ---
export async function getAllSubscriptions() {
  return prisma.subscription.findMany({});
}

// --- READ ONE ---
export async function getSubscriptionById(id: number) {
  const sub = await prisma.subscription.findUnique({
    where: { id: id },
  });
  if (!sub) {
    throw new Error("Gói dịch vụ không tìm thấy.");
  }
  return sub;
}

// --- UPDATE ---
export async function updateSubscription(id: number, dto: Partial<CreateSubscriptionDto>) {
  return prisma.subscription.update({
    where: { id: id },
    data: {
      name: dto.name,
      duration: dto.duration,
      price: dto.price,
      userLimit: dto.userLimit,
    },
  });
}

// --- DELETE ---
export async function deleteSubscription(id: number) {
  // Lưu ý: Cần kiểm tra quan hệ khóa ngoại trước khi xóa
  // (Nếu có Payment hoặc UserSubscription nào trỏ đến ID này, database sẽ báo lỗi)
  return prisma.subscription.delete({
    where: { id: id },
  });
}
