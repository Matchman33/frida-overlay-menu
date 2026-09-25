import { Logger } from "../logger.js";

export type ErrorReporter = (error: Error) => void;

function contextualError(label: string, cause: unknown): Error {
  const detail = cause instanceof Error ? cause.stack || cause.message : String(cause);
  return new Error(`${label}: ${detail}`);
}

function defaultReporter(error: Error): void {
  Logger.instance.error(error);
}

export function safeInvoke<T>(
  label: string,
  callback: () => T,
  report: ErrorReporter = defaultReporter,
): T | undefined {
  try {
    return callback();
  } catch (cause) {
    report(contextualError(label, cause));
    return undefined;
  }
}

export function deferSafe(
  label: string,
  callback: () => void,
  report: ErrorReporter = defaultReporter,
): void {
  setImmediate(() => safeInvoke(label, callback, report));
}
