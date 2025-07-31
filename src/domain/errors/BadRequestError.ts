export default class BadRequestError extends Error {
    constructor(msg?: string) {
        super(msg || 'Bad request');
        this.name = 'BadRequestError';
        this.message = <string>msg;
    }
}
