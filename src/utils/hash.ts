import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export const hash = (value: string): Promise<string> => bcrypt.hash(value, SALT_ROUNDS);

export const compare = (plaintext: string, hashed: string): Promise<boolean> => bcrypt.compare(plaintext, hashed);
