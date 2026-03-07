export declare function log(message: string): void;
export type LogLevel = "debug" | "info" | "warn" | "error" | "none";
type LogItem = {
    ts: number;
    level: LogLevel;
    message: string;
};
type LogListener = (items: LogItem[]) => void;
export declare class Logger {
    on(arg0: string, arg1: (level: LogLevel, message: string) => void): void;
    private static _instance;
    static get instance(): Logger;
    private levelPriority;
    private currentLevel;
    private maxBuffer;
    private buffer;
    private head;
    private size;
    private flushIntervalMs;
    private pending;
    private flushTimer;
    private listeners;
    constructor(level?: LogLevel, options?: {
        maxBuffer?: number;
        flushIntervalMs?: number;
    });
    setLevel(level: LogLevel): void;
    setMaxBuffer(max: number): void;
    debug(...args: any[]): void;
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    onLog(listener: LogListener, replay?: boolean): () => void;
    getRecent(limit?: number): LogItem[];
    clear(): void;
    private safeStringify;
    private formatArgs;
    private _log;
    private pushToBuffer;
    private scheduleFlush;
    private emitBatch;
}
export {};
