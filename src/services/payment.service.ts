import prisma from "@/prismaClient";

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
