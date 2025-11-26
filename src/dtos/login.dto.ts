import { IsEmail, IsNotEmpty, Length } from "class-validator";

export class LoginDto {
  @IsEmail({}, { message: "Email phải có định dạng hợp lệ." })
  email!: string;

  @IsNotEmpty({ message: "Mật khẩu không được để trống." })
  @Length(3, 50, { message: "Mật khẩu phải dài từ 3 đến 50 ký tự." })
  password!: string;
}
