import jwt from 'jsonwebtoken';
import { JWT } from '@domain/interfaces/cryptography/JWT';
import { Crypt } from '@domain/interfaces/cryptography/Crypt';
import env from '@infra//config/env';

export class JWTAdapter implements JWT {
    private static instance: JWTAdapter;

    constructor(
        private readonly secret: string,
        private readonly crypt: Crypt,
    ) {}

    static getInstance(crypt: Crypt): JWTAdapter {
        if (!JWTAdapter.instance) {
            JWTAdapter.instance = new JWTAdapter(env.jwtSecret, crypt);
        }

        return JWTAdapter.instance;
    }

    async generate(payload: string): Promise<string> {
        const encryptedPayload = this.crypt.encrypt(payload);
        return jwt.sign({ data: encryptedPayload }, this.secret, { expiresIn: 60 * 60 * 24, algorithm: 'ES256' });
    }

    async verify(token: string): Promise<string> {
        const payload = jwt.verify(token, this.secret) as { data: string };
        return this.crypt.decrypt(payload.data);
    }
}
