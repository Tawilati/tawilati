import { HttpException } from "@/utils/exceptions/http/HttpException";

// message is the API error code from the contract, e.g. "invalid_qr".
export class NotFoundException extends HttpException {
    constructor(code: string = "not_found") {
        super(404, code);
        this.name = "NotFoundException";
    }
}
