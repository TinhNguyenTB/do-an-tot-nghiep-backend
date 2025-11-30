import prisma from "@/prismaClient";
import { Prisma } from "@prisma/client";

// --- READ ALL ---
export async function getAllRoles(queryParams: { [key: string]: any }) {
  const page = Number(queryParams.page) || 1;
  const size = Number(queryParams.size) || 10;

  const skip = (page - 1) * size;

  const where: Prisma.RoleWhereInput = {};
  const validFilterFields = ["name"];

  for (const key of validFilterFields) {
    if (queryParams[key]) {
      // Xử lý Lọc theo Tên (name)
      if (key === "name") {
        where.name = {
          contains: queryParams[key], // Tìm kiếm gần đúng
        };
      }
    }
  }

  const [data, totalCount] = await prisma.$transaction([
    prisma.role.findMany({
      skip,
      take: size,
      orderBy: { createdAt: "desc" },
      where,
      select: {
        name: true,

        // Role này kế thừa từ role nào?
        inheritsFrom: {
          select: {
            parent: {
              select: {
                name: true,
              },
            },
          },
        },

        // Những role nào kế thừa role này?
        inheritedBy: {
          select: {
            child: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),

    prisma.role.count({
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
