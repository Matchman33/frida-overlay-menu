type JavaCallback = (...args: any[]) => any;
export interface JavaListenerHandle {
    readonly instance: any;
    $new(): any;
    dispose(): void;
}
export interface JavaListenerOptions {
    key: string;
    owner?: string;
    interfaceClass: any;
    callbacks: Record<string, JavaCallback>;
    fallback?: Record<string, any>;
}
export declare function createJavaListener(options: JavaListenerOptions): JavaListenerHandle;
export declare function disposeJavaListenerOwner(owner: string): void;
export declare function getJavaListenerDiagnostics(): {
    pools: number;
    callbacks: number;
};
export {};
