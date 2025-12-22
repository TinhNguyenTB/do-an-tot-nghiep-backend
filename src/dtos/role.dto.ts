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
  @ArrayUnique({ message: "permissions không được trùng lặp." })
  @IsString({ each: true, message: "Mỗi permission phải là string." })
  @Length(2, 100, {
    each: true,
    message: "Tên permission phải dài từ 2 đến 100 ký tự.",
  })
  permissions?: string[];
}
