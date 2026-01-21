import prisma from "@/prismaClient";
import { PaymentStatus } from "@prisma/client";

export async function getOrganizationPaymentHistory(
  organizationId: number,
  queryParams: { [key: string]: any }
) {
  const page = Number(queryParams.page) || 1;
  const size = Number(queryParams.size) || 10;
  const skip = (page - 1) * size;

  // 1. Lấy danh sách thanh toán kèm thông tin User và Subscription
  // Chúng ta lọc theo organizationId của User thực hiện thanh toán
  const [payments, totalCount] = await Promise.all([
    prisma.payment.findMany({
      where: {
        user: {
          organizationId: organizationId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        subscription: {
          select: {
            name: true,
            duration: true,
          },
        },
      },
      orderBy: {
        paymentDate: "desc", // Mới nhất lên đầu
      },
      skip: skip,
      take: size,
    }),
    prisma.payment.count({
      where: {
        user: { organizationId: organizationId },
      },
    }),
  ]);
  const totalPages = Math.ceil(totalCount / size);

  return {
    content: payments,
    meta: {
      totalItems: totalCount,
      totalPages: totalPages,
      currentPage: page,
      itemsPerPage: size,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getAllTransactionHistory(queryParams: {
  page?: string;
  size?: string;
  status?: string;
  search?: string;
}) {
  const page = Number(queryParams.page) || 1;
  const size = Number(queryParams.size) || 10;
  const skip = (page - 1) * size;

  // Xây dựng điều kiện lọc linh hoạt
  const where: any = {};

  if (queryParams.status) {
    where.status = queryParams.status as PaymentStatus;
  }

  if (queryParams.search) {
    where.OR = [
      { transactionId: { contains: queryParams.search, mode: "insensitive" } },
      { user: { email: { contains: queryParams.search, mode: "insensitive" } } },
      { user: { name: { contains: queryParams.search, mode: "insensitive" } } },
    ];
  }

  const [payments, totalCount] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            organization: {
              // Admin thường cần biết giao dịch thuộc công ty nào
              select: { name: true },
            },
          },
        },
        subscription: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { paymentDate: "desc" },
      skip,
      take: size,
    }),
    prisma.payment.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / size);

  return {
    content: payments,
    meta: {
      totalItems: totalCount,
      totalPages: totalPages,
      currentPage: page,
      itemsPerPage: size,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
