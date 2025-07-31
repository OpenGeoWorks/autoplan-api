export interface Crypt {
    decrypt(str: string): Promise<string> | string;
    encrypt(str: string): Promise<string> | string;
}
