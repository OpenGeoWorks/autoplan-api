import bcrypt from 'bcrypt';
import { Hash } from '@domain/interfaces/cryptography/Hash';

export class BcryptAdapter implements Hash {
    constructor(private readonly salt: number) {}

    async hash(value: string): Promise<string> {
        return bcrypt.hash(value, this.salt);
    }

    async compare(plaintext: string, hash: string): Promise<boolean> {
        return bcrypt.compare(plaintext, hash);
    }
}
