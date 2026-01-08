import { IsInt, IsNotEmpty, IsOptional, IsString, Length } from "class-validator";

export class CreatePermissionDto {
  @IsString({ message: "Tên permission phải là chuỗi." })
  @IsNotEmpty({ message: "Tên permission không được để trống." })
  @Length(2, 100, {
    message: "Tên permission phải dài từ 2 đến 100 ký tự.",
  })
  name!: string;

  @IsOptional()
  @IsString({ message: "Mô tả permission phải là chuỗi." })
  @Length(0, 255, {
    message: "Mô tả permission không được vượt quá 255 ký tự.",
  })
  description?: string;

  @IsOptional()
  @IsInt({ message: "organizationId phải là number." })
  organizationId?: number;
}

export class UpdatePermissionDto {
  @IsOptional()
  @IsString({ message: "Tên permission phải là chuỗi." })
  @IsNotEmpty({ message: "Tên permission không được để trống." })
  @Length(2, 100, {
    message: "Tên permission phải dài từ 2 đến 100 ký tự.",
  })
  name?: string;

  @IsOptional()
  @IsString({ message: "Mô tả permission phải là chuỗi." })
  @Length(0, 255, {
    message: "Mô tả permission không được vượt quá 255 ký tự.",
  })
  description?: string;
}
