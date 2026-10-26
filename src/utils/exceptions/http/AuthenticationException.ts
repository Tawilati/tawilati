
import { HttpException } from "@/utils/exceptions/http/HttpException"

export class AuthenticationException extends HttpException {
    constructor(message: string = "Authentication failed") {
        super(401, message);
        this.name = "AuthenticationException";
    }
}
export class InvalidTokenException extends AuthenticationException {
    constructor() {
        super("Invalid token");
        this.name = "InvalidTokenException";
    }
}
export class TokenNotFoundException extends AuthenticationException{
 constructor() {
        super("Token Not Found");
        this.name = "TokenNotFoundException";
    }   
} 


export class ExpiredTokenException extends AuthenticationException {
    constructor() {
        super("Token has expired");
        this.name = "ExpiredTokenException";
    }
}
     export class AuthenticationFailedException extends AuthenticationException {
    constructor() {
        super("Authentication failed");
        this.name = "AuthenticationFailedException";
 
        }
        

}
       