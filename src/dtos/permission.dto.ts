import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from "class-validator";

export class EndpointItemDto {
  @IsString({ message: "Phương thức HTTP phải là chuỗi." })
  @IsNotEmpty({ message: "Phương thức HTTP không được để trống." })
  @IsIn(["GET", "POST", "PUT", "PATCH", "DELETE"], {
    message: "Phương thức HTTP không hợp lệ (GET, POST, PUT, PATCH, DELETE).",
  })
  httpMethod!: string;

  @IsString({ message: "Đường dẫn endpoint phải là chuỗi." })
  @IsNotEmpty({ message: "Đường dẫn endpoint không được để trống." })
  @Length(1, 255, { message: "Đường dẫn endpoint không được vượt quá 255 ký tự." })
  endpoint!: string;
}

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

  @IsOptional()
  @IsArray({ message: "Danh sách endpoints phải là một mảng." })
  @ValidateNested({ each: true }) // Kiểm tra từng phần tử trong mảng
  @Type(() => EndpointItemDto) // Chuyển đổi kiểu dữ liệu để class-validator hoạt động
  endpoints?: EndpointItemDto[];
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

  @IsOptional()
  organizationId?: number;
  @IsOptional()
  createdAt?: string;
  @IsOptional()
  updatedAt?: string;

  @IsOptional()
  @IsArray({ message: "Danh sách endpoints phải là một mảng." })
  @ValidateNested({ each: true }) // Kiểm tra từng phần tử trong mảng
  @Type(() => EndpointItemDto) // Chuyển đổi kiểu dữ liệu để class-validator hoạt động
  endpoints?: EndpointItemDto[];
}
