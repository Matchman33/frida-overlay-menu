export interface JavaRuntime {
    available?: boolean;
    use(name: string): any;
    cast?(value: any, klass: any): any;
    perform?(callback: () => void): void;
    performNow?(callback: () => void): void;
    scheduleOnMainThread?(callback: () => void): void;
}
export declare class JavaBridgeCompatibilityError extends Error {
    constructor(missingCapabilities: string[]);
}
export declare function assertJavaBridgeCompatible(java: Partial<JavaRuntime> | null | undefined): asserts java is JavaRuntime;
export declare function waitForJavaAvailable(java: JavaRuntime, timeoutMs?: number, intervalMs?: number): Promise<void>;
export declare function runWhenJavaReady<T>(java: JavaRuntime, operation: () => T, timeoutMs?: number, label?: string): Promise<T>;
export declare function scheduleOnMainThread<T>(java: JavaRuntime, operation: () => T, timeoutMs?: number, label?: string): Promise<T>;
export declare function getApplicationContext(java: JavaRuntime): any;
export declare function waitForApplicationContext(java: JavaRuntime, timeoutMs?: number, intervalMs?: number): Promise<any>;
export declare function getWindowManager(java: JavaRuntime, context: any): any;
export declare function readDisplaySize(context: any, windowManager: any): {
    width: number;
    height: number;
};
export declare function readDisplayDensity(context: any): number;
export declare function getOverlayWindowType(layoutParams: any): number;
export declare function ensureWindowNotFocusable(params: any, layoutParams: any): boolean;
