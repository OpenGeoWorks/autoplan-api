export default class NotFoundError extends Error {
    constructor(msg?: string) {
        super(msg || 'Not found');
        this.name = 'NotFoundError';
        this.message = <string>msg;
    }
}
