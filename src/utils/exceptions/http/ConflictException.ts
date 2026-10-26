import { HttpException } from "@/utils/exceptions/http/HttpException";

// message is the API error code from the contract, e.g. "table_disabled".
export class ConflictException extends HttpException {
    constructor(code: string) {
        super(409, code);
        this.name = "ConflictException";
    }
}
