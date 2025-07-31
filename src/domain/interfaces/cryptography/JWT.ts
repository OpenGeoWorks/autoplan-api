export interface JWT {
    generate(payload: string): Promise<string>;
    verify(jwt: string): Promise<string>;
}
