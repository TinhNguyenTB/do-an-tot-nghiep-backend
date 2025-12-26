import prisma from "@/prismaClient";
import { Prisma } from "@prisma/client";

export async function getAllPermissions(queryParams: { [key: string]: any }) {
  const page = Number(queryParams.page) || 1;
  const size = Number(queryParams.size) || 10;
  const search = queryParams.search?.trim();
  const skip = (page - 1) * size;

  const where: Prisma.PermissionWhereInput = {};

  if (queryParams["name"]) {
    where.name = {
      contains: queryParams["name"],
    };
  }

  if (search) {
    where.OR = [
      {
        name: {
          contains: search,
        },
      },
      {
        description: {
          contains: search,
        },
      },
    ];
  }

  const [data, totalCount] = await prisma.$transaction([
    prisma.permission.findMany({
      skip,
      take: size,
      orderBy: { createdAt: "desc" },
      where,
      select: {
        name: true,
        description: true,
      },
    }),

    prisma.permission.count({
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
