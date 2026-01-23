import { IsEmail, IsIn, IsNotEmpty, IsString, Length } from "class-validator";

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

export class VerifyOTPDto {
  @IsString({ message: "OPT phải là chuỗi." })
  otp!: string;

  @IsEmail({}, { message: "Email phải có định dạng hợp lệ." })
  email!: string;
}

export class IntroSpectDto {
  @IsString({ message: "Phương thức HTTP phải là chuỗi." })
  @IsNotEmpty({ message: "Phương thức HTTP không được để trống." })
  @IsIn(["GET", "POST", "PUT", "PATCH", "DELETE"], {
    message: "Phương thức HTTP không hợp lệ (GET, POST, PUT, PATCH, DELETE).",
  })
  method!: string;

  @IsString({ message: "Đường dẫn endpoint phải là chuỗi." })
  @IsNotEmpty({ message: "Đường dẫn endpoint không được để trống." })
  @Length(1, 255, { message: "Đường dẫn endpoint không được vượt quá 255 ký tự." })
  endpoint!: string;
}
