export type Unsubscribe = () => void;
export declare class ListenerRegistry {
    private readonly listeners;
    add(owner: string, unsubscribe: Unsubscribe): Unsubscribe;
    clear(owner: string): void;
    clearAll(): void;
}
