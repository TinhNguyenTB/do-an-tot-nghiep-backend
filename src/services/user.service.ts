import { HttpException } from "@/exceptions/http-exception";
import { CreateUserDto, RegisterUserDto, UpdateUserDto } from "@/dtos/user.dto";
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
import { RePaymentDto } from "@/dtos/re-payment.dto";
import { getUserPermissions } from "@/utils/rbacUtils";

export async function createUser(dto: CreateUserDto, defaultPassword: string) {
  const existingUser = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existingUser) {
    throw new HttpException(StatusCodes.CONFLICT, "Email đã được sử dụng.");
  }

  if (dto.organizationId) {
    const organization = await prisma.organization.findUnique({
      where: { id: dto.organizationId },
    });
    if (!organization) {
      throw new HttpException(StatusCodes.NOT_FOUND, "Tổ chức không tìm thấy");
    }
  }
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);
  const user = await prisma.user.create({
    data: {
      organizationId: dto.organizationId,
      email: dto.email,
      password: hashedPassword,
      name: dto.name || "Người dùng mới",
      status: UserStatus.ACTIVE,
      roles: {
        create: dto.roles.map((roleName) => ({
          // Với mỗi tên vai trò trong mảng, tạo một bản ghi UserRole mới.
          roleName: roleName,
          // userId sẽ tự động được Prisma điền vào.
        })),
      },
    },
  });
  return {
    userId: user.id,
    email: user.email,
  };
}

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

  const [newUser, newPayment] = await prisma.$transaction(async (tx) => {
    // BƯỚC 4A: Tạo User với trạng thái PENDING
    const user = await tx.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        status: UserStatus.PENDING,
        // ✨ Gán role mặc định cho user đăng ký mới
        roles: {
          create: {
            roleName: ROLES.CLIENT,
          },
        },
      },
    });

    // --- 2. Nếu đăng ký tổ chức → tạo ORGANIZATION + gán OWNER ---
    if (dto.organizationName) {
      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName,
          ownerId: user.id, // ✅ USER LÀ OWNER
        },
      });

      // --- 3. Gán user vào organization ---
      await tx.user.update({
        where: { id: user.id },
        data: {
          organizationId: organization.id,
        },
      });
    }

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

export async function recreatePaymentSession(dto: RePaymentDto) {
  // 1. TÌM USER
  const user = await prisma.user.findUnique({
    where: { email: dto.email },
    select: {
      id: true,
      email: true,
      status: true,
      password: true,
    },
  });

  // 2. Kiểm tra sự tồn tại của User
  if (!user) {
    throw new HttpException(StatusCodes.FORBIDDEN, "Email hoặc mật khẩu không chính xác.");
  }

  // 4. So sánh (Xác thực) mật khẩu
  const isPasswordMatch = await bcrypt.compare(dto.password, user.password);

  if (!isPasswordMatch) {
    throw new HttpException(StatusCodes.FORBIDDEN, "Email hoặc mật khẩu không chính xác.");
  }

  // Kiểm tra nhanh trạng thái có còn là PENDING không
  if (user.status !== "PENDING") {
    throw new HttpException(
      StatusCodes.BAD_REQUEST,
      "Tài khoản không ở trạng thái chờ thanh toán."
    );
  }

  // 5. Tìm bản ghi Payment PENDING gần nhất
  const pendingPayment = await prisma.payment.findFirst({
    where: { userId: user.id, status: "PENDING" },
    include: { subscription: true },
  });

  if (!pendingPayment || !pendingPayment.subscription) {
    throw new HttpException(
      StatusCodes.BAD_REQUEST,
      "Không tìm thấy giao dịch thanh toán đang chờ xử lý."
    );
  }

  const subscription = pendingPayment.subscription;

  // 6. Chuẩn bị dữ liệu cho Stripe Session (Logic giữ nguyên)
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: "vnd",
        product_data: {
          name: subscription.name,
        },
        unit_amount: Math.round(pendingPayment.amount.toNumber()),
      },
    },
  ];

  // 7. Đảm bảo Customer ID của Stripe tồn tại
  let stripe_customer = await prisma.stripeCustomer.findUnique({
    where: { customerId: user.id },
    select: { stripeCustomerId: true },
  });

  if (!stripe_customer) {
    // Tạo Customer ID mới nếu chưa có
    const customer = await stripe.customers.create({ email: user.email });
    stripe_customer = await prisma.stripeCustomer.create({
      data: { customerId: user.id, stripeCustomerId: customer.id },
    });
  }

  // 8. Tạo phiên thanh toán mới (Logic giữ nguyên)
  const session = await stripe.checkout.sessions.create({
    customer: stripe_customer.stripeCustomerId,
    payment_method_types: ["card"],
    line_items: line_items,
    mode: "payment",
    success_url: `${process.env.CLIENT_URL}/login?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/login?payment_canceled=true`,
    metadata: {
      paymentId: pendingPayment.id,
      userId: user.id,
      subscriptionId: subscription.id,
    },
  });

  // Trả về URL chuyển hướng
  return {
    userId: user.id,
    paymentId: pendingPayment.id,
    redirectUrl: session.url, // URL Stripe Checkout mới
  };
}

export async function getAllUsers(queryParams: { [key: string]: any }) {
  const page = Number(queryParams.page) || DEFAULT_PAGE;
  const size = Number(queryParams.size) || DEFAULT_SIZE;

  // 1. Tính toán SKIP (Offset)
  const skip = (page - 1) * size;

  // 2. Xây dựng điều kiện WHERE (Filters)
  const where: Prisma.UserWhereInput = {};

  // Các trường lọc hợp lệ của model User
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
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
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
  const content = data.map((user) => {
    const { roles, organization, ...rest } = user;

    const roleNames = roles.map((r) => r.roleName);
    const organizationName = organization?.name || null;
    const organizationId = organization?.id || null;

    return {
      ...rest,
      roles: roleNames,
      organizationId: organizationId,
      organizationName: organizationName,
    };
  });

  return {
    content,
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
  const permissions = await getUserPermissions(user.id);
  const userInfo = {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: roleNames,
    permissions,
    organizationId: user.organizationId,
  };

  const accessToken = generateToken(userInfo, process.env.JWT_SECRET!, "1d");
  const refreshToken = generateToken(userInfo, process.env.REFRESH_TOKEN_SECRET!, "14d");

  return {
    userInfo,
    accessToken,
    refreshToken,
  };
}

async function checkUserExists(id: number): Promise<boolean> {
  const count = await prisma.user.count({
    where: { id: id },
  });
  // Nếu count > 0, tức là tồn tại.
  return count > 0;
}

export async function getUserById(id: number) {
  const user = await prisma.user.findUnique({
    where: { id: id },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      organizationId: true,
      roles: {
        select: {
          roleName: true,
        },
      },
    },
  });
  if (!user) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Người dùng không tìm thấy");
  }
  return {
    ...user,
    roles: user?.roles.map((r) => r.roleName) ?? [],
  };
}

export async function updateUser(id: number, dto: Partial<UpdateUserDto>) {
  const exists = await checkUserExists(id);
  if (!exists) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Người dùng không tìm thấy");
  }

  // Validate roles nếu truyền vào
  if (dto.roles && dto.roles.length > 0) {
    const roles = await prisma.role.findMany({
      where: { name: { in: dto.roles } },
      select: { name: true },
    });

    const validRoles = roles.map((r) => r.name);

    if (validRoles.length !== dto.roles.length) {
      throw new HttpException(StatusCodes.BAD_REQUEST, "Một hoặc nhiều role không hợp lệ");
    }
  }

  return prisma.$transaction(async (tx) => {
    // ---- UPDATE USER NAME ----
    await tx.user.update({
      where: { id },
      data: { name: dto.name },
    });

    // ---- UPDATE USER ROLES ----
    if (dto.roles) {
      await tx.userRole.deleteMany({ where: { userId: id } });

      await tx.userRole.createMany({
        data: dto.roles.map((roleName) => ({
          userId: id,
          roleName,
        })),
        skipDuplicates: true,
      });
    }

    // ---- RETURN USER + ROLE NAMES ----
    const userWithRoles = await tx.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        organizationId: true,
        roles: {
          select: {
            roleName: true,
          },
        },
      },
    });

    return {
      ...userWithRoles,
      roles: userWithRoles?.roles.map((r) => r.roleName) ?? [],
    };
  });
}
