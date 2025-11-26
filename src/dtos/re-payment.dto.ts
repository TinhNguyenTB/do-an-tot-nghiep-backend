import { IsEmail, IsNotEmpty } from "class-validator";

export class RePaymentDto {
  @IsEmail({}, { message: "Email phải có định dạng hợp lệ." })
  email!: string;

  @IsNotEmpty({ message: "Mật khẩu không được để trống." })
  password!: string;
}
