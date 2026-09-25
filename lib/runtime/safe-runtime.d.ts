export type ErrorReporter = (error: Error) => void;
export declare function safeInvoke<T>(label: string, callback: () => T, report?: ErrorReporter): T | undefined;
export declare function deferSafe(label: string, callback: () => void, report?: ErrorReporter): void;
