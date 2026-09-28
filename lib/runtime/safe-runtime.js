import { Logger } from "../logger.js";
function contextualError(label, cause) {
    const detail = cause instanceof Error ? cause.stack || cause.message : String(cause);
    return new Error(`${label}: ${detail}`);
}
function defaultReporter(error) {
    Logger.instance.error(error);
}
export function safeInvoke(label, callback, report = defaultReporter) {
    try {
        return callback();
    }
    catch (cause) {
        report(contextualError(label, cause));
        return undefined;
    }
}
export function deferSafe(label, callback, report = defaultReporter) {
    setTimeout(() => safeInvoke(label, callback, report), 0);
}
