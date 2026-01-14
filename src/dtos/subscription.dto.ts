import { IsNotEmpty, IsString, IsNumber, Min } from "class-validator";

export class CreateSubscriptionDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNumber()
  @Min(1)
  duration!: number; // Số ngày

  @IsNotEmpty()
  @IsString()
  price!: string;

  @IsNumber()
  @Min(1)
  userLimit!: number;
}

export class RenewSubscriptionDto {
  @IsNumber()
  @Min(1)
  subscriptionId!: number;
}
