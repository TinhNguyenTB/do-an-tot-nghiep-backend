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

export async function getOrganizationUsers(
  organizationId: number,
  queryParams: { [key: string]: any }
) {
  const page = Number(queryParams.page) || 1;
  const size = Number(queryParams.size) || 10;
  const skip = (page - 1) * size;

  const andConditions: Prisma.UserWhereInput[] = [];

  // Lọc theo Tên (Name)
  if (queryParams["name"]) {
    andConditions.push({
      name: {
        contains: String(queryParams["name"]),
      },
    });
  }

  // Lọc theo Email
  if (queryParams["email"]) {
    andConditions.push({
      email: {
        contains: String(queryParams["email"]),
      },
    });
  }

  const where: Prisma.UserWhereInput = {
    // Luôn lọc theo organizationId
    organizationId: organizationId,
  };

  // Chỉ thêm AND nếu có điều kiện lọc phụ
  if (andConditions.length > 0) {
    where.AND = andConditions;
  }
  const [data, totalCount] = await prisma.$transaction([
    prisma.user.findMany({
      skip,
      take: size,
      orderBy: { createdAt: "desc" },
      where,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),

    prisma.user.count({
      where: where,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / size);

  return {
    content: data,
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
