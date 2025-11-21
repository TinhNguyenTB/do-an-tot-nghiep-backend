import { IsNotEmpty, IsString, IsNumber, IsOptional, Min } from "class-validator";

export class CreateSubscriptionDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNumber()
  @Min(1)
  duration!: number; // Số ngày

  @IsNotEmpty()
  @IsNumber()
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  userLimit?: number; // Giới hạn số người dùng (NULL cho gói cá nhân)
}
