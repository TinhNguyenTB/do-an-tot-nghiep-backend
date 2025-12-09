import prisma from "@/prismaClient";
import { Prisma } from "@prisma/client";

// --- READ ALL ---
export async function getAllEndpointPermissions(queryParams: { [key: string]: any }) {
  const page = Number(queryParams.page) || 1;
  const size = Number(queryParams.size) || 10;

  const skip = (page - 1) * size;

  const where: Prisma.EndpointPermissionWhereInput = {};

  if (queryParams["endpoint"]) {
    where.endpoint = {
      contains: queryParams["endpoint"],
    };
  }

  const [data, totalCount] = await prisma.$transaction([
    prisma.endpointPermission.findMany({
      skip,
      take: size,
      orderBy: { createdAt: "desc" },
      where,
    }),

    prisma.endpointPermission.count({
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
