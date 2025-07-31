export interface OTPCacheInterface {
    create(data: { identifier: string; type: string; token: string; exp?: number }): Promise<void>;
    delete(data: { identifier: string; type: string }): Promise<void>;
    fetch(data: { identifier: string; type: string }): Promise<string | null>;
}
