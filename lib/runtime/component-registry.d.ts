export interface RegisteredComponent {
    getId(): string;
    getValue?(): unknown;
    captureState?(): unknown;
    dispose?(): void | Promise<void>;
}
export interface ComponentEntry<T extends RegisteredComponent> {
    component: T;
    tabId: string;
    ownerId?: string;
    container?: unknown;
}
export declare class ComponentRegistry<T extends RegisteredComponent = RegisteredComponent> {
    private readonly components;
    add(component: T, tabId: string, ownerId?: string): void;
    get(id: string): T | undefined;
    getEntry(id: string): ComponentEntry<T> | undefined;
    remove(id: string): ComponentEntry<T> | undefined;
    attach(id: string, container: unknown): void;
    childrenOf(ownerId: string): ComponentEntry<T>[];
    values(): IterableIterator<ComponentEntry<T>>;
    captureState(): Record<string, unknown>;
    clear(): void;
}
