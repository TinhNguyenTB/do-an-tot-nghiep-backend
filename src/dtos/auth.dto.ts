import { IsEmail, IsNotEmpty } from "class-validator";

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
