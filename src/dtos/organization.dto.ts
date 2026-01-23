import {
  IsString,
  IsOptional,
  Length,
  Matches,
  IsBoolean,
  isNumber,
  IsNumber,
} from "class-validator";

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString({ message: "Tên tổ chức phải là chuỗi." })
  @Length(2, 255, { message: "Tên tổ chức từ 2 đến 255 ký tự." })
  name?: string;

  @IsOptional()
  @IsString({ message: "Số điện thoại phải là chuỗi." })
  //   @Matches(/(84|0[3|5|7|8|9])+([0-9]{8})\b/, {
  //     message: "Số điện thoại không đúng định dạng Việt Nam.",
  //   })
  phoneNumber?: string;
}

export class UpdateOrgStatus {
  @IsBoolean()
  isActive!: boolean;

  @IsNumber()
  id!: number;
}
