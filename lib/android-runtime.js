export class JavaBridgeCompatibilityError extends Error {
    constructor(missingCapabilities) {
        super(`The selected frida-java-bridge is missing required capabilities: ${missingCapabilities.join(", ")}`);
        this.name = "JavaBridgeCompatibilityError";
    }
}
export function assertJavaBridgeCompatible(java) {
    const missing = [];
    if (!java || typeof java.use !== "function")
        missing.push("use");
    if (!java
        || (typeof java.performNow !== "function" && typeof java.perform !== "function")) {
        missing.push("performNow or perform");
    }
    if (!java || typeof java.scheduleOnMainThread !== "function") {
        missing.push("scheduleOnMainThread");
    }
    if (missing.length > 0)
        throw new JavaBridgeCompatibilityError(missing);
}
function performImmediately(java, callback) {
    const performNow = java.performNow;
    if (performNow) {
        performNow.call(java, callback);
        return;
    }
    const perform = java.perform;
    if (perform)
        perform.call(java, callback);
    else
        callback();
}
export function waitForJavaAvailable(java, timeoutMs = 30000, intervalMs = 50) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        return Promise.reject(new RangeError("timeoutMs must be greater than zero"));
    }
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
        let timer = null;
        const check = () => {
            try {
                if (java.available !== false) {
                    if (timer)
                        clearTimeout(timer);
                    resolve();
                    return;
                }
            }
            catch { }
            if (Date.now() >= deadline) {
                reject(new Error("Timed out waiting for Frida Java Bridge"));
                return;
            }
            timer = setTimeout(check, intervalMs);
        };
        check();
    });
}
function describeError(error) {
    return error instanceof Error ? error.message : String(error);
}
export function runWhenJavaReady(java, operation, timeoutMs = 30000, label = "Java operation") {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled)
                return;
            settled = true;
            reject(new Error(`Timed out waiting for ${label}`));
        }, timeoutMs);
        const finish = (callback) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            callback();
        };
        const run = () => {
            try {
                const value = operation();
                finish(() => resolve(value));
            }
            catch (error) {
                finish(() => reject(error));
            }
        };
        try {
            performImmediately(java, run);
        }
        catch (error) {
            finish(() => reject(error));
        }
    });
}
export function scheduleOnMainThread(java, operation, timeoutMs = 30000, label = "Android main thread") {
    if (!java.scheduleOnMainThread) {
        return Promise.reject(new Error("Java.scheduleOnMainThread is unavailable"));
    }
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled)
                return;
            settled = true;
            reject(new Error(`Timed out waiting for Android main thread: ${label}`));
        }, timeoutMs);
        const finish = (callback) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            callback();
        };
        try {
            java.scheduleOnMainThread(() => {
                try {
                    const value = operation();
                    finish(() => resolve(value));
                }
                catch (error) {
                    finish(() => reject(error));
                }
            });
        }
        catch (error) {
            finish(() => reject(error));
        }
    });
}
function readNumber(value) {
    const number = Number(value?.value ?? value);
    return Number.isFinite(number) ? number : Number.NaN;
}
function tryCall(callback) {
    try {
        return callback() ?? null;
    }
    catch {
        return null;
    }
}
function getApplication(java) {
    const activityThread = tryCall(() => java.use("android.app.ActivityThread"));
    const current = activityThread
        ? tryCall(() => activityThread.currentApplication())
        : null;
    if (current)
        return current;
    const appGlobals = tryCall(() => java.use("android.app.AppGlobals"));
    const initial = appGlobals
        ? tryCall(() => appGlobals.getInitialApplication())
        : null;
    if (initial)
        return initial;
    const thread = activityThread
        ? tryCall(() => activityThread.currentActivityThread())
        : null;
    return thread ? tryCall(() => thread.getApplication()) : null;
}
export function getApplicationContext(java) {
    const application = getApplication(java);
    if (!application) {
        throw new Error("Android Application is not ready. Call FloatMenu.waitForReady() before constructing the menu.");
    }
    const context = tryCall(() => application.getApplicationContext());
    return context || application;
}
export function waitForApplicationContext(java, timeoutMs = 30000, intervalMs = 100) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        return Promise.reject(new RangeError("timeoutMs must be greater than zero"));
    }
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
        let settled = false;
        let lastError = null;
        let retryTimer = null;
        const hardTimeout = setTimeout(() => {
            if (settled)
                return;
            settled = true;
            if (retryTimer)
                clearTimeout(retryTimer);
            const suffix = lastError == null ? "" : `: ${describeError(lastError)}`;
            reject(new Error(`Timed out waiting for Android Application context${suffix}`));
        }, timeoutMs);
        const finish = (callback) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(hardTimeout);
            if (retryTimer)
                clearTimeout(retryTimer);
            callback();
        };
        const check = () => {
            const run = () => {
                try {
                    const context = getApplicationContext(java);
                    finish(() => resolve(context));
                }
                catch (error) {
                    lastError = error;
                    if (Date.now() >= deadline) {
                        finish(() => reject(new Error(`Timed out waiting for Android Application context: ${describeError(error)}`)));
                        return;
                    }
                    retryTimer = setTimeout(check, intervalMs);
                }
            };
            try {
                performImmediately(java, run);
            }
            catch (error) {
                lastError = error;
                if (Date.now() >= deadline) {
                    finish(() => reject(new Error(`Timed out waiting for Android Application context: ${describeError(error)}`)));
                    return;
                }
                retryTimer = setTimeout(check, intervalMs);
            }
        };
        check();
    });
}
function hasWindowManagerMethods(service) {
    return service != null
        && typeof service.addView === "function"
        && typeof service.updateViewLayout === "function"
        && typeof service.removeView === "function";
}
export function getWindowManager(java, context) {
    const service = tryCall(() => context.getSystemService("window"));
    if (!service)
        throw new Error("Android WindowManager service is unavailable");
    if (java.cast) {
        for (const className of ["android.view.WindowManager", "android.view.ViewManager"]) {
            const klass = tryCall(() => java.use(className));
            const casted = klass ? tryCall(() => java.cast(service, klass)) : null;
            if (hasWindowManagerMethods(casted))
                return casted;
        }
    }
    if (hasWindowManagerMethods(service))
        return service;
    throw new Error("Android WindowManager service cannot be used as a ViewManager");
}
function readSize(metrics) {
    const width = readNumber(metrics?.widthPixels);
    const height = readNumber(metrics?.heightPixels);
    if (width <= 0 || height <= 0 || width > 32768 || height > 32768)
        return null;
    return { width: Math.round(width), height: Math.round(height) };
}
export function readDisplaySize(context, windowManager) {
    const metrics = tryCall(() => context.getResources().getDisplayMetrics());
    const resourceSize = readSize(metrics);
    if (resourceSize)
        return resourceSize;
    if (metrics) {
        const display = tryCall(() => windowManager.getDefaultDisplay());
        if (display) {
            tryCall(() => display.getRealMetrics(metrics));
            const realSize = readSize(metrics);
            if (realSize)
                return realSize;
            tryCall(() => display.getMetrics(metrics));
            const displaySize = readSize(metrics);
            if (displaySize)
                return displaySize;
        }
    }
    throw new Error("Android display metrics are invalid or unavailable");
}
export function readDisplayDensity(context) {
    const metrics = tryCall(() => context.getResources().getDisplayMetrics());
    const density = readNumber(metrics?.density);
    return density >= 0.25 && density <= 8 ? density : 1;
}
export function getOverlayWindowType(layoutParams) {
    for (const fieldName of [
        "TYPE_APPLICATION_OVERLAY",
        "TYPE_PHONE",
        "TYPE_SYSTEM_ALERT",
    ]) {
        const type = readNumber(layoutParams?.[fieldName]);
        if (Number.isInteger(type) && type > 0)
            return type;
    }
    throw new Error("No supported Android overlay window type is available");
}
export function ensureWindowNotFocusable(params, layoutParams) {
    if (!params)
        throw new Error("Window layout params are unavailable");
    const flag = readNumber(layoutParams?.FLAG_NOT_FOCUSABLE);
    if (!Number.isInteger(flag) || flag <= 0) {
        throw new Error("FLAG_NOT_FOCUSABLE is unavailable");
    }
    const current = readNumber(params.flags);
    const normalizedCurrent = Number.isInteger(current) ? current : 0;
    const next = normalizedCurrent | flag;
    if (next === normalizedCurrent)
        return false;
    if (params.flags && typeof params.flags === "object" && "value" in params.flags) {
        params.flags.value = next;
    }
    else {
        params.flags = next;
    }
    return true;
}
