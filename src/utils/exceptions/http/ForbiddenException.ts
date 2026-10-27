import { HttpException } from "@/utils/exceptions/http/HttpException";

export class ForbiddenException extends HttpException {
  constructor(message: string = "forbidden") {
    super(403, message);
    this.name = "ForbiddenException";
  }
}
