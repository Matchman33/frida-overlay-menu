import Java from "./java-runtime.js";
import { Logger } from "./logger.js";
const pools = new Map();
const owners = new Map();
const sessionSuffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
let nextListenerId = 1;
function sanitizeClassSegment(value) {
    const sanitized = value.replace(/[^A-Za-z0-9_]/g, "_");
    return /^[A-Za-z_]/.test(sanitized) ? sanitized : `L_${sanitized}`;
}
function createPool(options) {
    const callbacks = new Map();
    const fallback = options.fallback ?? {};
    const methods = {};
    for (const methodName of Object.keys(options.callbacks)) {
        methods[methodName] = function (...args) {
            const callbackId = String(this.callbackId.value);
            const callback = callbacks.get(callbackId)?.[methodName];
            if (!callback)
                return fallback[methodName];
            try {
                return callback(...args);
            }
            catch (error) {
                Logger.instance.error(`[JavaListener:${options.key}.${methodName}] callback failed:`, error);
                return fallback[methodName];
            }
        };
    }
    const listenerClass = Java.registerClass({
        name: `com.fridauiruntime.listener.${sanitizeClassSegment(options.key)}_${sessionSuffix}`,
        implements: [options.interfaceClass],
        fields: { callbackId: "java.lang.String" },
        methods,
    });
    return { listenerClass, callbacks, fallback };
}
export function createJavaListener(options) {
    const methodNames = Object.keys(options.callbacks).sort().join(",");
    const poolKey = `${options.key}:${methodNames}`;
    let pool = pools.get(poolKey);
    if (!pool) {
        pool = createPool(options);
        pools.set(poolKey, pool);
    }
    const callbackId = String(nextListenerId++);
    pool.callbacks.set(callbackId, options.callbacks);
    const instance = pool.listenerClass.$new();
    instance.callbackId.value = callbackId;
    let disposed = false;
    const handle = {
        instance,
        $new: () => instance,
        dispose() {
            if (disposed)
                return;
            disposed = true;
            pool.callbacks.delete(callbackId);
            const owned = options.owner ? owners.get(options.owner) : undefined;
            owned?.delete(handle.dispose);
            if (options.owner && owned?.size === 0)
                owners.delete(options.owner);
            try {
                instance.callbackId.value = "";
            }
            catch { }
        },
    };
    if (options.owner) {
        let owned = owners.get(options.owner);
        if (!owned) {
            owned = new Set();
            owners.set(options.owner, owned);
        }
        owned.add(handle.dispose);
    }
    return handle;
}
export function disposeJavaListenerOwner(owner) {
    const owned = owners.get(owner);
    if (!owned)
        return;
    owners.delete(owner);
    for (const dispose of Array.from(owned))
        dispose();
}
export function getJavaListenerDiagnostics() {
    let callbacks = 0;
    for (const pool of pools.values())
        callbacks += pool.callbacks.size;
    return { pools: pools.size, callbacks };
}
