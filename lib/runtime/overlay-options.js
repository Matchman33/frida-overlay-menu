export const DEFAULT_PERMISSION_DENIED_MESSAGE = "请先授予悬浮窗权限";
export class OverlayPermissionError extends Error {
    constructor(message = DEFAULT_PERMISSION_DENIED_MESSAGE) {
        super(message);
        this.name = "OverlayPermissionError";
    }
}
export class InvalidOverlayIconError extends Error {
    constructor(message) {
        super(message);
        this.name = "InvalidOverlayIconError";
    }
}
export function normalizeIconBase64(input) {
    if (typeof input !== "string") {
        throw new InvalidOverlayIconError("Overlay icon Base64 must be a string");
    }
    const trimmed = input.trim();
    const marker = ";base64,";
    const markerIndex = trimmed.toLowerCase().indexOf(marker);
    const payload = markerIndex >= 0
        ? trimmed.slice(markerIndex + marker.length)
        : trimmed;
    const normalized = payload.replace(/\s+/g, "");
    if (normalized.length === 0
        || normalized.length % 4 === 1
        || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
        throw new InvalidOverlayIconError("Overlay icon contains invalid Base64 data");
    }
    return normalized;
}
export function requireOverlayPermission(granted, message, showToast, onToastError) {
    if (granted)
        return;
    try {
        showToast(message);
    }
    catch (error) {
        onToastError?.(error);
    }
    throw new OverlayPermissionError(message);
}
