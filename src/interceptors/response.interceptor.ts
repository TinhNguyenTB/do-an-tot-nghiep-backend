import { getReasonPhrase, StatusCodes } from "http-status-codes";

export interface ResponseFormat<T> {
  statusCode: number;
  message: string;
  data?: T;
}

export const responseInterceptor = <T>(
  data: T,
  message = getReasonPhrase(StatusCodes.OK),
  statusCode = StatusCodes.OK
): ResponseFormat<T> => {
  return {
    statusCode,
    message,
    data,
  };
};
