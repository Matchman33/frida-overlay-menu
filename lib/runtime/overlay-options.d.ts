export declare const DEFAULT_PERMISSION_DENIED_MESSAGE = "\u8BF7\u5148\u6388\u4E88\u60AC\u6D6E\u7A97\u6743\u9650";
export declare class OverlayPermissionError extends Error {
    constructor(message?: string);
}
export declare class InvalidOverlayIconError extends Error {
    constructor(message: string);
}
export declare function normalizeIconBase64(input: string): string;
export declare function requireOverlayPermission(granted: boolean, message: string, showToast: (message: string) => void, onToastError?: (error: unknown) => void): void;
