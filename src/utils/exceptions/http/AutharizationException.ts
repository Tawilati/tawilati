import { HttpException } from "./HttpException";

export class AuthorizationException extends HttpException {
    constructor(message:string){
        super(403, message);
        this.name = "AuthorizationException";
    }
}
export class InsufficientPermissionsException extends AuthorizationException {
    constructor(){
        super("Insufficient permissions");
        this.name = "InsufficientPermissionsException";
    }
}
export class InvalidRoleException extends AuthorizationException {
    constructor(message:string){
        super(message);
        this.name = "InvalidRoleException";
    }
}