import { stripe } from "@/configs/stripe.config";
import { CreateSubscriptionDto } from "@/dtos/subscription.dto";
import { HttpException } from "@/exceptions/http-exception";
import prisma from "@/prismaClient";
import { PaymentStatus, PaymentType, Prisma, SubscriptionStatus, UserStatus } from "@prisma/client";
import dayjs from "dayjs";
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

// --- READ ALL ---
export async function getAllSubscriptions(queryParams: { [key: string]: any }) {
  // Trích xuất các tham số chính và bộ lọc
  const page = Number(queryParams.page) || 1;
  const size = Number(queryParams.size) || 10;

  // 1. Tính toán SKIP (Offset)
  const skip = (page - 1) * size;

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
      orderBy: { createdAt: "desc" },
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

export async function handleRenewSubscription(userId: number, subscriptionId: number) {
  // 1. Kiểm tra User tồn tại và đang ACTIVE
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new HttpException(
      StatusCodes.FORBIDDEN,
      "Tài khoản không hợp lệ hoặc chưa được kích hoạt."
    );
  }

  // 2. Lấy thông tin gói dịch vụ muốn gia hạn (thường là gói đang dùng hoặc gói mới)
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Gói dịch vụ không tồn tại.");
  }

  // 3. Tạo bản ghi Payment PENDING
  const newPayment = await prisma.payment.create({
    data: {
      userId: user.id,
      subscriptionId: subscription.id,
      amount: subscription.price,
      paymentType: PaymentType.EXTEND, // Đánh dấu là gia hạn
      status: PaymentStatus.PENDING,
    },
  });

  // 4. Lấy hoặc tạo Stripe Customer
  let stripe_customer = await prisma.stripeCustomer.findUnique({
    where: { customerId: user.id },
  });

  if (!stripe_customer) {
    const customer = await stripe.customers.create({ email: user.email });
    stripe_customer = await prisma.stripeCustomer.create({
      data: { customerId: user.id, stripeCustomerId: customer.id },
    });
  }

  // 5. Tạo Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: stripe_customer.stripeCustomerId,
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "vnd",
          product_data: { name: `Gia hạn: ${subscription.name}` },
          unit_amount: Math.round(subscription.price.toNumber()),
        },
      },
    ],
    mode: "payment",
    success_url: `${process.env.CLIENT_URL}/current-subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/current-subscription?canceled=true`,
    metadata: {
      paymentId: newPayment.id,
      userId: user.id,
      subscriptionId: subscription.id,
      isRenewal: "true", // Đánh dấu để Webhook phân biệt với đăng ký mới
    },
  });

  return { redirectUrl: session.url };
}

export async function getMySubscription(userId: number) {
  // 1. Lấy thông tin User
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Người dùng không tồn tại.");
  }

  // 2. Tìm gói dịch vụ đang ACTIVE
  const currentSub = await prisma.userSubscription.findFirst({
    where: {
      userId: userId,
      status: SubscriptionStatus.ACTIVE,
    },
    include: {
      subscription: true, // Lấy thông tin tên gói, giá, giới hạn...
    },
    orderBy: {
      endDate: "desc", // Lấy gói có hạn xa nhất nếu có nhiều bản ghi
    },
  });

  if (!currentSub) {
    return null;
  }

  return currentSub;
}

export async function changeSubscription(userId: number, newSubId: number) {
  return await prisma.$transaction(async (tx) => {
    // 1. Lấy thông tin User (kèm balance), gói cũ và gói mới
    const user = await tx.user.findUnique({ where: { id: userId } });
    const currentSub = await tx.userSubscription.findFirst({
      where: { userId, status: "ACTIVE" },
      include: { subscription: true },
    });
    const newSub = await tx.subscription.findUnique({ where: { id: newSubId } });

    if (!newSub || !user) throw new HttpException(StatusCodes.BAD_REQUEST, "Dữ liệu không hợp lệ");

    // 2. Tính số tiền dư từ gói cũ (Pro-rata)
    let oldSubCredit = 0;
    if (currentSub) {
      const remainingDays = dayjs(currentSub.endDate).diff(dayjs(), "day");
      if (remainingDays > 0) {
        const pricePerDay =
          currentSub.subscription.price.toNumber() / currentSub.subscription.duration;
        oldSubCredit = Math.round(pricePerDay * remainingDays);
      }
    }

    // 3. Tổng "nguồn tiền" khách đang có = Tiền dư gói cũ + Tiền trong Balance
    const totalCredit = user.balance.toNumber() + oldSubCredit;
    const newSubPrice = newSub.price.toNumber();

    // Số tiền thực tế cần phải nạp thêm qua Stripe
    const amountToPay = newSubPrice - totalCredit;

    // --- TRƯỜNG HỢP 1: PHẢI THANH TOÁN THÊM ---
    if (amountToPay > 0) {
      const payment = await tx.payment.create({
        data: {
          userId,
          subscriptionId: newSub.id,
          amount: amountToPay,
          paymentType: PaymentType.CHANGE_PLAN,
          status: PaymentStatus.PENDING,
        },
      });

      // 4. Lấy hoặc tạo Stripe Customer
      let stripe_customer = await prisma.stripeCustomer.findUnique({
        where: { customerId: user.id },
      });

      if (!stripe_customer) {
        const customer = await stripe.customers.create({ email: user.email });
        stripe_customer = await prisma.stripeCustomer.create({
          data: { customerId: user.id, stripeCustomerId: customer.id },
        });
      }
      //@ts-ignore
      const session = await stripe.checkout.sessions.create({
        customer: stripe_customer.stripeCustomerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "vnd",
              product_data: {
                name: `Nâng cấp gói ${newSub.name}`,
                description: `Đã khấu trừ ${totalCredit.toLocaleString()}đ từ gói cũ và số dư tài khoản.`,
              },
              unit_amount: amountToPay,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          paymentId: payment.id,
          userId,
          subscriptionId: newSub.id,
          isChangePlan: "true",
          oldSubId: currentSub?.id?.toString(),
          useBalance: "true", // Đánh dấu để Webhook biết cần trừ hết balance về 0
        },
        success_url: `${process.env.CLIENT_URL}/current-subscription?success=true`,
        cancel_url: `${process.env.CLIENT_URL}/current-subscription?canceled=true`,
      });

      return { type: "PAYMENT_REQUIRED", url: session.url };
    }

    // --- TRƯỜNG HỢP 2: TỰ TRẢ BẰNG CREDIT/BALANCE (KHÔNG CẦN STRIPE) ---
    else {
      // Hủy gói cũ
      if (currentSub) {
        await tx.userSubscription.update({
          where: { id: currentSub.id },
          data: { status: "EXPIRED" },
        });
      }

      // Kích hoạt gói mới
      await tx.userSubscription.create({
        data: {
          userId,
          subscriptionId: newSub.id,
          startDate: new Date(),
          endDate: dayjs().add(newSub.duration, "day").toDate(),
          status: "ACTIVE",
        },
      });

      // Cập nhật lại số dư mới (Thừa bao nhiêu thì cộng vào balance, thiếu bao nhiêu trừ bấy nhiêu)
      // Vì amountToPay <= 0 nên Math.abs(amountToPay) chính là số dư còn lại sau khi mua gói
      await tx.user.update({
        where: { id: userId },
        data: { balance: Math.abs(amountToPay) },
      });

      return { type: "SUCCESS_INSTANT", message: "Đổi gói thành công bằng số dư tài khoản." };
    }
  });
}
