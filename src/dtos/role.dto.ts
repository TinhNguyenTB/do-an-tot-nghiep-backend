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

export class InheritsFromDto {
  @IsString()
  @IsNotEmpty({ message: "Tên role kế thừa không được để trống." })
  @Length(2, 100, {
    message: "Tên role kế thừa phải dài từ 2 đến 100 ký tự.",
  })
  name!: string;
}

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty({ message: "Tên không được để trống." })
  @Length(2, 100, { message: "Tên phải dài từ 2 đến 100 ký tự." })
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 255, { message: "Mô tả không được vượt quá 255 ký tự." })
  description?: string;

  // ✅ Role kế thừa
  @IsOptional()
  @IsArray({ message: "inheritsFrom phải là mảng." })
  @ArrayNotEmpty({ message: "inheritsFrom không được rỗng." })
  @ArrayUnique((o: InheritsFromDto) => o.name, {
    message: "inheritsFrom không được trùng role.",
  })
  @ValidateNested({ each: true })
  @Type(() => InheritsFromDto)
  inheritsFrom?: InheritsFromDto[];

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

class InheritRoleDto {
  @IsString()
  @Length(2, 100, {
    message: "Tên role kế thừa phải dài từ 2 đến 100 ký tự.",
  })
  name!: string;
}

export class UpdateRoleDto {
  // Mô tả
  @IsOptional()
  @IsString()
  @Length(0, 255, {
    message: "Mô tả không được vượt quá 255 ký tự.",
  })
  description?: string;

  // Danh sách role cha
  @IsOptional()
  @IsArray({ message: "inheritsFrom phải là mảng." })
  @ArrayNotEmpty({ message: "inheritsFrom không được rỗng." })
  @ArrayUnique((o: InheritRoleDto) => o.name, {
    message: "inheritsFrom không được trùng role.",
  })
  @ValidateNested({ each: true })
  @Type(() => InheritRoleDto)
  inheritsFrom?: InheritRoleDto[];

  // Danh sách permission
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
