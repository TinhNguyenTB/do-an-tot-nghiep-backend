import { CreateSubscriptionDto } from "@/dtos/subscription.dto";
import { HttpException } from "@/exceptions/http-exception";
import prisma from "@/prismaClient";
import { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

async function checkSubscriptionExists(id: number): Promise<boolean> {
  const count = await prisma.subscription.count({
    where: { id: id },
  });
  // Nếu count > 0, tức là tồn tại.
  return count > 0;
}

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

/**
 * Phân tích chuỗi sort thành đối tượng orderBy của Prisma.
 * Ví dụ: "name,asc" -> { name: 'asc' }
 */
function parseSort(
  sort: string | undefined
): Prisma.SubscriptionOrderByWithRelationInput | undefined {
  if (!sort) return undefined;

  const [field, direction] = sort.split(",");
  if (!field || !direction) return undefined;

  const orderBy = direction.toLowerCase() === "asc" ? "asc" : "desc";

  // Đảm bảo trường sắp xếp hợp lệ theo Model Subscription
  const validFields = ["id", "name", "duration", "price", "userLimit", "createdAt"];
  if (!validFields.includes(field)) {
    return undefined;
  }

  return { [field]: orderBy } as Prisma.SubscriptionOrderByWithRelationInput;
}

// --- READ ALL ---
export async function getAllSubscriptions(queryParams: { [key: string]: any }) {
  // Trích xuất các tham số chính và bộ lọc
  const page = Number(queryParams.page) || 1;
  const size = Number(queryParams.size) || 10;
  const sort = queryParams.sort as string | undefined;

  // 1. Tính toán SKIP (Offset)
  const skip = (page - 1) * size;

  // 2. Phân tích tham số sort
  const orderBy = parseSort(sort);

  // 3. Xây dựng điều kiện WHERE (Filters)
  const where: Prisma.SubscriptionWhereInput = {};
  const validFilterFields = ["name", "duration", "userLimit"];

  for (const key of validFilterFields) {
    if (queryParams[key]) {
      // Xử lý Lọc theo Tên (name)
      if (key === "name") {
        where.name = {
          contains: queryParams[key], // Tìm kiếm gần đúng
        };
        // Xử lý Lọc theo Số/Giá trị chính xác (duration, userLimit, price)
      } else if (key === "duration" || key === "userLimit") {
        // Đảm bảo giá trị là số trước khi dùng
        const numericValue = Number(queryParams[key]);
        if (!isNaN(numericValue)) {
          where[key] = numericValue;
        }
      }
    }
  }

  // 4. Sử dụng Transaction
  const [data, totalCount] = await prisma.$transaction([
    // Truy vấn DATA: Thêm WHERE
    prisma.subscription.findMany({
      skip: skip,
      take: size,
      orderBy: orderBy,
      where: where,
      select: {
        id: true,
        name: true,
        duration: true,
        price: true,
        userLimit: true,
        createdAt: true,
      },
    }),

    // Truy vấn TOTAL COUNT: Phải thêm WHERE để đếm đúng số bản ghi đã lọc
    prisma.subscription.count({
      where: where,
    }),
  ]);

  // ... (logic tính toán totalPages và trả về result)
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

// --- READ ONE ---
export async function getSubscriptionById(id: number) {
  const sub = await prisma.subscription.findUnique({
    where: { id: id },
  });
  if (!sub) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Gói dịch vụ không tìm thấy");
  }
  return sub;
}

// --- UPDATE ---
export async function updateSubscription(id: number, dto: Partial<CreateSubscriptionDto>) {
  const exists = await checkSubscriptionExists(id);
  if (!exists) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Gói dịch vụ không tìm thấy");
  }
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
  const exists = await checkSubscriptionExists(id);
  if (!exists) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Gói dịch vụ không tìm thấy");
  }

  try {
    // Nếu có khóa ngoại trỏ đến ID này, DELETE sẽ ném lỗi!
    return await prisma.subscription.delete({
      where: { id: id },
    });
  } catch (error) {
    // Xử lý lỗi khóa ngoại (Foreign Key Constraint)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new HttpException(StatusCodes.CONFLICT, "Không thể xóa gói dịch vụ đang được sử dụng");
    }
    throw error;
  }
}
