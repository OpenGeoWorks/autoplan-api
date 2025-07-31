export interface TokenCacheInterface {
    create(data: { token: string; type: string; data: any; exp?: number }): Promise<void>;
    delete(data: { token: string; type: string }): Promise<void>;
    fetch(data: { token: string; type: string }): Promise<any | null>;
}
