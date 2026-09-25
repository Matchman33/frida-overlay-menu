export type LifecycleState = "created" | "mounted" | "icon-visible" | "menu-visible" | "hidden" | "disposing" | "disposed";
export declare class LifecycleController {
    private queue;
    private currentState;
    get state(): LifecycleState;
    get disposed(): boolean;
    transition(next: LifecycleState): void;
    run<T>(name: string, operation: () => T | Promise<T>): Promise<T>;
}
