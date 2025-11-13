import { HttpException } from "@/exceptions/http-exception";
import { CreateUserDto } from "@/dtos/create-user.dto";
import { StatusCodes } from "http-status-codes";

interface User {
  id: number;
  name: string;
}

// Mảng users private (module-scoped)
const users: User[] = [{ id: 1, name: "John Doe" }];

// Lấy user
export const getUser = (): User => {
  return users[0];
};

// Tạo user
export const createUser = (dto: CreateUserDto): User => {
  if (dto.name === "error") {
    throw new HttpException(StatusCodes.CONFLICT, "User already exists");
  }

  const newUser: User = {
    id: users.length + 1,
    name: dto.name,
  };

  users.push(newUser);
  return newUser;
};
