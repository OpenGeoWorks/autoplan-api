export default class UnAuthorizedError extends Error {
    constructor(msg?: string) {
        super(msg || 'UnAuthorized');
        this.name = 'UnAuthorizedError';
        this.message = <string>msg;
    }
}
