import { UpdateOrganizationDto } from "@/dtos/organization.dto";
import { HttpException } from "@/exceptions/http-exception";
import prisma from "@/prismaClient";
import { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

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
        phoneNumber: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
        owner: {
          select: {
            userSubscriptions: {
              where: { status: "ACTIVE" },
              take: 1,
              select: {
                subscription: {
                  select: { name: true },
                },
              },
            },
          },
        },
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

  const formattedData = data.map((org) => ({
    id: org.id,
    name: org.name,
    phoneNumber: org.phoneNumber,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
    userCount: org._count.users,
    isActive: org.isActive,
    // Lấy tên gói từ mảng lồng nhau của Owner
    subscriptionName: org.owner?.userSubscriptions[0]?.subscription?.name || "N/A",
  }));

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

export async function updateOrganization(orgId: number, dto: UpdateOrganizationDto) {
  const { name, phoneNumber } = dto;

  // 1. Kiểm tra tổ chức có tồn tại không
  const existingOrg = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!existingOrg) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Tổ chức không tồn tại.");
  }

  // 2. Cập nhật dữ liệu
  const updatedOrg = await prisma.organization.update({
    where: { id: orgId },
    data: {
      ...(name && { name }),
      ...(phoneNumber && { phoneNumber }),
    },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      updatedAt: true,
    },
  });

  return updatedOrg;
}

export const updateOrgStatus = async (id: number, isActive: boolean) => {
  // 1. Kiểm tra tổ chức có tồn tại không
  const organization = await prisma.organization.findUnique({
    where: { id: Number(id) },
  });

  if (!organization) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Không tìm thấy tổ chức");
  }

  // 2. Cập nhật trạng thái
  const updatedOrg = await prisma.organization.update({
    where: { id: id },
    data: { isActive },
  });
  return {
    isActive: updatedOrg.isActive,
  };
  // 3. Log hành động (Nếu bạn đã làm Audit Log)
  // await createAuditLog(req.user.id, `UPDATE_ORG_STATUS_${isActive}`, id);

  // return res.status(StatusCodes.OK).json({
  //   message: isActive ? "Đã mở khóa tổ chức" : "Đã khóa tổ chức thành công",
  //   data: updatedOrg
  // });
};
