import { IsEmail, IsNotEmpty, Length } from "class-validator";

export class ChangePasswordDto {
  @IsNotEmpty({ message: "Mật khẩu cũ không được để trống." })
  oldPassword!: string;
  @IsNotEmpty({ message: "Mật khẩu mới không được để trống." })
  newPassword!: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: "Email không hợp lệ" })
  email!: string;
}

export class ResetPasswordDto {
  @IsEmail({}, { message: "Email không hợp lệ" })
  email!: string;

  @IsNotEmpty({ message: "OTP không được để trống." })
  otp!: string;

  @IsNotEmpty({ message: "Mật khẩu mới không được để trống." })
  newPassword!: string;
}

export class UpdateProfileDto {
  @IsNotEmpty({ message: "Tên không được để trống." })
  @Length(2, 100, { message: "Tên phải dài từ 2 đến 100 ký tự." })
  name!: string;
}
