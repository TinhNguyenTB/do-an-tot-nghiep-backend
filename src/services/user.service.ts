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
import { uploadImageToCloudinary } from "@/utils/uploadImageToCloudinary";
import { ChangePasswordDto } from "@/dtos/auth.dto";

export async function createUser(dto: CreateUserDto, defaultPassword: string) {
  // 1. Kiểm tra email duy nhất
  const existingUser = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existingUser) {
    throw new HttpException(StatusCodes.CONFLICT, "Email đã được sử dụng.");
  }

  // 2. Chạy Transaction để đảm bảo tính toàn vẹn dữ liệu
  return prisma.$transaction(async (tx) => {
    // --- PHẦN 1: KIỂM TRA GIỚI HẠN GÓI DỊCH VỤ (Nếu có Org) ---
    if (dto.organizationId) {
      const organization = await tx.organization.findUnique({
        where: { id: dto.organizationId },
        include: {
          owner: {
            include: {
              userSubscriptions: {
                where: { status: "ACTIVE" },
                include: { subscription: true },
                orderBy: { endDate: "desc" },
                take: 1,
              },
            },
          },
        },
      });

      if (!organization) {
        throw new HttpException(StatusCodes.NOT_FOUND, "Tổ chức không tìm thấy.");
      }

      // Kiểm tra gói dịch vụ của chủ sở hữu
      const activeSub = organization.owner.userSubscriptions[0];
      if (!activeSub) {
        throw new HttpException(
          StatusCodes.PAYMENT_REQUIRED,
          "Tổ chức không có gói dịch vụ hoạt động."
        );
      }

      const userLimit = activeSub.subscription.userLimit;
      if (userLimit !== null) {
        const currentUsersCount = await tx.user.count({
          where: { organizationId: dto.organizationId },
        });

        if (currentUsersCount >= userLimit) {
          throw new HttpException(
            StatusCodes.FORBIDDEN,
            `Đã đạt giới hạn tối đa ${userLimit} người dùng của gói ${activeSub.subscription.name}.`
          );
        }
      }
    }

    // --- PHẦN 2: XỬ LÝ VAI TRÒ (Dùng roleId - Int) ---
    if (!dto.roles || dto.roles.length === 0) {
      throw new HttpException(StatusCodes.BAD_REQUEST, "Phải gán ít nhất một vai trò.");
    }

    // dto.roles bây giờ là mảng các ID (number[])
    const roles = await tx.role.findMany({
      where: {
        id: { in: dto.roles },
      },
    });

    if (roles.length !== dto.roles.length) {
      throw new HttpException(StatusCodes.BAD_REQUEST, "Một hoặc nhiều vai trò không tồn tại.");
    }

    // 3. Băm mật khẩu
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // 4. Tạo User và liên kết Roles
    const user = await tx.user.create({
      data: {
        organizationId: dto.organizationId || null,
        email: dto.email,
        password: hashedPassword,
        name: dto.name || "Người dùng mới",
        status: UserStatus.ACTIVE,
        roles: {
          create: roles.map((r) => ({
            roleId: r.id,
          })),
        },
      },
    });

    return {
      userId: user.id,
      email: user.email,
      roles: roles.map((r) => r.name),
    };
  });
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

  const isOrgRegister = !!dto.organizationName;

  // Bắt đầu Transaction
  const [newUser, newPayment] = await prisma.$transaction(async (tx) => {
    // BƯỚC 1: Tạo User cơ bản
    const user = await tx.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        status: UserStatus.PENDING,
      },
    });

    let finalRoleId: number;

    if (isOrgRegister) {
      // BƯỚC 2: Tạo Organization
      const newOrg = await tx.organization.create({
        data: {
          name: dto.organizationName!,
          ownerId: user.id,
        },
      });

      // BƯỚC 3: Tạo các Permission mặc định cho Org này
      const defaultPermNames = [
        "read_users",
        "read_roles",
        "read_permissions",
        "read_payment_history",
      ];

      // Sử dụng Promise.all để tạo từng permission và lấy về danh sách object kèm ID
      const createdPermissions = await Promise.all(
        defaultPermNames.map((name) =>
          tx.permission.create({
            data: {
              name,
              organizationId: newOrg.id,
              description: `Quyền mặc định ${name} cho tổ chức`,
            },
          })
        )
      );

      // BƯỚC 4: Tạo Role ORG_ADMIN cho Org này
      const orgAdminRole = await tx.role.create({
        data: {
          name: ROLES.ORG_ADMIN, // 'org_admin'
          organizationId: newOrg.id,
          description: "Quản trị viên cấp cao của tổ chức",
        },
      });

      // BƯỚC 5: Gán các Permission vừa tạo vào Role ORG_ADMIN
      await tx.rolePermission.createMany({
        data: createdPermissions.map((p) => ({
          roleId: orgAdminRole.id,
          permissionId: p.id,
        })),
      });

      // BƯỚC 6: Cập nhật organizationId cho User
      await tx.user.update({
        where: { id: user.id },
        data: { organizationId: newOrg.id },
      });

      finalRoleId = orgAdminRole.id;
    } else {
      // Nếu là khách lẻ (Client) - Lấy role Global từ hệ thống (đã có trong seed)
      const clientRole = await tx.role.findFirst({
        where: { name: ROLES.CLIENT, organizationId: null },
      });
      if (!clientRole) throw new Error("Global Client Role not found");
      finalRoleId = clientRole.id;
    }

    // BƯỚC 7: Gán Role cuối cùng cho User (Dù là Org Admin hay Client)
    await tx.userRole.create({
      data: {
        userId: user.id,
        roleId: finalRoleId,
      },
    });

    // BƯỚC 8: Tạo PAYMENT
    const payment = await tx.payment.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        amount: subscription.price,
        paymentType: PaymentType.REGISTER,
        status: PaymentStatus.PENDING,
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

export async function getAllUsers(
  queryParams: { [key: string]: any },
  organizationId: number | null
) {
  const page = Number(queryParams.page) || DEFAULT_PAGE;
  const size = Number(queryParams.size) || DEFAULT_SIZE;

  // 1. Tính toán SKIP (Offset)
  const skip = (page - 1) * size;

  // 2. Xây dựng điều kiện WHERE (Filters)
  // Sử dụng Prisma.UserWhereInput để đảm bảo kiểu dữ liệu chính xác
  const where: Prisma.UserWhereInput = {};

  // Các trường lọc hợp lệ của model User
  // Thêm lọc theo Organization ID nếu cần thiết
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
  if (organizationId) {
    where.organizationId = organizationId;
  }

  // 3. Xây dựng ORDER BY (Sorting)
  let orderBy: Prisma.UserOrderByWithRelationInput = { createdAt: "desc" }; // Mặc định sắp xếp theo ngày tạo
  // (Bạn có thể bổ sung logic sắp xếp ở đây nếu cần)

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
        updatedAt: true,
        // CẬP NHẬT SELECT ROLE: Phải JOIN lồng nhau để lấy TÊN VAI TRÒ
        roles: {
          select: {
            role: {
              // Đi qua quan hệ 'role' trong UserRole
              select: {
                name: true, // Lấy tên (name) của vai trò
              },
            },
          },
        },
      },
    }),

    prisma.user.count({
      where: where,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / size);

  // 5. Ánh xạ kết quả
  const content = data.map((user) => {
    // Tách roles và organization ra khỏi đối tượng user
    const { roles, organization, ...rest } = user;

    // CẬP NHẬT ÁNH XẠ ROLE: Lấy tên vai trò từ cấu trúc mới
    const roleNames = roles.map((userRole) => userRole.role.name);

    // Lấy thông tin tổ chức
    const organizationName = organization?.name || null;
    const organizationId = organization?.id || null;

    return {
      ...rest,
      roles: roleNames,
      organizationId: organizationId,
      organizationName: organizationName,
    };
  });

  // 6. Trả về kết quả phân trang
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
      roles: {
        include: {
          role: true,
        },
      },
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
  const roleNames = user.roles.map((userRole) => userRole.role.name);
  const permissions = await getUserPermissions(user.id);
  const userInfo = {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: roleNames,
    avatar: user.avatar,
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
  // 1. Tìm kiếm User theo ID
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
          role: {
            // Đi qua quan hệ 'role' trong UserRole
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  // 2. Kiểm tra sự tồn tại của User
  if (!user) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Người dùng không tìm thấy");
  }

  // 3. Xử lý và trả về dữ liệu
  const roles = user.roles.map((userRole) => userRole.role.id);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    organizationId: user.organizationId,
    roles: roles,
  };
}

export async function updateUser(id: number, dto: Partial<UpdateUserDto>) {
  const exists = await checkUserExists(id);
  if (!exists) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Người dùng không tìm thấy");
  }

  // Khởi tạo mảng Role ID cần gán
  let roleIdsToAssign: number[] | undefined;

  // 1. Validate roles nếu truyền vào (CẦN LẤY ID)
  if (dto.roles && dto.roles.length > 0) {
    // Tìm kiếm các Role dựa trên ID
    const roles = await prisma.role.findMany({
      where: { id: { in: dto.roles } },
      select: { id: true, name: true }, // Lấy cả ID và NAME
    });

    const validRolesCount = roles.length;

    if (validRolesCount !== dto.roles.length) {
      // Xác định tên vai trò không hợp lệ để thông báo chi tiết hơn
      const foundNames = roles.map((r) => r.id);
      const invalidRoles = dto.roles.filter((id) => !foundNames.includes(id));

      throw new HttpException(
        StatusCodes.BAD_REQUEST,
        `Một hoặc nhiều role không hợp lệ: ${invalidRoles.join(", ")}`
      );
    }

    // Lưu lại danh sách ID của các vai trò hợp lệ
    roleIdsToAssign = roles.map((r) => r.id);
  }

  return prisma.$transaction(async (tx) => {
    // ---- UPDATE USER NAME (và các trường khác nếu có) ----
    // Chỉ cập nhật name nếu nó được truyền vào DTO
    const updateData: any = {};
    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }
    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }

    if (Object.keys(updateData).length > 0) {
      await tx.user.update({
        where: { id },
        data: updateData,
      });
    }

    // ---- UPDATE USER ROLES (Sử dụng Role ID) ----
    if (roleIdsToAssign) {
      // 1. Xóa tất cả UserRole cũ của người dùng này
      await tx.userRole.deleteMany({ where: { userId: id } });

      // 2. Tạo các UserRole mới bằng Role ID
      await tx.userRole.createMany({
        data: roleIdsToAssign.map((roleId) => ({
          userId: id,
          roleId: roleId, // Sử dụng Role ID
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
        // Cập nhật select để lấy TÊN VAI TRÒ từ bảng Role
        roles: {
          select: {
            role: {
              select: {
                name: true, // Lấy tên vai trò
              },
            },
          },
        },
      },
    });

    // Hàm này đảm bảo userWithRoles không phải null vì đã check ở đầu hàm
    if (!userWithRoles) {
      throw new HttpException(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Không thể lấy thông tin người dùng sau khi cập nhật."
      );
    }

    // Ánh xạ để trả về mảng tên vai trò
    const roleNames = userWithRoles.roles.map((userRole) => userRole.role.name);

    return {
      id: userWithRoles.id,
      name: userWithRoles.name,
      email: userWithRoles.email,
      status: userWithRoles.status,
      createdAt: userWithRoles.createdAt,
      organizationId: userWithRoles.organizationId,
      roles: roleNames,
    };
  });
}

export async function handleChangePassword(userId: number, dto: ChangePasswordDto) {
  // 1. Tìm user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      password: true,
      status: true,
    },
  });

  if (!user) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Người dùng không tồn tại");
  }

  // (Optional) chỉ cho ACTIVE đổi mật khẩu
  if (user.status !== UserStatus.ACTIVE) {
    throw new HttpException(StatusCodes.FORBIDDEN, "Tài khoản chưa được kích hoạt");
  }

  // 2. Kiểm tra mật khẩu cũ
  const isMatch = await bcrypt.compare(dto.oldPassword, user.password);

  if (!isMatch) {
    throw new HttpException(StatusCodes.BAD_REQUEST, "Mật khẩu cũ không đúng");
  }

  // 3. Không cho đặt mật khẩu mới trùng mật khẩu cũ
  const isSamePassword = await bcrypt.compare(dto.newPassword, user.password);
  if (isSamePassword) {
    throw new HttpException(StatusCodes.BAD_REQUEST, "Mật khẩu mới không được trùng mật khẩu cũ");
  }

  // 4. Hash mật khẩu mới
  const hashedNewPassword = await bcrypt.hash(dto.newPassword, 10);

  // 5. Update password
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedNewPassword,
    },
  });

  return {
    userId: user.id,
  };
}

export async function uploadUserAvatar(userId: number, file: Express.Multer.File) {
  if (!file) {
    throw new HttpException(StatusCodes.BAD_REQUEST, "File avatar không tồn tại");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpException(StatusCodes.NOT_FOUND, "User không tồn tại");
  }

  const { url, publicId } = await uploadImageToCloudinary(file.buffer, userId);

  await prisma.user.update({
    where: { id: userId },
    data: {
      avatar: url,
      publicId,
    },
  });

  return {
    avatar: url,
  };
}

export async function getUserProfile(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      avatar: true,
      createdAt: true,
      balance: true,

      organization: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },

      roles: {
        select: {
          role: {
            select: {
              name: true,
              description: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Người dùng không tồn tại");
  }

  return {
    ...user,
    roles: user.roles.map((r) => r.role.name),
  };
}

export async function deleteUser(targetUserId: number, requestUser: any) {
  // 1. Tìm user cần xóa
  const userToDelete = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!userToDelete) {
    throw new HttpException(StatusCodes.NOT_FOUND, "Người dùng không tồn tại.");
  }

  // 2. Kiểm tra quyền (Security Check)
  // - Super Admin: Xóa được mọi người
  // - Org Admin: Chỉ xóa được người trong cùng Organization
  const isSuperAdmin = requestUser.roles.includes(ROLES.SUPER_ADMIN);
  const isSameOrg = userToDelete.organizationId === requestUser.organizationId;

  if (!isSuperAdmin && !isSameOrg) {
    throw new HttpException(StatusCodes.FORBIDDEN, "Bạn không có quyền xóa người dùng này.");
  }

  // Không cho phép tự xóa chính mình qua API này (nên có API riêng hoặc logic khác)
  if (targetUserId === requestUser.id) {
    throw new HttpException(StatusCodes.BAD_REQUEST, "Bạn không thể tự xóa chính mình.");
  }

  // 3. Thực hiện xóa trong Transaction
  return await prisma.$transaction(async (tx) => {
    // Xóa các dữ liệu phụ thuộc trước (theo schema của bạn)
    await tx.userRole.deleteMany({ where: { userId: targetUserId } });
    await tx.passwordResetToken.deleteMany({ where: { userId: targetUserId } });
    await tx.userSubscription.deleteMany({ where: { userId: targetUserId } });
    await tx.payment.deleteMany({ where: { userId: targetUserId } });

    // Nếu User này là Owner của một Organization, cần xử lý Org đó (ví dụ: báo lỗi hoặc chuyển owner)
    const ownedOrg = await tx.organization.findFirst({ where: { ownerId: targetUserId } });
    if (ownedOrg) {
      throw new HttpException(
        StatusCodes.BAD_REQUEST,
        "Không thể xóa vì người dùng này là chủ sở hữu của tổ chức. Hãy chuyển quyền chủ sở hữu trước."
      );
    }

    // Cuối cùng xóa User
    await tx.user.delete({
      where: { id: targetUserId },
    });
  });
}
