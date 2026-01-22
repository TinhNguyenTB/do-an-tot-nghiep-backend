import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
} from "class-validator";

export class SendOTPDto {
  @IsEmail({}, { message: "Email phải có định dạng hợp lệ." })
  email!: string;
}

export class RegisterUserDto {
  @IsOptional()
  otp?: string;

  @IsEmail({}, { message: "Email phải có định dạng hợp lệ." })
  email!: string;

  @IsNotEmpty({ message: "Mật khẩu không được để trống." })
  @Length(3, 50, { message: "Mật khẩu phải dài từ 3 đến 50 ký tự." })
  password!: string;

  @IsNotEmpty({ message: "Tên không được để trống." })
  @Length(2, 100, { message: "Tên phải dài từ 2 đến 100 ký tự." })
  name!: string;

  @IsString({ message: "Tên tổ chức phải là chuỗi." })
  organizationName!: string;

  @IsString({ message: "SDT tổ chức phải là chuỗi." })
  organizationPhoneNumber!: string;

  @IsNotEmpty({ message: "ID gói dịch vụ không được để trống." })
  subscriptionId!: number;
}

export class UpdateUserDto {
  @IsNotEmpty({ message: "Tên không được để trống." })
  @Length(2, 100, { message: "Tên phải dài từ 2 đến 100 ký tự." })
  name!: string;

  @IsArray()
  roles!: number[];

  @IsString()
  status!: string;
}

export class CreateUserDto {
  @IsNotEmpty({ message: "Tên không được để trống." })
  @Length(2, 100, { message: "Tên phải dài từ 2 đến 100 ký tự." })
  name!: string;

  @IsEmail({}, { message: "Email phải có định dạng hợp lệ." })
  email!: string;

  @IsOptional()
  @IsNumber()
  organizationId?: number;

  @IsArray()
  roles!: number[];
}
