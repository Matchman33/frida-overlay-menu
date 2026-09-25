export interface JavaRuntime {
  available?: boolean;
  use(name: string): any;
  cast?(value: any, klass: any): any;
  perform?(callback: () => void): void;
  performNow?(callback: () => void): void;
  scheduleOnMainThread?(callback: () => void): void;
}

export class JavaBridgeCompatibilityError extends Error {
  constructor(missingCapabilities: string[]) {
    super(
      `The selected frida-java-bridge is missing required capabilities: ${missingCapabilities.join(", ")}`,
    );
    this.name = "JavaBridgeCompatibilityError";
  }
}

export function assertJavaBridgeCompatible(
  java: Partial<JavaRuntime> | null | undefined,
): asserts java is JavaRuntime {
  const missing: string[] = [];
  if (!java || typeof java.use !== "function") missing.push("use");
  if (
    !java
    || (typeof java.performNow !== "function" && typeof java.perform !== "function")
  ) {
    missing.push("performNow or perform");
  }
  if (!java || typeof java.scheduleOnMainThread !== "function") {
    missing.push("scheduleOnMainThread");
  }
  if (missing.length > 0) throw new JavaBridgeCompatibilityError(missing);
}

function performImmediately(java: JavaRuntime, callback: () => void): void {
  const performNow = java.performNow;
  if (performNow) {
    performNow.call(java, callback);
    return;
  }
  const perform = java.perform;
  if (perform) perform.call(java, callback);
  else callback();
}

export function waitForJavaAvailable(
  java: JavaRuntime,
  timeoutMs: number = 30000,
  intervalMs: number = 50,
): Promise<void> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new RangeError("timeoutMs must be greater than zero"));
  }

  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = () => {
      try {
        if (java.available !== false) {
          if (timer) clearTimeout(timer);
          resolve();
          return;
        }
      } catch {}

      if (Date.now() >= deadline) {
        reject(new Error("Timed out waiting for Frida Java Bridge"));
        return;
      }
      timer = setTimeout(check, intervalMs);
    };
    check();
  });
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function runWhenJavaReady<T>(
  java: JavaRuntime,
  operation: () => T,
  timeoutMs: number = 30000,
  label: string = "Java operation",
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Timed out waiting for ${label}`));
    }, timeoutMs);

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const run = () => {
      try {
        const value = operation();
        finish(() => resolve(value));
      } catch (error) {
        finish(() => reject(error));
      }
    };

    try {
      performImmediately(java, run);
    } catch (error) {
      finish(() => reject(error));
    }
  });
}

export function scheduleOnMainThread<T>(
  java: JavaRuntime,
  operation: () => T,
  timeoutMs: number = 30000,
  label: string = "Android main thread",
): Promise<T> {
  if (!java.scheduleOnMainThread) {
    return Promise.reject(new Error("Java.scheduleOnMainThread is unavailable"));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Timed out waiting for Android main thread: ${label}`));
    }, timeoutMs);
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };

    try {
      java.scheduleOnMainThread!(() => {
        try {
          const value = operation();
          finish(() => resolve(value));
        } catch (error) {
          finish(() => reject(error));
        }
      });
    } catch (error) {
      finish(() => reject(error));
    }
  });
}

function readNumber(value: any): number {
  const number = Number(value?.value ?? value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function tryCall<T>(callback: () => T): T | null {
  try {
    return callback() ?? null;
  } catch {
    return null;
  }
}

function getApplication(java: JavaRuntime): any | null {
  const activityThread = tryCall(() => java.use("android.app.ActivityThread"));
  const current = activityThread
    ? tryCall(() => activityThread.currentApplication())
    : null;
  if (current) return current;

  const appGlobals = tryCall(() => java.use("android.app.AppGlobals"));
  const initial = appGlobals
    ? tryCall(() => appGlobals.getInitialApplication())
    : null;
  if (initial) return initial;

  const thread = activityThread
    ? tryCall(() => activityThread.currentActivityThread())
    : null;
  return thread ? tryCall(() => thread.getApplication()) : null;
}

export function getApplicationContext(java: JavaRuntime): any {
  const application = getApplication(java);
  if (!application) {
    throw new Error(
      "Android Application is not ready. Call FloatMenu.waitForReady() before constructing the menu.",
    );
  }

  const context = tryCall(() => application.getApplicationContext());
  return context || application;
}

export function waitForApplicationContext(
  java: JavaRuntime,
  timeoutMs: number = 30000,
  intervalMs: number = 100,
): Promise<any> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new RangeError("timeoutMs must be greater than zero"));
  }

  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    let settled = false;
    let lastError: unknown = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const hardTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (retryTimer) clearTimeout(retryTimer);
      const suffix = lastError == null ? "" : `: ${describeError(lastError)}`;
      reject(new Error(`Timed out waiting for Android Application context${suffix}`));
    }, timeoutMs);
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimeout);
      if (retryTimer) clearTimeout(retryTimer);
      callback();
    };
    const check = () => {
      const run = () => {
        try {
          const context = getApplicationContext(java);
          finish(() => resolve(context));
        } catch (error) {
          lastError = error;
          if (Date.now() >= deadline) {
            finish(() => reject(new Error(
              `Timed out waiting for Android Application context: ${describeError(error)}`,
            )));
            return;
          }
          retryTimer = setTimeout(check, intervalMs);
        }
      };

      try {
        performImmediately(java, run);
      } catch (error) {
        lastError = error;
        if (Date.now() >= deadline) {
          finish(() => reject(new Error(
            `Timed out waiting for Android Application context: ${describeError(error)}`,
          )));
          return;
        }
        retryTimer = setTimeout(check, intervalMs);
      }
    };
    check();
  });
}

function hasWindowManagerMethods(service: any): boolean {
  return service != null
    && typeof service.addView === "function"
    && typeof service.updateViewLayout === "function"
    && typeof service.removeView === "function";
}

export function getWindowManager(java: JavaRuntime, context: any): any {
  const service = tryCall(() => context.getSystemService("window"));
  if (!service) throw new Error("Android WindowManager service is unavailable");

  if (java.cast) {
    for (const className of ["android.view.WindowManager", "android.view.ViewManager"]) {
      const klass = tryCall(() => java.use(className));
      const casted = klass ? tryCall(() => java.cast!(service, klass)) : null;
      if (hasWindowManagerMethods(casted)) return casted;
    }
  }

  if (hasWindowManagerMethods(service)) return service;
  throw new Error("Android WindowManager service cannot be used as a ViewManager");
}

function readSize(metrics: any): { width: number; height: number } | null {
  const width = readNumber(metrics?.widthPixels);
  const height = readNumber(metrics?.heightPixels);
  if (width <= 0 || height <= 0 || width > 32768 || height > 32768) return null;
  return { width: Math.round(width), height: Math.round(height) };
}

export function readDisplaySize(context: any, windowManager: any): {
  width: number;
  height: number;
} {
  const metrics = tryCall(() => context.getResources().getDisplayMetrics());
  const resourceSize = readSize(metrics);
  if (resourceSize) return resourceSize;

  if (metrics) {
    const display = tryCall(() => windowManager.getDefaultDisplay());
    if (display) {
      tryCall(() => display.getRealMetrics(metrics));
      const realSize = readSize(metrics);
      if (realSize) return realSize;

      tryCall(() => display.getMetrics(metrics));
      const displaySize = readSize(metrics);
      if (displaySize) return displaySize;
    }
  }

  throw new Error("Android display metrics are invalid or unavailable");
}

export function readDisplayDensity(context: any): number {
  const metrics = tryCall(() => context.getResources().getDisplayMetrics());
  const density = readNumber(metrics?.density);
  return density >= 0.25 && density <= 8 ? density : 1;
}

export function getOverlayWindowType(layoutParams: any): number {
  for (const fieldName of [
    "TYPE_APPLICATION_OVERLAY",
    "TYPE_PHONE",
    "TYPE_SYSTEM_ALERT",
  ]) {
    const type = readNumber(layoutParams?.[fieldName]);
    if (Number.isInteger(type) && type > 0) return type;
  }
  throw new Error("No supported Android overlay window type is available");
}

export function ensureWindowNotFocusable(
  params: any,
  layoutParams: any,
): boolean {
  if (!params) throw new Error("Window layout params are unavailable");

  const flag = readNumber(layoutParams?.FLAG_NOT_FOCUSABLE);
  if (!Number.isInteger(flag) || flag <= 0) {
    throw new Error("FLAG_NOT_FOCUSABLE is unavailable");
  }

  const current = readNumber(params.flags);
  const normalizedCurrent = Number.isInteger(current) ? current : 0;
  const next = normalizedCurrent | flag;
  if (next === normalizedCurrent) return false;

  if (params.flags && typeof params.flags === "object" && "value" in params.flags) {
    params.flags.value = next;
  } else {
    params.flags = next;
  }
  return true;
}
