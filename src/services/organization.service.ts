import prisma from "@/prismaClient";
import { Prisma } from "@prisma/client";

export async function getAllOrganizations(queryParams: { [key: string]: any }) {
  const page = Number(queryParams.page) || 1;
  const size = Number(queryParams.size) || 10;

  const skip = (page - 1) * size;

  const where: Prisma.OrganizationWhereInput = {};

  if (queryParams["name"]) {
    // Xử lý Lọc theo Tên (name)
    where.name = {
      contains: queryParams["name"],
    };
  }

  const [data, totalCount] = await prisma.$transaction([
    prisma.organization.findMany({
      skip,
      take: size,
      orderBy: { createdAt: "desc" },
      where,
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true, // Đếm số lượng Users
          },
        },
      },
    }),

    prisma.organization.count({
      where: where,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / size);
  const formattedData = data.map((org) => {
    const { _count, ...rest } = org;

    return {
      ...rest,
      userCount: _count.users, // Lấy số lượng Users
    };
  });

  return {
    content: formattedData,
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
