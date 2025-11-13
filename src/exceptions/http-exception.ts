export class HttpException extends Error {
  public readonly statusCode: number;
  public readonly message: string;
  public readonly errors?: any;

  constructor(statusCode: number, message: string, errors?: any) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
  }
}
