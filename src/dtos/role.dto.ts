import { PermissionDto } from "@/dtos/permission.dto";
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
} from "class-validator";

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty({ message: "Tên không được để trống." })
  @Length(2, 100, { message: "Tên phải dài từ 2 đến 100 ký tự." })
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 255, { message: "Mô tả không được vượt quá 255 ký tự." })
  description?: string;

  // ✅ Role kế thừa (STRING[])
  @IsOptional()
  @IsArray({ message: "inheritsFrom phải là mảng." })
  @ArrayNotEmpty({ message: "inheritsFrom không được rỗng." })
  @ArrayUnique({ message: "inheritsFrom không được trùng role." })
  @IsString({ each: true, message: "Mỗi role kế thừa phải là string." })
  @Length(2, 100, {
    each: true,
    message: "Tên role kế thừa phải dài từ 2 đến 100 ký tự.",
  })
  inheritsFrom?: string[];

  // ✅ Permissions (object)
  @IsOptional()
  @IsArray({ message: "permissions phải là mảng." })
  @ArrayNotEmpty({ message: "permissions không được rỗng." })
  @ArrayUnique((o: PermissionDto) => o.name, {
    message: "permissions không được trùng lặp.",
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

  // ✅ Role kế thừa (STRING[])
  @IsOptional()
  @IsArray({ message: "inheritsFrom phải là mảng." })
  @ArrayNotEmpty({ message: "inheritsFrom không được rỗng." })
  @ArrayUnique({ message: "inheritsFrom không được trùng role." })
  @IsString({ each: true })
  @Length(2, 100, {
    each: true,
    message: "Tên role kế thừa phải dài từ 2 đến 100 ký tự.",
  })
  inheritsFrom?: string[];

  // ✅ Permissions
  @IsOptional()
  @IsArray({ message: "permissions phải là mảng." })
  @ArrayNotEmpty({ message: "permissions không được rỗng." })
  @ArrayUnique((o: PermissionDto) => o.name, {
    message: "permissions không được trùng lặp.",
  })
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions?: PermissionDto[];
}
