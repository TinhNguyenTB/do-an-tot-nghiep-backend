import { IsEmail, IsNotEmpty, Length } from "class-validator";

export class CreateUserDto {
  @IsNotEmpty()
  @Length(3, 30)
  name!: string;

  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @Length(6, 20)
  password!: string;
}
