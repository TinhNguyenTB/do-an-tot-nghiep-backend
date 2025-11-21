import { IsEmail, IsNotEmpty, IsOptional, IsString, Length } from "class-validator";

export class RegisterUserDto {
  @IsEmail({}, { message: "Email phải có định dạng hợp lệ." })
  email!: string;

  @IsNotEmpty({ message: "Mật khẩu không được để trống." })
  @Length(6, 50, { message: "Mật khẩu phải dài từ 6 đến 50 ký tự." })
  password!: string;

  @IsNotEmpty({ message: "Tên không được để trống." })
  @Length(2, 100, { message: "Tên phải dài từ 2 đến 100 ký tự." })
  name!: string;

  @IsOptional()
  @IsString({ message: "Tên tổ chức phải là chuỗi." })
  organizationName?: string;

  @IsNotEmpty({ message: "ID gói dịch vụ không được để trống." })
  selectedSubscriptionId!: number;
}
