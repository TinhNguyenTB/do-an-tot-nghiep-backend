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
        description: true,

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

// Trong RoleService.ts

/**
 * Kiểm tra xem việc thêm quan hệ cha-con (parentId -> childId) có tạo ra vòng lặp hay không.
 * @param parentId Role cha mới.
 * @param childId Role con.
 * @returns true nếu tạo vòng lặp, false nếu hợp lệ.
 */
// async function createsCycle(parentId: string, childId: string): Promise<boolean> {
//     // 1. Nếu cha mới chính là con, đã là vòng lặp.
//     if (parentId === childId) {
//         return true;
//     }

//     // 2. Kiểm tra xem Role con (childId) có đang là tổ tiên của Role cha (parentId) hay không.
//     // Tức là: Liệu parentId có thể kế thừa (trực tiếp hoặc gián tiếp) từ childId?

//     const childrenOfNewParent = new Set<string>(); // Các Role được kế thừa từ cha mới (parentId)

//     // Hàm đệ quy kiểm tra tất cả các con cháu của Role cha
//     async function traverseChildren(currentRole: string): Promise<void> {
//         const nextChildren = await prisma.roleInheritance.findMany({
//             where: { parentId: currentRole },
//             select: { childId: true },
//         });

//         for (const { childId: nextChildId } of nextChildren) {
//             if (childrenOfNewParent.has(nextChildId)) continue;

//             // Nếu phát hiện ra childId (vai trò con) đã là hậu duệ của parentId (vai trò cha)
//             if (nextChildId === childId) {
//                 throw new Error("Cycle Detected");
//             }

//             childrenOfNewParent.add(nextChildId);
//             await traverseChildren(nextChildId);
//         }
//     }

//     try {
//         // Bắt đầu duyệt từ vai trò cha mới (parentId)
//         await traverseChildren(parentId);
//         return false; // Không có vòng lặp
//     } catch (error) {
//         if (error.message === "Cycle Detected") {
//             return true; // Đã tìm thấy vòng lặp
//         }
//         throw error;
//     }
// }

// const isCycle = await createsCycle(newParentRole, newChildRole);

// if (isCycle) {
//     throw new Error(`Không thể tạo quan hệ kế thừa: ${newParentRole} đã kế thừa từ ${newChildRole} (vòng lặp).`);
// }

// // Nếu không có vòng lặp, tiến hành tạo:
// await prisma.roleInheritance.create({ data: { parentId: newParentRole, childId: newChildRole } });
