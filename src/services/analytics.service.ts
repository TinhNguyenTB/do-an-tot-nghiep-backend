import prisma from "@/prismaClient";
import { PaymentStatus, Prisma } from "@prisma/client";

interface RevenueStats {
  month: number;
  totalRevenue: number;
  // Có thể thêm tổng số lượng giao dịch, doanh thu theo loại, v.v.
}

/**
 * Thống kê tổng doanh thu theo từng tháng trong một năm cụ thể.
 * @param year Năm cần thống kê (mặc định là năm hiện tại).
 * @returns Mảng thống kê doanh thu theo tháng.
 */
export async function getMonthlyRevenueStatistics(
  year: number = new Date().getFullYear()
): Promise<RevenueStats[]> {
  // PHƯƠNG PHÁP $queryRaw (Được khuyến nghị cho thống kê phức tạp)

  const rawResults: { month: number; total: number }[] = await prisma.$queryRaw(
    Prisma.sql`
      SELECT 
        MONTH(payment_date) as month,
        CAST(SUM(amount) AS DECIMAL(12, 2)) as total
      FROM 
        payment
      WHERE 
        status = ${PaymentStatus.SUCCESS} 
        AND YEAR(payment_date) = ${year}
      GROUP BY 
        month
      ORDER BY 
        month ASC
    `
  );

  //  Xử lý và định dạng kết quả
  // Khởi tạo 12 tháng với doanh thu = 0
  const monthlyDataMap = new Map<number, number>();
  for (let i = 1; i <= 12; i++) {
    monthlyDataMap.set(i, 0);
  }

  // Cập nhật doanh thu từ kết quả truy vấn
  rawResults.forEach((row) => {
    // Giá trị 'total' từ $queryRaw có thể là kiểu Decimal của thư viện DB,
    // cần chuyển sang Number.
    const totalAmount = typeof row.total === "number" ? row.total : Number(row.total);
    monthlyDataMap.set(row.month, totalAmount);
  });

  // Định dạng lại thành mảng theo thứ tự
  const finalResults: RevenueStats[] = Array.from(monthlyDataMap.entries()).map(
    ([month, total]) => ({
      month,
      totalRevenue: total,
    })
  );

  return finalResults;
}

export async function getSystemCounts() {
  // Sử dụng prisma.$transaction để thực hiện nhiều truy vấn count song song.
  const [totalUsers, totalOrganizations, totalSubscriptions, totalPayments] =
    await prisma.$transaction([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.subscription.count(),
      prisma.payment.count(),
    ]);

  return {
    totalUsers,
    totalOrganizations,
    totalSubscriptions,
    totalPayments,
  };
}

export async function getOrganizationStatistics(organizationId: number) {
  const [totalUsers, totalRoles, totalPermissions] = await prisma.$transaction([
    prisma.user.count({
      where: {
        organizationId,
      },
    }),

    prisma.role.count({
      where: {
        organizationId,
      },
    }),

    prisma.permission.count({
      where: {
        organizationId,
      },
    }),
  ]);

  return {
    totalUsers,
    totalRoles,
    totalPermissions,
  };
}
