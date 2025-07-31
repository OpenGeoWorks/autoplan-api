export interface Hash {
    compare(plaintext: string, hash: string): Promise<boolean> | boolean;
    hash(data: string): Promise<string> | string;
}
