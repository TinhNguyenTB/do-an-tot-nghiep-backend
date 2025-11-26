import { HttpException } from "@/exceptions/http-exception";
import { RegisterUserDto } from "@/dtos/user.dto";
import prisma from "@/prismaClient";
import { StatusCodes } from "http-status-codes";
import * as bcrypt from "bcrypt";
import { UserStatus, PaymentType, PaymentStatus, Prisma } from "@prisma/client";
import { DEFAULT_PAGE, DEFAULT_SIZE } from "@/constants/pagination.constants";
import { stripe } from "@/configs/stripe.config";
import Stripe from "stripe";
import { ROLES } from "@/constants/role.constants";
import { LoginDto } from "@/dtos/login.dto";
import { generateToken } from "@/utils/jwtProvider";

/**
 * Thực hiện logic đăng ký: Tạo User và Payment PENDING
 */
export async function register(dto: RegisterUserDto) {
  // 1. Kiểm tra email tồn tại
  const existingUser = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existingUser) {
    throw new HttpException(StatusCodes.CONFLICT, "Email đã được sử dụng.");
  }

  // 2. Lấy thông tin gói dịch vụ
  const subscription = await prisma.subscription.findUnique({
    where: { id: dto.subscriptionId },
  });

  if (!subscription) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Gói dịch vụ không hợp lệ.");
  }

  // 3. Băm (Hash) mật khẩu
  const hashedPassword = await bcrypt.hash(dto.password, 10);

  let newOrganizationId: number | undefined = undefined;

  // Xử lý tạo tổ chức nếu có
  if (dto.organizationName) {
    const organization = await prisma.organization.create({
      data: { name: dto.organizationName },
    });
    newOrganizationId = organization.id;
  }

  const [newUser, newPayment] = await prisma.$transaction(async (tx) => {
    // BƯỚC 4A: Tạo User với trạng thái PENDING
    const user = await tx.user.create({
      data: {
        organizationId: newOrganizationId,
        email: dto.email,
        password: hashedPassword,
        name: dto.name || "Người dùng mới",
        status: UserStatus.PENDING,
        // ✨ Gán role mặc định cho user đăng ký mới
        roles: {
          create: {
            roleName: ROLES.CLIENT,
          },
        },
      },
    });

    // BƯỚC 4B: Tạo bản ghi Payment với userId đã có
    const payment = await tx.payment.create({
      data: {
        userId: user.id, // Liên kết ngay lập tức
        subscriptionId: subscription.id,
        amount: subscription.price,
        paymentType: PaymentType.REGISTER,
        status: PaymentStatus.PENDING,
        // transactionId sẽ được thêm sau khi cổng thanh toán phản hồi
      },
    });

    return [user, payment];
  });

  // 6. Chuẩn bị URL cho cổng thanh toán

  // create line_items
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: "vnd",
        product_data: {
          name: subscription.name,
        },
        unit_amount: Math.round(subscription.price.toNumber()),
      },
    },
  ];
  // create stripe_customer
  let stripe_customer = await prisma.stripeCustomer.findUnique({
    where: {
      customerId: newUser.id,
    },
    select: {
      stripeCustomerId: true,
    },
  });
  if (!stripe_customer) {
    const customer = await stripe.customers.create({
      email: newUser.email,
    });
    stripe_customer = await prisma.stripeCustomer.create({
      data: {
        customerId: newUser.id,
        stripeCustomerId: customer.id,
      },
    });
  }
  // create payment session
  const session = await stripe.checkout.sessions.create({
    customer: stripe_customer.stripeCustomerId,
    payment_method_types: ["card"],
    line_items: line_items,
    mode: "payment",
    success_url: `${process.env.CLIENT_URL}/login?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/register?canceled=true`,
    metadata: {
      paymentId: newPayment.id, // ID của bản ghi Payment PENDING
      userId: newUser.id, // ID của User PENDING
      subscriptionId: subscription.id,
    },
  });

  // 7. Trả về thông tin cần thiết
  return {
    userId: newUser.id,
    paymentId: newPayment.id,
    redirectUrl: session.url,
  };
}

export async function getAllUsers(queryParams: { [key: string]: any }) {
  // Trích xuất các tham số chính và bộ lọc
  const page = Number(queryParams.page) || DEFAULT_PAGE;
  const size = Number(queryParams.size) || DEFAULT_SIZE;

  // Tham số sắp xếp (ví dụ: 'name,asc' hoặc 'createdAt,desc')
  const sortParam: string | undefined = queryParams.sort;

  // 1. Tính toán SKIP (Offset)
  const skip = (page - 1) * size;

  // 2. Xây dựng điều kiện WHERE (Filters)
  const where: Prisma.UserWhereInput = {};

  // Các trường lọc hợp lệ của model User (Giả định: email, name, status)
  const validFilterFields = ["email", "name"];

  for (const key of validFilterFields) {
    const queryValue = queryParams[key];

    if (queryValue) {
      if (key === "name" || key === "email") {
        where[key] = {
          contains: queryValue,
        };
      }
    }
  }

  // 3. Xây dựng ORDER BY (Sorting)
  let orderBy: Prisma.UserOrderByWithRelationInput = { createdAt: "desc" }; // Mặc định sắp xếp theo ngày tạo

  if (sortParam) {
    const [field, direction] = sortParam.split(",");
    if (field && (direction === "asc" || direction === "desc")) {
      // Kiểm tra xem trường sắp xếp có hợp lệ không (cần thêm kiểm tra thực tế)
      orderBy = { [field]: direction };
    }
  }

  // 4. Sử dụng Transaction
  const [data, totalCount] = await prisma.$transaction([
    // Truy vấn DATA: Dùng prisma.user.findMany và áp dụng WHERE, ORDER BY
    prisma.user.findMany({
      skip: skip,
      take: size,
      where: where,
      orderBy: orderBy, // Áp dụng sắp xếp
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        organizationId: true,
        createdAt: true,
        // Lấy thêm Role
        roles: true,
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

function checkUserStatus(status: UserStatus) {
  if (status === UserStatus.ACTIVE) {
    // Nếu ACTIVE thì cho phép tiếp tục đăng nhập
    return;
  }
  // Xử lý các trạng thái không phải ACTIVE
  switch (status) {
    case UserStatus.PENDING:
      throw new HttpException(
        StatusCodes.FORBIDDEN,
        "Tài khoản chưa kích hoạt. Vui lòng hoàn tất thanh toán."
      );

    case UserStatus.SUSPENDED:
      throw new HttpException(
        StatusCodes.FORBIDDEN,
        "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ."
      );

    case UserStatus.EXPIRED:
      throw new HttpException(
        StatusCodes.FORBIDDEN,
        "Gói dịch vụ của bạn đã hết hạn. Vui lòng gia hạn để tiếp tục sử dụng."
      );

    default:
      throw new HttpException(StatusCodes.FORBIDDEN, "Tài khoản của bạn chưa được kích hoạt.");
  }
}

export async function handleLogin(dto: LoginDto) {
  // 1. Tìm kiếm User theo email
  const user = await prisma.user.findUnique({
    where: { email: dto.email },
    include: {
      roles: true,
      organization: true,
    },
  });

  // 2. Kiểm tra sự tồn tại của User
  if (!user) {
    throw new HttpException(StatusCodes.FORBIDDEN, "Email hoặc mật khẩu không chính xác.");
  }

  // 3. Kiểm tra Trạng thái tài khoản
  checkUserStatus(user.status);

  // 4. So sánh (Xác thực) mật khẩu
  const isPasswordMatch = await bcrypt.compare(dto.password, user.password);

  if (!isPasswordMatch) {
    throw new HttpException(StatusCodes.FORBIDDEN, "Email hoặc mật khẩu không chính xác.");
  }

  // 5. Trường hợp nhập đúng thông tin tài khoản, tạo token và trả về cho phía Client
  const roleNames = user.roles.map((r) => r.roleName);
  const userInfo = {
    id: user.id,
    email: user.email,
    roles: roleNames,
    organizationId: user.organizationId,
  };

  const accessToken = generateToken(userInfo, process.env.JWT_SECRET!, "10s");
  const refreshToken = generateToken(
    userInfo,
    process.env.REFRESH_TOKEN_SECRET!,
    "14 days"
    // 15
  );

  return {
    userInfo,
    accessToken,
    refreshToken,
  };
}
