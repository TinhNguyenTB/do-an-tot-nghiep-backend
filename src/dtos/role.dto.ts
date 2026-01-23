import { Type } from "class-transformer";
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ArrayNotEmpty,
  ArrayUnique,
  ValidateNested,
  IsPositive,
  IsInt,
  IsNumber,
  IsDefined,
} from "class-validator";

class PermissionDto {
  @IsDefined({ message: "ID quyền không được để trống." })
  @IsInt({ message: "ID quyền phải là số nguyên." })
  @IsPositive({ message: "ID quyền phải là số dương." })
  id!: number;

  @IsString()
  @IsNotEmpty({ message: "Tên quyền không được để trống." })
  name!: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  updatedAt?: string;

  @IsOptional()
  createdAt?: string;

  @IsOptional()
  organizationId?: number | null;
}

// --- Cấu trúc cho Role ---
export class CreateRoleDto {
  @IsString()
  @IsNotEmpty({ message: "Tên không được để trống." })
  @Length(2, 100, { message: "Tên phải dài từ 2 đến 100 ký tự." })
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 255, { message: "Mô tả không được vượt quá 255 ký tự." })
  description?: string;

  // ✅ Organization ID (INT | NULL)
  // Trường này là cần thiết để xác định phạm vi của vai trò mới (Global hay Org-scoped)
  @IsOptional()
  @IsNumber({}, { message: "Organization ID phải là số." })
  @IsInt({ message: "Organization ID phải là số nguyên." })
  @IsPositive({ message: "Organization ID phải là số dương." })
  organizationId?: number; // Cho phép là undefined, nếu là null thì không cần IsPositive

  // ✅ Role kế thừa (ROLE ID MỚI: NUMBER[])
  @IsOptional()
  @IsArray({ message: "inheritsFrom phải là mảng." })
  @ArrayNotEmpty({ message: "inheritsFrom không được rỗng." })
  @ArrayUnique({ message: "inheritsFrom không được trùng role." })
  @IsInt({ each: true, message: "ID vai trò cha phải là số nguyên." })
  @IsPositive({ each: true, message: "ID vai trò cha phải là số dương." })
  inheritsFrom?: number[];

  // ✅ Permissions (Mảng OBJECT chứa ID và NAME)
  @IsOptional()
  @IsArray({ message: "permissions phải là mảng." })
  @ArrayNotEmpty({ message: "permissions không được rỗng." })
  @ArrayUnique((o: PermissionDto) => o.id, {
    // ✅ Sửa ArrayUnique để kiểm tra trùng lặp theo ID
    message: "permissions không được trùng lặp ID.",
  })
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions?: PermissionDto[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @Length(0, 255, {
    message: "Mô tả không được vượt quá 255 ký tự.",
  })
  description?: string;

  @IsOptional()
  @IsString()
  @Length(0, 255, {
    message: "Tên không được vượt quá 255 ký tự.",
  })
  name?: string;

  // ✅ Role kế thừa (ROLE ID MỚI: NUMBER[])
  @IsOptional()
  @IsArray({ message: "inheritsFrom phải là mảng." })
  @ArrayNotEmpty({ message: "inheritsFrom không được rỗng." })
  @ArrayUnique({ message: "inheritsFrom không được trùng role." })
  @IsInt({ each: true, message: "ID vai trò cha phải là số nguyên." })
  @IsPositive({ each: true, message: "ID vai trò cha phải là số dương." })
  inheritsFrom?: number[]; // Đã thay đổi từ string[] sang number[]

  // ✅ Permissions (Mảng OBJECT chứa ID và NAME)
  @IsOptional()
  @IsArray({ message: "permissions phải là mảng." })
  @ArrayNotEmpty({ message: "permissions không được rỗng." })
  @ArrayUnique((o: PermissionDto) => o.id, {
    // ✅ Sửa ArrayUnique để kiểm tra trùng lặp theo ID
    message: "permissions không được trùng lặp ID.",
  })
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions?: PermissionDto[];
}
